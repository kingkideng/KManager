using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;

namespace KManager
{
    public partial class MainWindow : Window
    {
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        public MainWindow()
        {
            InitializeComponent();
            ApplyResponsiveWindowSize();
            InitializeWebView();
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

        private async void InitializeWebView()
        {
            try
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
                var options = new CoreWebView2EnvironmentOptions("--disable-gpu");
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
            catch (Exception ex)
            {
                ShowStartupError(
                    "KManager 无法启动 WebView2。请安装或修复 Microsoft Edge WebView2 Runtime，然后重启 KManager。",
                    ex);
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

        protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
        {
            if (!_isExiting)
            {
                e.Cancel = true;
                this.Hide();
            }
            base.OnClosing(e);
        }

        protected override void OnStateChanged(EventArgs e)
        {
            if (WindowState == WindowState.Minimized)
            {
                this.Hide();
            }
            base.OnStateChanged(e);
        }
    }
}
