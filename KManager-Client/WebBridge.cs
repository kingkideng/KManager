using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace KManager
{
    [ClassInterface(ClassInterfaceType.AutoDual)]
    [ComVisible(true)]
    public class WebBridge
    {
        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();
        public const int WM_NCLBUTTONDOWN = 0xA1;
        public const int HT_CAPTION = 0x2;
        private readonly Core.BattleNetCore _core = new Core.BattleNetCore();

        public string GetAccounts()
        {
            return JsonSerializer.Serialize(_core.GetAccounts());
        }

        public string GetGroups()
        {
            return JsonSerializer.Serialize(_core.GetGroups());
        }

        public string CreateGroup(string name)
        {
            return JsonSerializer.Serialize(_core.CreateGroup(name));
        }

        public bool RenameGroup(string id, string name)
        {
            return _core.RenameGroup(id, name);
        }

        public bool DeleteGroup(string id)
        {
            return _core.DeleteGroup(id);
        }

        public bool MoveAccountToGroup(string accountId, string groupId)
        {
            return _core.MoveAccountToGroup(accountId, groupId);
        }

        public bool UpdateAccountInfo(string accountId, string remark, string battleTag)
        {
            return _core.UpdateAccountInfo(accountId, remark, battleTag);
        }

        public bool SaveCurrentAccount(string remark, string battleTag)
        {
            return _core.SaveCurrentAccount(remark, battleTag);
        }

        public bool SaveCurrentAccountToGroup(string remark, string battleTag, string groupId)
        {
            return _core.SaveCurrentAccountToGroup(remark, battleTag, groupId);
        }

        public void SwitchAccount(string id)
        {
            _ = _core.SwitchAccountAsync(id);
        }

        public void DeleteAccount(string id)
        {
            _core.DeleteAccount(id);
        }

        public void AddNewAccount()
        {
            _ = _core.AddNewAccountAsync();
        }

        public bool GetAutoStart() => _core.GetAutoStartStatus();
        
        public void SetAutoStart(bool enabled) => _core.SetAutoStart(enabled);

        public bool OpenExternalUrl(string url)
        {
            try
            {
                if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
                    return false;

                if (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
                    return false;

                if (!string.Equals(uri.Host, "github.com", StringComparison.OrdinalIgnoreCase))
                    return false;

                Process.Start(new ProcessStartInfo(uri.AbsoluteUri)
                {
                    UseShellExecute = true
                });
                return true;
            }
            catch
            {
                return false;
            }
        }

        public void DragWindow()
        {
            System.Windows.Application.Current.Dispatcher.Invoke(() => {
                try {
                    var hwnd = new System.Windows.Interop.WindowInteropHelper(System.Windows.Application.Current.MainWindow).Handle;
                    ReleaseCapture();
                    SendMessage(hwnd, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                } catch { }
            });
        }
        public void MinimizeApp()
        {
            System.Windows.Application.Current.Dispatcher.Invoke(() => {
                System.Windows.Application.Current.MainWindow.WindowState = System.Windows.WindowState.Minimized;
            });
        }
        
        public void CloseApp()
        {
            System.Windows.Application.Current.Dispatcher.Invoke(() => {
                System.Windows.Application.Current.MainWindow.Close();
            });
        }
    }
}
