using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;

namespace KManager
{
    public partial class MainWindow : Window
    {
        private const string WebView2BootstrapperPath = @"Resources\MicrosoftEdgeWebview2Setup.exe";
        private static readonly TimeSpan WebView2InstallTimeout = TimeSpan.FromSeconds(120);
        private bool _webViewInitialized;

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("kernel32.dll")]
        private static extern bool SetProcessWorkingSetSize(IntPtr hProcess, int dwMinimumWorkingSetSize, int dwMaximumWorkingSetSize);

        public MainWindow()
        {
            InitializeComponent();
            ApplyResponsiveWindowSize();
            Loaded += async (_, _) => await InitializeWebViewAsync();
            try {
                CreateAndSetIcon();
            } catch { }
        }

        private void ApplyResponsiveWindowSize()
        {
            var workArea = SystemParameters.WorkArea;
            var width = Math.Clamp(Math.Floor(workArea.Width * 0.82), 900, 1180);
            var height = Math.Clamp(Math.Floor(workArea.Height * 0.86), 680, 780);

            if (workArea.Width < 1100 || workArea.Height < 800)
            {
                width = Math.Min(900, Math.Floor(workArea.Width * 0.94));
                height = Math.Min(720, Math.Floor(workArea.Height * 0.90));
            }

            Width = width;
            Height = height;
        }

        private void CreateAndSetIcon()
        {
            try {
                var appPath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
                if (string.IsNullOrEmpty(appPath))
                    return;

                var icon = System.Drawing.Icon.ExtractAssociatedIcon(appPath);
                if (icon != null) {
                    TrayIcon.Icon = icon;
                    this.Icon = System.Windows.Interop.Imaging.CreateBitmapSourceFromHIcon(icon.Handle, System.Windows.Int32Rect.Empty, System.Windows.Media.Imaging.BitmapSizeOptions.FromEmptyOptions());
                }
            } catch { }
        }

        private async Task InitializeWebViewAsync()
        {
            if (_webViewInitialized)
                return;

            _webViewInitialized = true;

            try
            {
                if (!await EnsureWebView2RuntimeAsync())
                {
                    Application.Current.Shutdown();
                    return;
                }

                await StartWebViewAsync();
            }
            catch (Exception ex)
            {
                if (await OfferWebView2RepairAsync(ex))
                    return;

                ShowStartupError(
                    "KManager 无法启动 WebView2。请安装或修复 Microsoft Edge WebView2 Runtime，然后重启 KManager。",
                    ex);
            }
        }

        private async Task StartWebViewAsync()
        {
            var cacheDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "KManager",
                "WebView2Cache");
            Directory.CreateDirectory(cacheDir);

            var wwwrootDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            var indexPath = Path.Combine(wwwrootDir, "index.html");
            if (!File.Exists(indexPath))
                throw new FileNotFoundException("KManager front-end files are missing.", indexPath);

            // Some machines render an empty WebView2 surface with GPU acceleration enabled.
            var options = new CoreWebView2EnvironmentOptions("--disable-gpu --renderer-process-limit=1 --disable-features=Translate --js-flags=\"--max-old-space-size=128\"");
            var env = await CoreWebView2Environment.CreateAsync(null, cacheDir, options);
            await webView.EnsureCoreWebView2Async(env);
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;

            webView.CoreWebView2.ProcessFailed += (_, args) =>
            {
                ShowStartupError($"WebView2 进程异常退出：{args.ProcessFailedKind}");
            };

            webView.NavigationCompleted += (_, args) =>
            {
                if (!args.IsSuccess)
                    ShowStartupError($"KManager 界面加载失败：{args.WebErrorStatus}");
            };

