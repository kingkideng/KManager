using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;

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
        private readonly Task<Core.BattleNetCore> _coreTask;

        public WebBridge()
        {
            _coreTask = Task.Run(() => new Core.BattleNetCore());
        }

        private Core.BattleNetCore Core => _coreTask.GetAwaiter().GetResult();

        public bool IsCoreReady()
        {
            return _coreTask.IsCompleted;
        }

        public string GetCoreInitializationError()
        {
            return _coreTask.IsFaulted
                ? _coreTask.Exception?.GetBaseException().Message ?? "core_init_failed"
                : "";
        }

        public string GetAccounts()
        {
            return JsonSerializer.Serialize(Core.GetAccounts());
        }

        public string GetGroups()
        {
            return JsonSerializer.Serialize(Core.GetGroups());
        }

        public string CreateGroup(string name)
        {
            return JsonSerializer.Serialize(Core.CreateGroup(name));
        }

        public bool RenameGroup(string id, string name)
        {
            return Core.RenameGroup(id, name);
        }

        public bool DeleteGroup(string id)
        {
            return Core.DeleteGroup(id);
        }

        public bool MoveAccountToGroup(string accountId, string groupId)
        {
            return Core.MoveAccountToGroup(accountId, groupId);
        }

        public bool UpdateAccountInfo(string accountId, string remark, string battleTag, string region, string avatarDataUrl)
        {
            return Core.UpdateAccountInfo(accountId, remark, battleTag, region, avatarDataUrl);
        }

        public bool SaveCurrentAccount(string remark, string battleTag, string region, string avatarDataUrl)
        {
            return Core.SaveCurrentAccount(remark, battleTag, region, avatarDataUrl);
        }

        public string SaveCurrentAccountDetailed(string remark, string battleTag, string region, string avatarDataUrl)
        {
            return JsonSerializer.Serialize(Core.SaveCurrentAccountDetailed(remark, battleTag, region, avatarDataUrl));
        }

        public bool SaveCurrentAccountToGroup(string remark, string battleTag, string groupId, string region, string avatarDataUrl)
        {
            return Core.SaveCurrentAccountToGroup(remark, battleTag, groupId, region, avatarDataUrl);
        }

        public string SaveCurrentAccountToGroupDetailed(string remark, string battleTag, string groupId, string region, string avatarDataUrl)
        {
            return JsonSerializer.Serialize(Core.SaveCurrentAccountToGroupDetailed(remark, battleTag, groupId, region, avatarDataUrl));
        }

        public bool RefreshAccountSessionState(string id)
        {
            return Core.RefreshAccountSessionState(id);
        }

        public string RefreshAccountSessionStateDetailed(string id)
        {
            return JsonSerializer.Serialize(Core.RefreshAccountSessionStateDetailed(id));
        }

        public bool SwitchAccount(string id)
        {
            return Task.Run(() => Core.SwitchAccountAsync(id)).GetAwaiter().GetResult();
        }

        public string SwitchAccountDetailed(string id)
        {
            var result = Task.Run(() => Core.SwitchAccountDetailedAsync(id)).GetAwaiter().GetResult();
            return JsonSerializer.Serialize(result);
        }

        public void DeleteAccount(string id)
        {
            Core.DeleteAccount(id);
        }

        public bool AddNewAccount(string region)
        {
            return Task.Run(() => Core.AddNewAccountAsync(region)).GetAwaiter().GetResult();
        }

        public bool GetAutoStart() => Core.GetAutoStartStatus();
        
        public void SetAutoStart(bool enabled) => Core.SetAutoStart(enabled);

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
