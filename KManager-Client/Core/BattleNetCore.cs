using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace KManager.Core
{
    public partial class BattleNetCore
    {
        private readonly string _appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Battle.net");
        private readonly string _dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppIdentity.AppName, "Data");
        private readonly string _legacyDataDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data");
        private readonly string _accountsJsonPath;
        private readonly string _groupsJsonPath;
        private readonly string _configFilePath;

        public BattleNetCore()
        {
            _configFilePath = Path.Combine(_appDataPath, "Battle.net.config");
            _accountsJsonPath = Path.Combine(_dataDir, "accounts.json");
            _groupsJsonPath = Path.Combine(_dataDir, "groups.json");
            MigrateLegacyDataIfNeeded();
            if (!Directory.Exists(_dataDir))
                Directory.CreateDirectory(_dataDir);
        }

        public List<AccountInfo> GetAccounts()
        {
            if (!File.Exists(_accountsJsonPath))
                return new List<AccountInfo>();
            try
            {
                var json = File.ReadAllText(_accountsJsonPath);
                var accounts = JsonSerializer.Deserialize<List<AccountInfo>>(json) ?? new List<AccountInfo>();
                var changed = NormalizeAccounts(accounts);
                if (changed)
                    SaveAccounts(accounts);
                return accounts;
            }
            catch
            {
                return new List<AccountInfo>();
            }
        }

        private void SaveAccounts(List<AccountInfo> accounts)
        {
            NormalizeAccounts(accounts);
            File.WriteAllText(_accountsJsonPath, JsonSerializer.Serialize(accounts));
        }

        public List<GroupInfo> GetGroups()
        {
            var groups = ReadGroups();
            SaveGroups(groups);
            return groups;
        }

        public GroupInfo? CreateGroup(string name)
        {
            name = NormalizeGroupName(name);
            if (string.IsNullOrEmpty(name))
                return null;

            var groups = ReadGroups();
            var existing = groups.FirstOrDefault(g => string.Equals(g.Name, name, StringComparison.OrdinalIgnoreCase));
            if (existing != null)
                return existing;

            var group = new GroupInfo { Name = name };
            groups.Add(group);
            SaveGroups(groups);
            return group;
        }

        public bool RenameGroup(string id, string name)
        {
            if (id == DefaultGroupId)
                return false;

            name = NormalizeGroupName(name);
            if (string.IsNullOrEmpty(name))
                return false;

            var groups = ReadGroups();
            if (groups.Any(g => g.Id != id && string.Equals(g.Name, name, StringComparison.OrdinalIgnoreCase)))
                return false;

            var group = groups.FirstOrDefault(g => g.Id == id);
            if (group == null)
                return false;

            group.Name = name;
            SaveGroups(groups);
            return true;
        }

        public bool DeleteGroup(string id)
        {
            if (string.IsNullOrEmpty(id) || id == DefaultGroupId)
                return false;

            var groups = ReadGroups();
            var removed = groups.RemoveAll(g => g.Id == id) > 0;
            if (!removed)
                return false;

            SaveGroups(groups);

            var accounts = GetAccounts();
            var accountChanged = false;
            foreach (var account in accounts.Where(a => a.GroupId == id))
            {
                account.GroupId = DefaultGroupId;
                accountChanged = true;
            }
            if (accountChanged)
                SaveAccounts(accounts);

            return true;
        }

        public bool MoveAccountToGroup(string accountId, string groupId)
        {
            groupId = EnsureValidGroupId(groupId);
            var accounts = GetAccounts();
            var account = accounts.FirstOrDefault(a => a.Id == accountId);
            if (account == null)
                return false;

            account.GroupId = groupId;
            SaveAccounts(accounts);
            return true;
        }

        public bool UpdateAccountInfo(string accountId, string remark, string battleTag, string region, string avatarDataUrl)
        {
            var accounts = GetAccounts();
            var account = accounts.FirstOrDefault(a => a.Id == accountId);
            if (account == null)
                return false;

            var normalizedRegion = NormalizeAccountRegion(region);
            if (!IsTaggedAccountRegion(normalizedRegion))
                return false;

            account.Remark = string.IsNullOrWhiteSpace(remark) ? "未命名账号" : remark.Trim();
            account.Username = (battleTag ?? "").Trim();
            account.Region = normalizedRegion;
            account.AvatarDataUrl = SanitizeAvatarDataUrl(avatarDataUrl);
            SaveAccounts(accounts);
            return true;
        }

        public bool SaveCurrentAccount(string remark, string battleTag, string region, string avatarDataUrl)
        {
            return SaveCurrentAccountDetailed(remark, battleTag, region, avatarDataUrl).Success;
        }

        public bool SaveCurrentAccountToGroup(string remark, string battleTag, string groupId, string region, string avatarDataUrl)
        {
            return SaveCurrentAccountToGroupDetailed(remark, battleTag, groupId, region, avatarDataUrl).Success;
        }

        public SaveAccountResult SaveCurrentAccountDetailed(string remark, string battleTag, string region, string avatarDataUrl)
        {
            return SaveCurrentAccountToGroupDetailed(remark, battleTag, DefaultGroupId, region, avatarDataUrl);
        }

        public SaveAccountResult SaveCurrentAccountToGroupDetailed(string remark, string battleTag, string groupId, string region, string avatarDataUrl)
        {
            return SaveCurrentAccountToGroupDetailedAsync(remark, battleTag, groupId, region, avatarDataUrl)
                .GetAwaiter()
                .GetResult();
        }

        private async Task<SaveAccountResult> SaveCurrentAccountToGroupDetailedAsync(string remark, string battleTag, string groupId, string region, string avatarDataUrl)
        {
            if (!File.Exists(_configFilePath))
                return new SaveAccountResult { Success = false, Error = "missing_config" };

            var normalizedRegion = NormalizeAccountRegion(region);
            if (!IsTaggedAccountRegion(normalizedRegion))
                return new SaveAccountResult { Success = false, Error = "untagged_region" };

            var accounts = GetAccounts();
            var newAccount = new AccountInfo
            {
                Remark = string.IsNullOrWhiteSpace(remark) ? "新账号" : remark.Trim(),
                Username = (battleTag ?? "").Trim(),
                GroupId = EnsureValidGroupId(groupId),
                Region = normalizedRegion,
                AvatarDataUrl = SanitizeAvatarDataUrl(avatarDataUrl)
            };

            string accountDir = Path.Combine(_dataDir, newAccount.Id);
            Directory.CreateDirectory(accountDir);
            var fallbackConfig = Path.Combine(accountDir, "Battle.net.config.fallback");
            var savedConfig = Path.Combine(accountDir, "Battle.net.config");

            TryDeleteFile(fallbackConfig);
            if (!TryCopyFile(_configFilePath, fallbackConfig))
                return new SaveAccountResult { Success = false, Error = "copy_config_failed" };

            var wasBattleNetRunning = IsBattleNetClientRunning();
            var prepareSucceeded = await PrepareBattleNetSessionCaptureAsync().ConfigureAwait(false);
            var shouldRelaunchBattleNet = wasBattleNetRunning
                && (prepareSucceeded || !IsBattleNetClientRunning());

            try
            {
                if (File.Exists(_configFilePath))
                    TryCopyFile(_configFilePath, fallbackConfig);

                var sessionStateSaved = prepareSucceeded
                    && TrySaveCurrentBattleNetSessionSnapshot(accountDir, normalizedRegion, requireExactRegion: false);

                if (!sessionStateSaved && !TryCopyFile(fallbackConfig, savedConfig))
                {
                    TryDeleteDirectory(accountDir);
                    return new SaveAccountResult { Success = false, Error = "copy_config_failed" };
                }

                accounts.Add(newAccount);
                SaveAccounts(accounts);
                TryDeleteFile(fallbackConfig);

                return new SaveAccountResult
                {
                    Success = true,
                    SessionStateSaved = sessionStateSaved,
                    Error = sessionStateSaved
                        ? ""
                        : (prepareSucceeded ? "missing_session_snapshot" : "client_exit_timeout")
                };
            }
            finally
            {
                RelaunchBattleNetAfterCaptureIfNeeded(shouldRelaunchBattleNet, normalizedRegion);
            }
        }

        public bool RefreshAccountSessionState(string id)
        {
            return RefreshAccountSessionStateAsync(id)
                .GetAwaiter()
                .GetResult();
        }

        private async Task<bool> RefreshAccountSessionStateAsync(string id)
        {
            if (!File.Exists(_configFilePath))
                return false;

            var accounts = GetAccounts();
            var account = accounts.FirstOrDefault(a => a.Id == id);
            if (account == null)
                return false;

            var wasBattleNetRunning = IsBattleNetClientRunning();
            var prepareSucceeded = await PrepareBattleNetSessionCaptureAsync().ConfigureAwait(false);
            var shouldRelaunchBattleNet = wasBattleNetRunning
                && (prepareSucceeded || !IsBattleNetClientRunning());

            try
            {
                if (!prepareSucceeded)
                    return false;

                if (!File.Exists(_configFilePath))
                    return false;

                var accountDir = Path.Combine(_dataDir, id);
                Directory.CreateDirectory(accountDir);
                if (!TrySaveCurrentBattleNetSessionSnapshot(accountDir, account.Region, requireExactRegion: false))
                    return false;

                account.LastUsed = DateTime.Now;
                SaveAccounts(accounts);
                return true;
            }
            finally
            {
                RelaunchBattleNetAfterCaptureIfNeeded(shouldRelaunchBattleNet, account.Region);
            }
        }

        public async Task<bool> SwitchAccountAsync(string id)
        {
            var result = await SwitchAccountDetailedAsync(id).ConfigureAwait(false);
            return result.Success;
        }

        public async Task<SwitchAccountResult> SwitchAccountDetailedAsync(string id)
        {
            var accountDir = Path.Combine(_dataDir, id);
            var savedConfig = Path.Combine(accountDir, "Battle.net.config");

            if (!File.Exists(savedConfig))
                return new SwitchAccountResult { Success = false, Error = "missing_config" };

            var accounts = GetAccounts();
            var targetAccount = accounts.FirstOrDefault(a => a.Id == id);
            if (targetAccount == null)
                return new SwitchAccountResult { Success = false, Error = "missing_account" };

            if (!IsTaggedAccountRegion(targetAccount.Region))
            {
                await SwitchWithOfficialFastPathAsync().ConfigureAwait(false);

                if (File.Exists(_configFilePath))
                    File.Delete(_configFilePath);

                File.Copy(savedConfig, _configFilePath, true);
                targetAccount.LastUsed = DateTime.Now;
                SaveAccounts(accounts);

                LaunchBattleNet();
                return new SwitchAccountResult
                {
                    Success = true,
                    RequiresManualLaunch = false,
                    Error = "untagged_region"
                };
            }

            var activeAccount = accounts
                .OrderByDescending(a => a.LastUsed)
                .FirstOrDefault();

            var activeRegion = GetActiveBattleNetRegion(activeAccount);
            var isCrossRegion = IsCrossRegionSwitch(activeRegion, targetAccount.Region);
            var hasSessionState = HasBattleNetSessionState(accountDir);
            var requiresCleanLogin = isCrossRegion && !hasSessionState;

            var shouldUseFullReset = hasSessionState || requiresCleanLogin;
            var shouldRefreshLeavingAccount = ShouldRefreshLeavingAccount(activeAccount, targetAccount, activeRegion);

            if (shouldUseFullReset || shouldRefreshLeavingAccount)
            {
                if (!await PrepareBattleNetSessionCaptureAsync().ConfigureAwait(false))
                    return new SwitchAccountResult { Success = false, Error = "client_exit_timeout" };

                if (shouldRefreshLeavingAccount && activeAccount != null)
                    TryRefreshLeavingAccountSessionState(activeAccount, activeRegion);

                if (shouldUseFullReset)
                {
                    ClearBattleNetRegionCaches();
                    ClearBattleNetAuthRegistryState();
                }
            }
            else
            {
                await SwitchWithOfficialFastPathAsync().ConfigureAwait(false);
            }

            if (File.Exists(_configFilePath))
                File.Delete(_configFilePath);

            if (hasSessionState)
            {
                RestoreBattleNetSessionState(accountDir);
                File.Copy(savedConfig, _configFilePath, true);
            }
            else if (requiresCleanLogin)
            {
                WriteCrossRegionLoginConfig(savedConfig, _configFilePath, targetAccount.Region);
            }
            else
            {
                File.Copy(savedConfig, _configFilePath, true);
            }

            targetAccount.LastUsed = DateTime.Now;
            SaveAccounts(accounts);

            LaunchBattleNet(targetAccount.Region);

            return new SwitchAccountResult
            {
                Success = true,
                RequiresManualLaunch = false,
                Error = requiresCleanLogin ? "missing_session_state" : ""
            };
        }

        public void DeleteAccount(string id)
        {
            var accounts = GetAccounts();
            accounts.RemoveAll(a => a.Id == id);
            SaveAccounts(accounts);

            var accountDir = Path.Combine(_dataDir, id);
            if (Directory.Exists(accountDir))
                Directory.Delete(accountDir, true);
        }

        public async Task<bool> AddNewAccountAsync(string region)
        {
            var normalizedRegion = NormalizeAccountRegion(region);
            if (!IsTaggedAccountRegion(normalizedRegion))
                return false;

            if (!await SwitchAfterBattleNetResetAsync().ConfigureAwait(false))
                return false;

            WriteNewAccountLoginConfig(normalizedRegion);
            LaunchBattleNet(normalizedRegion);
            return true;
        }

        public bool GetAutoStartStatus()
        {
            try {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(RegistryKeyPath);
                var val = key?.GetValue(AppIdentity.AutoStartRegistryValueName) as string;
                return val != null;
            } catch { return false; }
        }

        public void SetAutoStart(bool enabled)
        {
            try {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(RegistryKeyPath, true);
                if (enabled) {
                    var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
                    if (!string.IsNullOrEmpty(exePath))
                        key?.SetValue(AppIdentity.AutoStartRegistryValueName, exePath);
                } else {
                    key?.DeleteValue(AppIdentity.AutoStartRegistryValueName, false);
                }
            } catch { }
        }

        private async Task SwitchWithOfficialFastPathAsync()
        {
            KillBattleNetProcesses();
            await Task.Delay(1500).ConfigureAwait(false);
        }

        private static async Task<bool> SwitchAfterBattleNetResetAsync()
        {
            RequestBattleNetClientClose();

            var fullyExited = await EnsureBattleNetClientCleanlyExitedAsync(
                TimeSpan.FromSeconds(3),
                TimeSpan.FromSeconds(30)).ConfigureAwait(false);

            if (!fullyExited)
                return false;

            KillBattleNetProcesses(GetBattleNetAgentProcesses());
            await Task.Delay(1000).ConfigureAwait(false);
            ClearBattleNetRegionCaches();
            ClearBattleNetAuthRegistryState();
            return true;
        }

        private static async Task<bool> PrepareBattleNetSessionCaptureAsync()
        {
            RequestBattleNetClientClose();

            var fullyExited = await EnsureBattleNetClientCleanlyExitedAsync(
                TimeSpan.FromSeconds(3),
                TimeSpan.FromSeconds(30)).ConfigureAwait(false);

            if (!fullyExited)
                return false;

            KillBattleNetProcesses(GetBattleNetAgentProcesses());
            await Task.Delay(1000).ConfigureAwait(false);
            return true;
        }

        private static async Task<bool> EnsureBattleNetClientCleanlyExitedAsync(TimeSpan stableExitDelay, TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow + timeout;
            DateTime? clientEmptySince = null;

            while (DateTime.UtcNow < deadline)
            {
                var clientProcesses = GetBattleNetClientProcesses();
                if (clientProcesses.Count == 0)
                {
                    clientEmptySince ??= DateTime.UtcNow;
                    if (DateTime.UtcNow - clientEmptySince.Value >= stableExitDelay)
                        return true;
                }
                else
                {
                    clientEmptySince = null;
                    RequestBattleNetClientClose(clientProcesses);
                }

                await Task.Delay(500).ConfigureAwait(false);
            }

            return false;
        }

        private string GetActiveBattleNetRegion(AccountInfo? trackedActiveAccount)
        {
            var currentConfigRegion = InferRegionFromBattleNetConfig(_configFilePath);
            if (IsTaggedAccountRegion(currentConfigRegion))
                return currentConfigRegion;

            return NormalizeAccountRegion(trackedActiveAccount?.Region ?? UnsetAccountRegion);
        }

        private static bool IsCrossRegionSwitch(string activeRegion, string targetRegion)
        {
            targetRegion = NormalizeAccountRegion(targetRegion);
            if (!IsTaggedAccountRegion(targetRegion))
                return false;

            activeRegion = NormalizeAccountRegion(activeRegion);
            if (!IsTaggedAccountRegion(activeRegion))
                return true;

            return activeRegion != targetRegion;
        }

        private bool ShouldRefreshLeavingAccount(AccountInfo? activeAccount, AccountInfo targetAccount, string activeRegion)
        {
            if (activeAccount == null)
                return false;

            if (string.Equals(activeAccount.Id, targetAccount.Id, StringComparison.OrdinalIgnoreCase))
                return false;

            if (!File.Exists(_configFilePath))
                return false;

            var activeAccountRegion = NormalizeAccountRegion(activeAccount.Region);
            if (!IsTaggedAccountRegion(activeAccountRegion))
                return false;

            var currentConfigRegion = InferRegionFromBattleNetConfig(_configFilePath);
            if (!IsTaggedAccountRegion(currentConfigRegion))
                return false;

            if (NormalizeAccountRegion(activeRegion) != currentConfigRegion)
                return false;

            return activeAccountRegion == currentConfigRegion;
        }

        private bool TryRefreshLeavingAccountSessionState(AccountInfo activeAccount, string activeRegion)
        {
            try
            {
                var activeAccountRegion = NormalizeAccountRegion(activeAccount.Region);
                if (!IsTaggedAccountRegion(activeAccountRegion) || activeAccountRegion != NormalizeAccountRegion(activeRegion))
                    return false;

                var accountDir = Path.Combine(_dataDir, activeAccount.Id);
                return TrySaveCurrentBattleNetSessionSnapshot(accountDir, activeAccountRegion, requireExactRegion: true);
            }
            catch
            {
                return false;
            }
        }

        private static void RequestBattleNetClientClose()
        {
            RequestBattleNetClientClose(GetBattleNetClientProcesses());
        }

        private static void RequestBattleNetClientClose(IEnumerable<Process> processes)
        {
            foreach (var proc in processes)
            {
                using (proc)
                {
                    try
                    {
                        if (proc.HasExited)
                            continue;

                        proc.Refresh();
                        if (proc.MainWindowHandle != IntPtr.Zero)
                            proc.CloseMainWindow();
                    }
                    catch
                    {
                    }
                }
            }
        }

        private static void KillBattleNetProcesses()
        {
            KillBattleNetProcesses(GetBattleNetProcesses());
        }

        private static void KillBattleNetProcesses(IEnumerable<Process> processes)
        {
            foreach (var proc in processes)
            {
                using (proc)
                {
                    try
                    {
                        if (!proc.HasExited)
                        {
                            proc.Kill();
                            proc.WaitForExit(1000);
                        }
                    }
                    catch
                    {
                    }
                }
            }
        }

        private static async Task<bool> WaitForBattleNetExitAsync(TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow + timeout;
            while (DateTime.UtcNow < deadline)
            {
                if (!IsBattleNetRunning())
                    return true;

                await Task.Delay(500).ConfigureAwait(false);
            }

            return !IsBattleNetRunning();
        }

        private static bool IsBattleNetRunning()
        {
            foreach (var proc in GetBattleNetProcesses())
            {
                using (proc)
                    return true;
            }

            return false;
        }

        private static List<Process> GetBattleNetProcesses()
        {
            return Process.GetProcesses()
                .Where(proc => IsBattleNetProcessName(proc.ProcessName))
                .ToList();
        }

        private static List<Process> GetBattleNetClientProcesses()
        {
            return Process.GetProcesses()
                .Where(proc => IsBattleNetClientProcessName(proc.ProcessName))
                .ToList();
        }

        private static bool IsBattleNetClientRunning()
        {
            return GetBattleNetClientProcesses().Count > 0;
        }

        private void RelaunchBattleNetAfterCaptureIfNeeded(bool shouldRelaunchBattleNet, string region)
        {
            if (!shouldRelaunchBattleNet)
                return;

            LaunchBattleNet(region);
        }

        private static List<Process> GetBattleNetAgentProcesses()
        {
            return Process.GetProcessesByName("Agent").ToList();
        }

        private static bool IsBattleNetProcessName(string processName)
        {
            return string.Equals(processName, "Agent", StringComparison.OrdinalIgnoreCase)
                || IsBattleNetClientProcessName(processName);
        }

        private static bool IsBattleNetClientProcessName(string processName)
        {
            return processName.StartsWith("Battle.net", StringComparison.OrdinalIgnoreCase);
        }

        private static void ClearBattleNetRegionCaches()
        {
            var localBattleNetDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Battle.net");

            var backupRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppIdentity.AppName,
                "BattleNetLocalStateBackups",
                DateTime.Now.ToString("yyyyMMdd_HHmmss"));

            BackupAndDeleteDirectory(Path.Combine(localBattleNetDir, "Account"), Path.Combine(backupRoot, "Account"));
            TryDeleteDirectory(Path.Combine(localBattleNetDir, "BrowserCaches"));
            TryDeleteDirectory(Path.Combine(localBattleNetDir, "Cache"));
            TryDeleteFile(Path.Combine(localBattleNetDir, "CachedData.db"));
            PruneOldBattleNetLocalStateBackups();
        }

        private static void ClearBattleNetAuthRegistryState()
        {
            var backupRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppIdentity.AppName,
                "BattleNetRegistryBackups",
                DateTime.Now.ToString("yyyyMMdd_HHmmss"));

            var records = new List<RegistryValueBackup>();
            BackupAndDeleteRegistryValues(
                @"Software\Blizzard Entertainment\Battle.net\UnifiedAuth",
                records,
                valueNameToDelete: null);
            BackupAndDeleteRegistryValues(
                @"Software\Blizzard Entertainment\Battle.net\Identity",
                records,
                valueNameToDelete: null);
            BackupAndDeleteRegistryValues(
                @"Software\Blizzard Entertainment\Battle.net\EncryptionKey",
                records,
                valueNameToDelete: null);
            BackupAndDeleteRegistryValues(
                @"Software\Blizzard Entertainment\Battle.net\Launch Options",
                records,
                valueNameToDelete: "URI_TOKEN");

            if (records.Count > 0)
            {
                try
                {
                    Directory.CreateDirectory(backupRoot);
                    File.WriteAllText(
                        Path.Combine(backupRoot, "registry-values.json"),
                        JsonSerializer.Serialize(records));
                }
                catch
                {
                }
            }

            PruneOldBattleNetRegistryBackups();
        }

        private static string GetBattleNetSessionStateDir(string accountDir)
        {
            return Path.Combine(accountDir, "BattleNetSessionState");
        }

        private static string GetBattleNetSessionStateCandidateDir(string accountDir)
        {
            return Path.Combine(accountDir, "BattleNetSessionStateCandidate");
        }

        private static string GetBattleNetSessionStateBackupDir(string accountDir)
        {
            return Path.Combine(accountDir, "BattleNetSessionStateBackup");
        }

        private static string GetBattleNetSessionStateMetadataPathFromStateDir(string stateDir)
        {
            return Path.Combine(stateDir, "metadata.json");
        }

        private static string GetBattleNetSessionStateMetadataPath(string accountDir)
        {
            return GetBattleNetSessionStateMetadataPathFromStateDir(GetBattleNetSessionStateDir(accountDir));
        }

        private static bool HasBattleNetSessionState(string accountDir)
        {
            return IsUsableBattleNetSessionState(GetBattleNetSessionStateDir(accountDir));
        }

        private static DateTime? GetBattleNetSessionStateCapturedAtUtc(string accountDir)
        {
            var metadataPath = GetBattleNetSessionStateMetadataPath(accountDir);
            try
            {
                if (File.Exists(metadataPath))
                {
                    var metadata = JsonSerializer.Deserialize<BattleNetSessionStateMetadata>(File.ReadAllText(metadataPath));
                    var capturedAtUtc = metadata?.CapturedAtUtc;
                    if (capturedAtUtc.HasValue && capturedAtUtc.Value != default)
                        return capturedAtUtc.Value.Kind == DateTimeKind.Utc
                            ? capturedAtUtc.Value
                            : capturedAtUtc.Value.ToUniversalTime();
                }
            }
            catch
            {
            }

            try
            {
                var stateDir = GetBattleNetSessionStateDir(accountDir);
                if (Directory.Exists(stateDir))
                    return Directory.GetLastWriteTimeUtc(stateDir);
            }
            catch
            {
            }

            return null;
        }

        private bool TrySaveCurrentBattleNetSessionSnapshot(string accountDir, string expectedRegion, bool requireExactRegion)
        {
            if (!File.Exists(_configFilePath))
                return false;

            var normalizedExpectedRegion = NormalizeAccountRegion(expectedRegion);
            if (requireExactRegion)
            {
                var currentConfigRegion = InferRegionFromBattleNetConfig(_configFilePath);
                if (!IsTaggedAccountRegion(currentConfigRegion) || currentConfigRegion != normalizedExpectedRegion)
                    return false;
            }

            var candidateDir = GetBattleNetSessionStateCandidateDir(accountDir);
            var candidateConfig = Path.Combine(accountDir, "Battle.net.config.candidate");
            var savedConfig = Path.Combine(accountDir, "Battle.net.config");

            try
            {
                Directory.CreateDirectory(accountDir);
                TryDeleteDirectory(candidateDir);
                TryDeleteFile(candidateConfig);

                if (!SaveBattleNetSessionStateToDirectory(candidateDir))
                    return false;

                if (!IsUsableBattleNetSessionState(candidateDir))
                {
                    TryDeleteDirectory(candidateDir);
                    return false;
                }

                File.Copy(_configFilePath, candidateConfig, true);

                if (!TryCommitBattleNetSessionState(candidateDir, accountDir))
                {
                    TryDeleteDirectory(candidateDir);
                    TryDeleteFile(candidateConfig);
                    return false;
                }

                File.Copy(candidateConfig, savedConfig, true);
                TryDeleteFile(candidateConfig);
                return true;
            }
            catch
            {
                TryDeleteDirectory(candidateDir);
                TryDeleteFile(candidateConfig);
                return false;
            }
        }

        private static bool SaveBattleNetSessionStateToDirectory(string stateDir)
        {
            TryDeleteDirectory(stateDir);

            try
            {
                Directory.CreateDirectory(stateDir);

                var localBattleNetDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Battle.net");
                var localStateDir = Path.Combine(stateDir, "Local");

                CopyDirectoryBestEffort(Path.Combine(localBattleNetDir, "Account"), Path.Combine(localStateDir, "Account"));
                CopyDirectoryBestEffort(Path.Combine(localBattleNetDir, "BrowserCaches"), Path.Combine(localStateDir, "BrowserCaches"));
                CopyDirectoryBestEffort(Path.Combine(localBattleNetDir, "Cache"), Path.Combine(localStateDir, "Cache"));
                CopyFileBestEffort(Path.Combine(localBattleNetDir, "CachedData.db"), Path.Combine(localStateDir, "CachedData.db"));

                SaveBattleNetAuthRegistrySnapshot(Path.Combine(stateDir, "Registry", "registry-values.json"));
                File.WriteAllText(
                    GetBattleNetSessionStateMetadataPathFromStateDir(stateDir),
                    JsonSerializer.Serialize(new BattleNetSessionStateMetadata { CapturedAtUtc = DateTime.UtcNow }));
                return true;
            }
            catch
            {
                TryDeleteDirectory(stateDir);
                return false;
            }
        }

        private static bool TryCommitBattleNetSessionState(string candidateDir, string accountDir)
        {
            if (!Directory.Exists(candidateDir))
                return false;

            var stateDir = GetBattleNetSessionStateDir(accountDir);
            var backupDir = GetBattleNetSessionStateBackupDir(accountDir);

            try
            {
                TryDeleteDirectory(backupDir);

                if (Directory.Exists(stateDir))
                    Directory.Move(stateDir, backupDir);

                Directory.Move(candidateDir, stateDir);
                return true;
            }
            catch
            {
                try
                {
                    if (!Directory.Exists(stateDir) && Directory.Exists(backupDir))
                        Directory.Move(backupDir, stateDir);
                }
                catch
                {
                }

                return false;
            }
        }

        private static bool IsUsableBattleNetSessionState(string stateDir)
        {
            if (!Directory.Exists(stateDir))
                return false;

            if (!File.Exists(GetBattleNetSessionStateMetadataPathFromStateDir(stateDir)))
                return false;

            var registryPath = Path.Combine(stateDir, "Registry", "registry-values.json");
            var localStateDir = Path.Combine(stateDir, "Local");
            return HasUsableRegistrySnapshot(registryPath) && HasLocalSessionState(localStateDir);
        }

        private static bool HasUsableRegistrySnapshot(string registryPath)
        {
            if (!File.Exists(registryPath))
                return false;

            try
            {
                var records = JsonSerializer.Deserialize<List<RegistryValueBackup>>(File.ReadAllText(registryPath))
                    ?? new List<RegistryValueBackup>();

                return records.Any(record =>
                    !string.IsNullOrWhiteSpace(record.Data)
                    && (
                        record.KeyPath.Contains(@"\UnifiedAuth", StringComparison.OrdinalIgnoreCase)
                        || record.KeyPath.Contains(@"\Identity", StringComparison.OrdinalIgnoreCase)
                        || record.KeyPath.Contains(@"\EncryptionKey", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(record.ValueName, "URI_TOKEN", StringComparison.OrdinalIgnoreCase)
                    ));
            }
            catch
            {
                return false;
            }
        }

        private static bool HasLocalSessionState(string localStateDir)
        {
            try
            {
                if (HasAnyFile(Path.Combine(localStateDir, "Account")))
                    return true;

                if (HasAnyFile(Path.Combine(localStateDir, "BrowserCaches")))
                    return true;

                if (HasAnyFile(Path.Combine(localStateDir, "Cache")))
                    return true;

                var cachedDataPath = Path.Combine(localStateDir, "CachedData.db");
                return File.Exists(cachedDataPath) && new FileInfo(cachedDataPath).Length > 0;
            }
            catch
            {
                return false;
            }
        }

        private static bool HasAnyFile(string directory)
        {
            try
            {
                return Directory.Exists(directory)
                    && Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories).Any();
            }
            catch
            {
                return false;
            }
        }

        private static void RestoreBattleNetSessionState(string accountDir)
        {
            var stateDir = GetBattleNetSessionStateDir(accountDir);
            if (!Directory.Exists(stateDir))
                return;

            try
            {
                var localBattleNetDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Battle.net");
                var localStateDir = Path.Combine(stateDir, "Local");

                RestoreDirectorySnapshot(Path.Combine(localStateDir, "Account"), Path.Combine(localBattleNetDir, "Account"));
                RestoreDirectorySnapshot(Path.Combine(localStateDir, "BrowserCaches"), Path.Combine(localBattleNetDir, "BrowserCaches"));
                RestoreDirectorySnapshot(Path.Combine(localStateDir, "Cache"), Path.Combine(localBattleNetDir, "Cache"));
                RestoreFileSnapshot(Path.Combine(localStateDir, "CachedData.db"), Path.Combine(localBattleNetDir, "CachedData.db"));

                RestoreBattleNetAuthRegistrySnapshot(Path.Combine(stateDir, "Registry", "registry-values.json"));
            }
            catch
            {
            }
        }

        private static void SaveBattleNetAuthRegistrySnapshot(string destinationPath)
        {
            var records = new List<RegistryValueBackup>();
            CollectRegistryValues(@"Software\Blizzard Entertainment\Battle.net\UnifiedAuth", records, valueNameToCapture: null);
            CollectRegistryValues(@"Software\Blizzard Entertainment\Battle.net\Identity", records, valueNameToCapture: null);
            CollectRegistryValues(@"Software\Blizzard Entertainment\Battle.net\EncryptionKey", records, valueNameToCapture: null);
            CollectRegistryValues(@"Software\Blizzard Entertainment\Battle.net\Launch Options", records, valueNameToCapture: "URI_TOKEN");

            if (records.Count == 0)
                return;

            var parent = Path.GetDirectoryName(destinationPath);
            if (!string.IsNullOrEmpty(parent))
                Directory.CreateDirectory(parent);

            File.WriteAllText(destinationPath, JsonSerializer.Serialize(records));
        }

        private static void CollectRegistryValues(
            string keyPath,
            List<RegistryValueBackup> records,
            string? valueNameToCapture)
        {
            try
            {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(keyPath, writable: false);
                if (key == null)
                    return;

                var valueNames = valueNameToCapture == null
                    ? key.GetValueNames()
                    : key.GetValueNames()
                        .Where(name => string.Equals(name, valueNameToCapture, StringComparison.OrdinalIgnoreCase))
                        .ToArray();

                foreach (var valueName in valueNames)
                {
                    var value = key.GetValue(valueName, null, Microsoft.Win32.RegistryValueOptions.DoNotExpandEnvironmentNames);
                    var valueKind = key.GetValueKind(valueName);
                    records.Add(new RegistryValueBackup
                    {
                        KeyPath = keyPath,
                        ValueName = valueName,
                        ValueKind = valueKind.ToString(),
                        Data = SerializeRegistryValue(value)
                    });
                }
            }
            catch
            {
            }
        }

        private static void RestoreBattleNetAuthRegistrySnapshot(string sourcePath)
        {
            if (!File.Exists(sourcePath))
                return;

            try
            {
                DeleteRegistryValues(@"Software\Blizzard Entertainment\Battle.net\UnifiedAuth", valueNameToDelete: null);
                DeleteRegistryValues(@"Software\Blizzard Entertainment\Battle.net\Identity", valueNameToDelete: null);
                DeleteRegistryValues(@"Software\Blizzard Entertainment\Battle.net\EncryptionKey", valueNameToDelete: null);
                DeleteRegistryValues(@"Software\Blizzard Entertainment\Battle.net\Launch Options", valueNameToDelete: "URI_TOKEN");

                var records = JsonSerializer.Deserialize<List<RegistryValueBackup>>(File.ReadAllText(sourcePath))
                    ?? new List<RegistryValueBackup>();

                foreach (var record in records)
                {
                    using var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(record.KeyPath, writable: true);
                    if (key == null || string.IsNullOrEmpty(record.ValueName))
                        continue;

                    var kind = ParseRegistryValueKind(record.ValueKind);
                    key.SetValue(record.ValueName, DeserializeRegistryValue(record.Data, kind), kind);
                }
            }
            catch
            {
            }
        }

        private static void DeleteRegistryValues(string keyPath, string? valueNameToDelete)
        {
            try
            {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(keyPath, writable: true);
                if (key == null)
                    return;

                var valueNames = valueNameToDelete == null
                    ? key.GetValueNames()
                    : key.GetValueNames()
                        .Where(name => string.Equals(name, valueNameToDelete, StringComparison.OrdinalIgnoreCase))
                        .ToArray();

                foreach (var valueName in valueNames)
                    key.DeleteValue(valueName, throwOnMissingValue: false);
            }
            catch
            {
            }
        }

        private static void BackupAndDeleteRegistryValues(
            string keyPath,
            List<RegistryValueBackup> records,
            string? valueNameToDelete)
        {
            try
            {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(keyPath, writable: true);
                if (key == null)
                    return;

                var valueNames = valueNameToDelete == null
                    ? key.GetValueNames()
                    : key.GetValueNames()
                        .Where(name => string.Equals(name, valueNameToDelete, StringComparison.OrdinalIgnoreCase))
                        .ToArray();

                foreach (var valueName in valueNames)
                {
                    var value = key.GetValue(valueName, null, Microsoft.Win32.RegistryValueOptions.DoNotExpandEnvironmentNames);
                    var valueKind = key.GetValueKind(valueName);
                    records.Add(new RegistryValueBackup
                    {
                        KeyPath = keyPath,
                        ValueName = valueName,
                        ValueKind = valueKind.ToString(),
                        Data = SerializeRegistryValue(value)
                    });

                    key.DeleteValue(valueName, throwOnMissingValue: false);
                }
            }
            catch
            {
            }
        }

        private static string SerializeRegistryValue(object? value)
        {
            return value switch
            {
                byte[] bytes => Convert.ToBase64String(bytes),
                string text => text,
                string[] textArray => JsonSerializer.Serialize(textArray),
                int intValue => intValue.ToString(),
                long longValue => longValue.ToString(),
                _ => value?.ToString() ?? ""
            };
        }

        private static object DeserializeRegistryValue(string data, Microsoft.Win32.RegistryValueKind kind)
        {
            try
            {
                return kind switch
                {
                    Microsoft.Win32.RegistryValueKind.Binary => Convert.FromBase64String(data),
                    Microsoft.Win32.RegistryValueKind.DWord => int.TryParse(data, out var intValue) ? intValue : 0,
                    Microsoft.Win32.RegistryValueKind.QWord => long.TryParse(data, out var longValue) ? longValue : 0L,
                    Microsoft.Win32.RegistryValueKind.MultiString => JsonSerializer.Deserialize<string[]>(data) ?? Array.Empty<string>(),
                    _ => data
                };
            }
            catch
            {
                return kind == Microsoft.Win32.RegistryValueKind.Binary ? Array.Empty<byte>() : data;
            }
        }

        private static Microsoft.Win32.RegistryValueKind ParseRegistryValueKind(string valueKind)
        {
            return Enum.TryParse<Microsoft.Win32.RegistryValueKind>(valueKind, out var kind)
                ? kind
                : Microsoft.Win32.RegistryValueKind.String;
        }

        private static void PruneOldBattleNetRegistryBackups()
        {
            try
            {
                var backupsRoot = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    AppIdentity.AppName,
                    "BattleNetRegistryBackups");

                if (!Directory.Exists(backupsRoot))
                    return;

                foreach (var directory in Directory.GetDirectories(backupsRoot)
                    .Select(path => new DirectoryInfo(path))
                    .OrderByDescending(info => info.CreationTimeUtc)
                    .Skip(3))
                {
                    TryDeleteDirectory(directory.FullName);
                }
            }
            catch
            {
            }
        }

        private void WriteNewAccountLoginConfig(string targetRegion)
        {
            Directory.CreateDirectory(_appDataPath);
            TryDeleteFile(_configFilePath);
            File.WriteAllText(_configFilePath, CreateMinimalLoginConfig(targetRegion).ToJsonString());
        }

        private static JsonObject CreateMinimalLoginConfig(string targetRegion)
        {
            var regionSettings = GetBattleNetRegionSettings(targetRegion);
            return new JsonObject
            {
                ["Client"] = new JsonObject
                {
                    ["LoginSettings"] = new JsonObject
                    {
                        ["AllowedRegions"] = regionSettings.AllowedRegions,
                        ["AllowedLocales"] = regionSettings.AllowedLocales
                    }
                },
                ["Services"] = new JsonObject
                {
                    ["LastLoginAddress"] = regionSettings.LoginAddress,
                    ["LastLoginRegion"] = regionSettings.LoginRegion,
                    ["LastLoginTassadar"] = regionSettings.TassadarHost
                }
            };
        }

        private static void WriteCrossRegionLoginConfig(string sourcePath, string destinationPath, string targetRegion)
        {
            try
            {
                var root = JsonNode.Parse(File.ReadAllText(sourcePath))?.AsObject();
                if (root == null)
                {
                    File.Copy(sourcePath, destinationPath, true);
                    return;
                }

                if (root["Client"] is JsonObject client)
                {
                    client.Remove("AutoLogin");
                    client.Remove("AutoLoginCN");
                    client.Remove("RememberAccountName");
                    client.Remove("SavedAccountNames");
                }

                var regionSettings = GetBattleNetRegionSettings(targetRegion);
                ApplyBattleNetRegionSettings(root, regionSettings, createMissingNodes: true);
                foreach (var property in root.ToList())
                {
                    if (property.Value is not JsonObject section)
                        continue;

                    ApplyBattleNetRegionSettings(section, regionSettings, createMissingNodes: false);
                }

                File.WriteAllText(destinationPath, root.ToJsonString());
            }
            catch
            {
                File.Copy(sourcePath, destinationPath, true);
            }
        }

        private static void ApplyBattleNetRegionSettings(
            JsonObject section,
            BattleNetRegionSettings regionSettings,
            bool createMissingNodes)
        {
            var loginSettings = section["Client"]?["LoginSettings"] as JsonObject;
            if (loginSettings == null && createMissingNodes)
            {
                var client = section["Client"] as JsonObject;
                if (client == null)
                {
                    client = new JsonObject();
                    section["Client"] = client;
                }

                loginSettings = client["LoginSettings"] as JsonObject;
                if (loginSettings == null)
                {
                    loginSettings = new JsonObject();
                    client["LoginSettings"] = loginSettings;
                }
            }

            if (loginSettings != null)
            {
                loginSettings["AllowedRegions"] = regionSettings.AllowedRegions;
                loginSettings["AllowedLocales"] = regionSettings.AllowedLocales;
            }

            var services = section["Services"] as JsonObject;
            if (services == null && createMissingNodes)
            {
                services = new JsonObject();
                section["Services"] = services;
            }

            if (services != null)
            {
                services["LastLoginAddress"] = regionSettings.LoginAddress;
                services["LastLoginRegion"] = regionSettings.LoginRegion;
                services["LastLoginTassadar"] = regionSettings.TassadarHost;
            }
        }

        private static BattleNetRegionSettings GetBattleNetRegionSettings(string targetRegion)
        {
            return NormalizeAccountRegion(targetRegion) switch
            {
                RegionChina => new BattleNetRegionSettings("CN", "zhCN", "cn.actual.battlenet.com.cn", "CN", "account.battlenet.com.cn"),
                RegionAmericas => new BattleNetRegionSettings("US", "", "us.actual.battle.net", "US", "account.battle.net"),
                RegionEurope => new BattleNetRegionSettings("EU", "", "eu.actual.battle.net", "EU", "account.battle.net"),
                _ => new BattleNetRegionSettings("", "", "kr.actual.battle.net", "KR", "account.battle.net")
            };
        }

        private static void BackupAndDeleteDirectory(string sourcePath, string backupPath)
        {
            if (!Directory.Exists(sourcePath))
                return;

            try
            {
                var parent = Path.GetDirectoryName(backupPath);
                if (!string.IsNullOrEmpty(parent))
                    Directory.CreateDirectory(parent);

                CopyDirectory(sourcePath, backupPath);
            }
            catch
            {
            }

            TryDeleteDirectory(sourcePath);
        }

        private static void RestoreDirectorySnapshot(string sourcePath, string destinationPath)
        {
            TryDeleteDirectory(destinationPath);
            if (Directory.Exists(sourcePath))
                CopyDirectoryBestEffort(sourcePath, destinationPath);
        }

        private static void RestoreFileSnapshot(string sourcePath, string destinationPath)
        {
            TryDeleteFile(destinationPath);
            CopyFileBestEffort(sourcePath, destinationPath);
        }

        private static void CopyDirectoryBestEffort(string sourceDir, string destinationDir)
        {
            try
            {
                if (!Directory.Exists(sourceDir))
                    return;

                Directory.CreateDirectory(destinationDir);

                foreach (var file in Directory.GetFiles(sourceDir))
                {
                    var destinationPath = Path.Combine(destinationDir, Path.GetFileName(file));
                    CopyFileBestEffort(file, destinationPath);
                }

                foreach (var directory in Directory.GetDirectories(sourceDir))
                {
                    var destinationPath = Path.Combine(destinationDir, Path.GetFileName(directory));
                    CopyDirectoryBestEffort(directory, destinationPath);
                }
            }
            catch
            {
            }
        }

        private static void CopyFileBestEffort(string sourcePath, string destinationPath)
        {
            try
            {
                if (!File.Exists(sourcePath))
                    return;

                var parent = Path.GetDirectoryName(destinationPath);
                if (!string.IsNullOrEmpty(parent))
                    Directory.CreateDirectory(parent);

                using var source = new FileStream(
                    sourcePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.ReadWrite | FileShare.Delete);
                using var destination = new FileStream(
                    destinationPath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None);
                source.CopyTo(destination);
            }
            catch
            {
            }
        }

        private static void PruneOldBattleNetLocalStateBackups()
        {
            try
            {
                var backupsRoot = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    AppIdentity.AppName,
                    "BattleNetLocalStateBackups");

                if (!Directory.Exists(backupsRoot))
                    return;

                foreach (var directory in Directory.GetDirectories(backupsRoot)
                    .Select(path => new DirectoryInfo(path))
                    .OrderByDescending(info => info.CreationTimeUtc)
                    .Skip(3))
                {
                    TryDeleteDirectory(directory.FullName);
                }
            }
            catch
            {
            }
        }

        private static void TryDeleteDirectory(string path)
        {
            try
            {
                if (Directory.Exists(path))
                    Directory.Delete(path, true);
            }
            catch
            {
            }
        }

        private static bool TryCopyFile(string sourcePath, string destinationPath)
        {
            try
            {
                if (!File.Exists(sourcePath))
                    return false;

                var parent = Path.GetDirectoryName(destinationPath);
                if (!string.IsNullOrEmpty(parent))
                    Directory.CreateDirectory(parent);

                using var source = new FileStream(
                    sourcePath,
                    FileMode.Open,
                    FileAccess.Read,
                    FileShare.ReadWrite | FileShare.Delete);
                using var destination = new FileStream(
                    destinationPath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None);
                source.CopyTo(destination);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static void TryDeleteFile(string path)
        {
            try
            {
                if (File.Exists(path))
                    File.Delete(path);
            }
            catch
            {
            }
        }

        private void LaunchBattleNet(string region = UnsetAccountRegion)
        {
            try
            {
                string exePath = @"C:\Program Files (x86)\Battle.net\Battle.net.exe";
                if (!File.Exists(exePath))
                {
                    using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Battle.net"))
                    {
                        if (key != null)
                        {
                            var installLoc = key.GetValue("InstallLocation")?.ToString();
                            if (!string.IsNullOrEmpty(installLoc))
                                exePath = Path.Combine(installLoc, "Battle.net.exe");
                        }
                    }
                }

                if (File.Exists(exePath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = exePath,
                        UseShellExecute = true
                    });
                }
            }
            catch { }
        }

        private List<GroupInfo> ReadGroups()
        {
            try
            {
                if (!File.Exists(_groupsJsonPath))
                    return new List<GroupInfo> { CreateDefaultGroup() };

                var json = File.ReadAllText(_groupsJsonPath);
                var groups = JsonSerializer.Deserialize<List<GroupInfo>>(json) ?? new List<GroupInfo>();
                NormalizeGroups(groups);
                return groups;
            }
            catch
            {
                return new List<GroupInfo> { CreateDefaultGroup() };
            }
        }

        private void SaveGroups(List<GroupInfo> groups)
        {
            NormalizeGroups(groups);
            File.WriteAllText(_groupsJsonPath, JsonSerializer.Serialize(groups));
        }

        private static GroupInfo CreateDefaultGroup()
        {
            return new GroupInfo
            {
                Id = DefaultGroupId,
                Name = DefaultGroupName,
                CreatedAt = DateTime.MinValue
            };
        }

        private static void NormalizeGroups(List<GroupInfo> groups)
        {
            groups.RemoveAll(g => string.IsNullOrWhiteSpace(g.Id));

            var defaultGroup = groups.FirstOrDefault(g => g.Id == DefaultGroupId);
            if (defaultGroup == null)
            {
                groups.Insert(0, CreateDefaultGroup());
            }
            else
            {
                defaultGroup.Name = DefaultGroupName;
                defaultGroup.CreatedAt = DateTime.MinValue;
                groups.Remove(defaultGroup);
                groups.Insert(0, defaultGroup);
            }

            foreach (var group in groups)
            {
                group.Name = NormalizeGroupName(group.Name);
                if (string.IsNullOrEmpty(group.Name))
                    group.Name = "未命名分组";
            }
        }

        private bool NormalizeAccounts(List<AccountInfo> accounts)
        {
            var groups = ReadGroups();
            var validGroupIds = groups.Select(g => g.Id).ToHashSet();
            var changed = false;

            foreach (var account in accounts)
            {
                if (string.IsNullOrEmpty(account.GroupId) || !validGroupIds.Contains(account.GroupId))
                {
                    account.GroupId = DefaultGroupId;
                    changed = true;
                }

                var normalizedRegion = NormalizeAccountRegion(account.Region);
                if (account.Region != normalizedRegion)
                {
                    account.Region = normalizedRegion;
                    changed = true;
                }

                var normalizedAvatar = SanitizeAvatarDataUrl(account.AvatarDataUrl);
                if (account.AvatarDataUrl != normalizedAvatar)
                {
                    account.AvatarDataUrl = normalizedAvatar;
                    changed = true;
                }
            }

            return changed;
        }

        private string EnsureValidGroupId(string groupId)
        {
            if (string.IsNullOrEmpty(groupId))
                return DefaultGroupId;

            var groups = ReadGroups();
            return groups.Any(g => g.Id == groupId) ? groupId : DefaultGroupId;
        }

        private static string NormalizeGroupName(string name)
        {
            return (name ?? "").Trim();
        }

        private static string NormalizeAccountRegion(string region)
        {
            var value = (region ?? "").Trim().ToLowerInvariant();
            return value switch
            {
                RegionAsia => RegionAsia,
                RegionAmericas => RegionAmericas,
                RegionEurope => RegionEurope,
                RegionChina => RegionChina,
                _ => UnsetAccountRegion
            };
        }

        private static bool IsTaggedAccountRegion(string region)
        {
            return NormalizeAccountRegion(region) != UnsetAccountRegion;
        }

        private static string InferRegionFromBattleNetConfig(string path)
        {
            try
            {
                if (!File.Exists(path))
                    return UnsetAccountRegion;

                using var document = JsonDocument.Parse(File.ReadAllText(path));
                var regionValues = new List<(string Name, string Value)>();
                CollectBattleNetRegionValues(document.RootElement, regionValues);

                foreach (var value in regionValues.Where(item =>
                    string.Equals(item.Name, "AllowedRegions", StringComparison.OrdinalIgnoreCase)))
                {
                    var mappedRegion = MapBattleNetRegionCodeToAccountRegion(value.Value);
                    if (IsTaggedAccountRegion(mappedRegion))
                        return mappedRegion;
                }

                foreach (var value in regionValues.Where(item =>
                    string.Equals(item.Name, "LastLoginRegion", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(item.Name, "WebRegion", StringComparison.OrdinalIgnoreCase)))
                {
                    var mappedRegion = MapBattleNetRegionCodeToAccountRegion(value.Value);
                    if (IsTaggedAccountRegion(mappedRegion))
                        return mappedRegion;
                }

                foreach (var value in regionValues)
                {
                    var mappedRegion = MapBattleNetRegionCodeToAccountRegion(value.Value);
                    if (IsTaggedAccountRegion(mappedRegion))
                        return mappedRegion;
                }
            }
            catch
            {
            }

            return UnsetAccountRegion;
        }

        private static void CollectBattleNetRegionValues(JsonElement element, List<(string Name, string Value)> values)
        {
            if (element.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in element.EnumerateObject())
                {
                    if (property.Value.ValueKind == JsonValueKind.String
                        && property.Name.Contains("Region", StringComparison.OrdinalIgnoreCase))
                    {
                        values.Add((property.Name, property.Value.GetString() ?? ""));
                    }

                    CollectBattleNetRegionValues(property.Value, values);
                }
            }
            else if (element.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in element.EnumerateArray())
                    CollectBattleNetRegionValues(item, values);
            }
        }

        private static string MapBattleNetRegionCodeToAccountRegion(string value)
        {
            return (value ?? "").Trim().ToUpperInvariant() switch
            {
                "CN" => RegionChina,
                "US" => RegionAmericas,
                "EU" => RegionEurope,
                "KR" => RegionAsia,
                "TW" => RegionAsia,
                "SG" => RegionAsia,
                _ => UnsetAccountRegion
            };
        }

        private static string SanitizeAvatarDataUrl(string avatarDataUrl)
        {
            var value = (avatarDataUrl ?? "").Trim();
            if (value.Length == 0)
                return "";

            if (value.Length > MaxAvatarDataUrlLength)
                return "";

            var allowedPrefixes = new[]
            {
                "data:image/png;base64,",
                "data:image/jpeg;base64,",
                "data:image/jpg;base64,",
                "data:image/webp;base64,",
                "data:image/gif;base64,"
            };

            return allowedPrefixes.Any(prefix => value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                ? value
                : "";
        }

        private void MigrateLegacyDataIfNeeded()
        {
            try
            {
                Directory.CreateDirectory(_dataDir);

                foreach (var legacyDataDir in GetLegacyDataDirectories())
                    MergeLegacyData(legacyDataDir);
            }
            catch
            {
            }
        }

        private IEnumerable<string> GetLegacyDataDirectories()
        {
            var candidates = new List<string>
            {
                _legacyDataDir,
                Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "Programs",
                    AppIdentity.AppName,
                    "Data")
            };

            var baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(
                Path.DirectorySeparatorChar,
                Path.AltDirectorySeparatorChar);
            var parentDir = Directory.GetParent(baseDir);
            if (parentDir != null)
                candidates.Add(Path.Combine(parentDir.FullName, "Data"));

            try
            {
#if !KM_TEST_BUILD
                AddBetaUpgradeDataDirectories(candidates);

                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Uninstall\KManager_is1");
                var installLocation = key?.GetValue("InstallLocation")?.ToString();
                if (!string.IsNullOrWhiteSpace(installLocation))
                    candidates.Add(Path.Combine(installLocation, "Data"));
#endif
            }
            catch
            {
            }

            var currentDataDir = NormalizePath(_dataDir);
            return candidates
                .Where(Directory.Exists)
                .Select(NormalizePath)
                .Where(path => !string.Equals(path, currentDataDir, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase);
        }

#if !KM_TEST_BUILD
        private static void AddBetaUpgradeDataDirectories(List<string> candidates)
        {
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            candidates.Add(Path.Combine(localAppData, BetaTestAppName, "Data"));
            candidates.Add(Path.Combine(localAppData, "Programs", BetaInstallerAppName, "Data"));
            candidates.Add(Path.Combine(localAppData, "Programs", BetaTestAppName, "Data"));

            try
            {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Windows\CurrentVersion\Uninstall\KManagerRegionSwitchBeta_is1");
                var installLocation = key?.GetValue("InstallLocation")?.ToString();
                if (!string.IsNullOrWhiteSpace(installLocation))
                    candidates.Add(Path.Combine(installLocation, "Data"));
            }
            catch
            {
            }
        }
#endif

        private void MergeLegacyData(string legacyDataDir)
        {
            var accounts = ReadAccountsFromFile(_accountsJsonPath);
            var accountIds = accounts.Select(a => a.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var groups = ReadGroups();
            var groupIds = groups.Select(g => g.Id).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var groupsChanged = false;
            var accountsChanged = false;

            foreach (var legacyGroup in ReadGroupsFromFile(Path.Combine(legacyDataDir, "groups.json")))
            {
                if (string.IsNullOrWhiteSpace(legacyGroup.Id) || groupIds.Contains(legacyGroup.Id))
                    continue;

                groups.Add(legacyGroup);
                groupIds.Add(legacyGroup.Id);
                groupsChanged = true;
            }

            if (groupsChanged)
                SaveGroups(groups);

            foreach (var legacyAccount in ReadAccountsFromFile(Path.Combine(legacyDataDir, "accounts.json")))
            {
                if (string.IsNullOrWhiteSpace(legacyAccount.Id))
                    continue;

                if (string.IsNullOrWhiteSpace(legacyAccount.GroupId) || !groupIds.Contains(legacyAccount.GroupId))
                    legacyAccount.GroupId = DefaultGroupId;

                if (!accountIds.Contains(legacyAccount.Id))
                {
                    accounts.Add(legacyAccount);
                    accountIds.Add(legacyAccount.Id);
                    accountsChanged = true;
                }
                else
                {
                    var existingAccount = accounts.FirstOrDefault(a =>
                        string.Equals(a.Id, legacyAccount.Id, StringComparison.OrdinalIgnoreCase));
                    if (existingAccount != null)
                        accountsChanged |= FillMissingAccountMetadata(existingAccount, legacyAccount);
                }

                CopyAccountDirectory(legacyDataDir, legacyAccount.Id);
            }

            var recoveredIndex = 1;
            foreach (var accountDir in Directory.GetDirectories(legacyDataDir))
            {
                var accountId = Path.GetFileName(accountDir);
                if (string.IsNullOrWhiteSpace(accountId) || accountIds.Contains(accountId))
                    continue;

                if (!File.Exists(Path.Combine(accountDir, "Battle.net.config")))
                    continue;

                accounts.Add(new AccountInfo
                {
                    Id = accountId,
                    Remark = $"恢复账号 {recoveredIndex++}",
                    Username = "",
                    LastUsed = Directory.GetLastWriteTime(accountDir),
                    GroupId = DefaultGroupId,
                    Region = UnsetAccountRegion
                });
                accountIds.Add(accountId);
                accountsChanged = true;

                CopyAccountDirectory(legacyDataDir, accountId);
            }

            if (accountsChanged)
                SaveAccounts(accounts);
        }

        private static bool FillMissingAccountMetadata(AccountInfo target, AccountInfo source)
        {
            var changed = false;

            if (string.IsNullOrWhiteSpace(target.Region) && IsTaggedAccountRegion(source.Region))
            {
                target.Region = source.Region;
                changed = true;
            }

            if (string.IsNullOrWhiteSpace(target.AvatarDataUrl) && !string.IsNullOrWhiteSpace(source.AvatarDataUrl))
            {
                target.AvatarDataUrl = source.AvatarDataUrl;
                changed = true;
            }

            if (string.IsNullOrWhiteSpace(target.Username) && !string.IsNullOrWhiteSpace(source.Username))
            {
                target.Username = source.Username;
                changed = true;
            }

            if ((string.IsNullOrWhiteSpace(target.Remark) || target.Remark == "未命名账号")
                && !string.IsNullOrWhiteSpace(source.Remark))
            {
                target.Remark = source.Remark;
                changed = true;
            }

            return changed;
        }

        private void CopyAccountDirectory(string legacyDataDir, string accountId)
        {
            var sourceDir = Path.Combine(legacyDataDir, accountId);
            if (!Directory.Exists(sourceDir))
                return;

            CopyDirectory(sourceDir, Path.Combine(_dataDir, accountId));
        }

        private static List<AccountInfo> ReadAccountsFromFile(string path)
        {
            try
            {
                if (!File.Exists(path))
                    return new List<AccountInfo>();

                return JsonSerializer.Deserialize<List<AccountInfo>>(File.ReadAllText(path)) ?? new List<AccountInfo>();
            }
            catch
            {
                return new List<AccountInfo>();
            }
        }

        private static List<GroupInfo> ReadGroupsFromFile(string path)
        {
            try
            {
                if (!File.Exists(path))
                    return new List<GroupInfo>();

                var groups = JsonSerializer.Deserialize<List<GroupInfo>>(File.ReadAllText(path)) ?? new List<GroupInfo>();
                NormalizeGroups(groups);
                return groups;
            }
            catch
            {
                return new List<GroupInfo>();
            }
        }

        private static string NormalizePath(string path)
        {
            return Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        }

        private static void CopyDirectory(string sourceDir, string destinationDir)
        {
            Directory.CreateDirectory(destinationDir);

            foreach (var file in Directory.GetFiles(sourceDir))
            {
                var destinationPath = Path.Combine(destinationDir, Path.GetFileName(file));
                if (!File.Exists(destinationPath))
                    File.Copy(file, destinationPath);
            }

            foreach (var directory in Directory.GetDirectories(sourceDir))
            {
                var destinationPath = Path.Combine(destinationDir, Path.GetFileName(directory));
                CopyDirectory(directory, destinationPath);
            }
        }
    }
}
