using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace KManager.Core
{
    public class AccountInfo
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string Remark { get; set; } = "";
        public string Username { get; set; } = "";
        public DateTime LastUsed { get; set; } = DateTime.Now;
        public string GroupId { get; set; } = BattleNetCore.DefaultGroupId;
    }

    public class GroupInfo
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string Name { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    public class BattleNetCore
    {
        public const string DefaultGroupId = "default";
        private const string DefaultGroupName = "默认分组";
        private const string AppName = "KManager";

        private readonly string _appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Battle.net");
        private readonly string _dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppName, "Data");
        private readonly string _legacyDataDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data");
        private readonly string _accountsJsonPath;
        private readonly string _groupsJsonPath;
        private readonly string _configFilePath;
        private const string RegistryKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";

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

        public bool UpdateAccountInfo(string accountId, string remark, string battleTag)
        {
            var accounts = GetAccounts();
            var account = accounts.FirstOrDefault(a => a.Id == accountId);
            if (account == null)
                return false;

            account.Remark = string.IsNullOrWhiteSpace(remark) ? "未命名账号" : remark.Trim();
            account.Username = (battleTag ?? "").Trim();
            SaveAccounts(accounts);
            return true;
        }

        public bool SaveCurrentAccount(string remark, string battleTag)
        {
            return SaveCurrentAccountToGroup(remark, battleTag, DefaultGroupId);
        }

        public bool SaveCurrentAccountToGroup(string remark, string battleTag, string groupId)
        {
            if (!File.Exists(_configFilePath))
                return false;

            var accounts = GetAccounts();
            var newAccount = new AccountInfo
            {
                Remark = remark,
                Username = battleTag,
                GroupId = EnsureValidGroupId(groupId)
            };

            string accountDir = Path.Combine(_dataDir, newAccount.Id);
            Directory.CreateDirectory(accountDir);
            File.Copy(_configFilePath, Path.Combine(accountDir, "Battle.net.config"), true);

            accounts.Add(newAccount);
            SaveAccounts(accounts);
            return true;
        }

        public async Task<bool> SwitchAccountAsync(string id)
        {
            var accountDir = Path.Combine(_dataDir, id);
            var savedConfig = Path.Combine(accountDir, "Battle.net.config");

            if (!File.Exists(savedConfig))
                return false;

            KillProcess("Battle.net");
            KillProcess("Agent");
            await Task.Delay(1500);

            if (File.Exists(_configFilePath))
                File.Delete(_configFilePath);
            File.Copy(savedConfig, _configFilePath, true);

            var accounts = GetAccounts();
            var acc = accounts.FirstOrDefault(a => a.Id == id);
            if (acc != null)
            {
                acc.LastUsed = DateTime.Now;
                SaveAccounts(accounts);
            }

            LaunchBattleNet();
            return true;
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

        public async Task AddNewAccountAsync()
        {
            KillProcess("Battle.net");
            KillProcess("Agent");
            await Task.Delay(1500);

            if (File.Exists(_configFilePath))
            {
                try { File.Delete(_configFilePath); } catch { }
            }

            LaunchBattleNet();
        }

        public bool GetAutoStartStatus()
        {
            try {
                using var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(RegistryKeyPath);
                var val = key?.GetValue(AppName) as string;
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
                        key?.SetValue(AppName, exePath);
                } else {
                    key?.DeleteValue(AppName, false);
                }
            } catch { }
        }

        private void KillProcess(string name)
        {
            foreach (var proc in Process.GetProcessesByName(name))
            {
                try { proc.Kill(); proc.WaitForExit(1000); } catch { }
            }
        }

        private void LaunchBattleNet()
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

        private void MigrateLegacyDataIfNeeded()
        {
            try
            {
                if (!Directory.Exists(_legacyDataDir))
                    return;

                if (Path.GetFullPath(_legacyDataDir).TrimEnd(Path.DirectorySeparatorChar).Equals(
                    Path.GetFullPath(_dataDir).TrimEnd(Path.DirectorySeparatorChar),
                    StringComparison.OrdinalIgnoreCase))
                    return;

                if (File.Exists(_accountsJsonPath))
                    return;

                Directory.CreateDirectory(_dataDir);
                CopyDirectory(_legacyDataDir, _dataDir);
            }
            catch
            {
            }
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
