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
            InitializeWebView();
            try {
                CreateAndSetIcon();
            } catch { }
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
            // Set custom cache folder so it doesn't try to write to read-only install dirs later
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "WebView2Cache"));
            await webView.EnsureCoreWebView2Async(env);
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            
            // Map wwwroot to a virtual host for cleaner URLs and CORS
            webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local",
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot"),
                CoreWebView2HostResourceAccessKind.Allow);

            webView.CoreWebView2.AddHostObjectToScript("bridge", new WebBridge());

            webView.Source = new Uri("http://app.local/index.html");
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
