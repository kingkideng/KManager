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
    }

    public class BattleNetCore
    {
        private readonly string _appDataPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Battle.net");
        private readonly string _dataDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Data");
        private readonly string _accountsJsonPath;
        private readonly string _configFilePath;
        private const string RegistryKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string AppName = "KManager";

        public BattleNetCore()
        {
            _configFilePath = Path.Combine(_appDataPath, "Battle.net.config");
            _accountsJsonPath = Path.Combine(_dataDir, "accounts.json");
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
                return JsonSerializer.Deserialize<List<AccountInfo>>(json) ?? new List<AccountInfo>();
            }
            catch
            {
                return new List<AccountInfo>();
            }
        }

        private void SaveAccounts(List<AccountInfo> accounts)
        {
            File.WriteAllText(_accountsJsonPath, JsonSerializer.Serialize(accounts));
        }

        public bool SaveCurrentAccount(string remark, string battleTag)
        {
            if (!File.Exists(_configFilePath))
                return false;

            var accounts = GetAccounts();
            var newAccount = new AccountInfo { Remark = remark, Username = battleTag };

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
                    var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName;
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
    }
}
