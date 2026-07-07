using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;

namespace KManager;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    private Mutex? _singleInstanceMutex;
    private EventWaitHandle? _showMainWindowEvent;
    private RegisteredWaitHandle? _showMainWindowRegistration;

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern int SetCurrentProcessExplicitAppUserModelID(string appId);

    protected override void OnStartup(StartupEventArgs e)
    {
        _singleInstanceMutex = new Mutex(true, AppIdentity.SingleInstanceMutexName, out var createdNew);
        if (!createdNew)
        {
            SignalExistingInstance();
            Shutdown();
            return;
        }

        SetAppUserModelId();
        base.OnStartup(e);

        _showMainWindowEvent = new EventWaitHandle(false, EventResetMode.AutoReset, AppIdentity.ShowMainWindowEventName);
        _showMainWindowRegistration = ThreadPool.RegisterWaitForSingleObject(
            _showMainWindowEvent,
            (_, _) => Dispatcher.BeginInvoke(ShowMainWindow),
            null,
            -1,
            false);

        var mainWindow = new MainWindow();
        MainWindow = mainWindow;
        mainWindow.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _showMainWindowRegistration?.Unregister(null);
        _showMainWindowEvent?.Dispose();

        try
        {
            _singleInstanceMutex?.ReleaseMutex();
        }
        catch
        {
        }
        _singleInstanceMutex?.Dispose();

        base.OnExit(e);
    }

    private static void SignalExistingInstance()
    {
        try
        {
            using var showEvent = EventWaitHandle.OpenExisting(AppIdentity.ShowMainWindowEventName);
            showEvent.Set();
        }
        catch
        {
        }
    }

    private static void SetAppUserModelId()
    {
        try
        {
            SetCurrentProcessExplicitAppUserModelID(AppIdentity.AppUserModelId);
        }
        catch
        {
        }
    }

    private void ShowMainWindow()
    {
        if (MainWindow is MainWindow mainWindow)
            mainWindow.ShowAndActivate();
    }
}