            // Map wwwroot to a virtual host for cleaner URLs and CORS
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local",
                wwwrootDir,
                CoreWebView2HostResourceAccessKind.Allow);

            webView.CoreWebView2.AddHostObjectToScript("bridge", new WebBridge());

            webView.Source = new Uri("http://app.local/index.html");
        }

        private async Task<bool> EnsureWebView2RuntimeAsync()
        {
            if (IsWebView2RuntimeAvailable())
                return true;

            var result = MessageBox.Show(
                this,
                "KManager 需要 Microsoft Edge WebView2 Runtime 才能显示界面。\n\n点击“确定”后将使用随程序附带的 Bootstrapper 联网下载并安装运行环境。安装完成后 KManager 会继续启动。",
                "KManager 缺少运行环境",
                MessageBoxButton.OKCancel,
                MessageBoxImage.Information);

            if (result != MessageBoxResult.OK)
                return false;

            return await InstallWebView2RuntimeAsync();
        }

        private async Task<bool> OfferWebView2RepairAsync(Exception startupException)
        {
            var result = MessageBox.Show(
                this,
                $"WebView2 运行环境启动失败，可能缺失或损坏。\n\n点击“确定”后将联网下载并尝试安装/修复 Microsoft Edge WebView2 Runtime。\n\n{startupException.Message}",
                "KManager 启动失败",
                MessageBoxButton.OKCancel,
                MessageBoxImage.Warning);

            if (result != MessageBoxResult.OK)
                return false;

            if (!await InstallWebView2RuntimeAsync())
                return false;

            try
            {
                await StartWebViewAsync();
                return true;
            }
            catch (Exception retryException)
            {
                ShowStartupError(
                    "WebView2 Runtime 已尝试安装/修复，但 KManager 仍然无法启动界面。请重启电脑后再试，或在系统应用列表中修复 Microsoft Edge WebView2 Runtime。",
                    retryException);
                return true;
            }
        }

        private async Task<bool> InstallWebView2RuntimeAsync()
        {
            var bootstrapperPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, WebView2BootstrapperPath);
            if (!File.Exists(bootstrapperPath))
            {
                ShowStartupError("KManager 安装包缺少 WebView2 Runtime Bootstrapper，请重新下载安装包。");
                return false;
            }

            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = bootstrapperPath,
                    Arguments = "/silent /install",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = Process.Start(startInfo);

                var deadline = DateTime.UtcNow + WebView2InstallTimeout;
                while (DateTime.UtcNow < deadline)
                {
                    if (IsWebView2RuntimeAvailable())
                        return true;

                    await Task.Delay(2000);
                }

                ShowStartupError("WebView2 Runtime 安装程序已启动，但暂时没有检测到安装完成。请确认网络可用，等待安装完成后重新打开 KManager。");
                return false;
            }
            catch (Exception ex)
            {
                ShowStartupError("WebView2 Runtime 联网安装失败。请确认网络可用，或手动安装 Microsoft Edge WebView2 Runtime 后再启动 KManager。", ex);
                return false;
            }
        }

        private static bool IsWebView2RuntimeAvailable()
        {
            try
            {
                var version = CoreWebView2Environment.GetAvailableBrowserVersionString();
                return !string.IsNullOrWhiteSpace(version) && !version.StartsWith("0.0.0.0", StringComparison.Ordinal);
            }
            catch
            {
                return false;
            }
        }

        private void ShowStartupError(string message, Exception? exception = null)
        {
            var detail = exception == null ? "" : $"{Environment.NewLine}{Environment.NewLine}{exception.Message}";
            MessageBox.Show(this, message + detail, "KManager 启动失败", MessageBoxButton.OK, MessageBoxImage.Error);
        }

        private void Window_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ButtonState == MouseButtonState.Pressed)
            {
                this.DragMove();
            }
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            this.Close(); // Will be handled by OnClosing
        }

        private bool _isExiting = false;

        internal void ShowAndActivate()
        {
            if (!IsVisible)
                Show();

            if (WindowState == WindowState.Minimized)
                WindowState = WindowState.Normal;

            Activate();

            Topmost = true;
            Topmost = false;

            var hwnd = new WindowInteropHelper(this).Handle;
            if (hwnd != IntPtr.Zero)
                SetForegroundWindow(hwnd);
        }

        private void TrayIcon_TrayMouseDoubleClick(object sender, RoutedEventArgs e)
        {
            ShowAndActivate();
        }

        private void MenuShow_Click(object sender, RoutedEventArgs e)
        {
            ShowAndActivate();
        }

        private void MenuExit_Click(object sender, RoutedEventArgs e)
        {
            _isExiting = true;
            Application.Current.Shutdown();
        }

        private void TrimMemory()
        {
            try
            {
                GC.Collect();
                GC.WaitForPendingFinalizers();
                SetProcessWorkingSetSize(Process.GetCurrentProcess().Handle, -1, -1);
            }
            catch { }
        }

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            if (!_isExiting)
            {
                e.Cancel = true;
                this.Hide();
                TrimMemory();
            }
            base.OnClosing(e);
        }

        protected override void OnStateChanged(EventArgs e)
        {
            if (WindowState == WindowState.Minimized)
            {
                TrimMemory();
            }
            base.OnStateChanged(e);
        }
    }
}
