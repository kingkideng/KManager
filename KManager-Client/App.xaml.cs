using System;
using System.Threading;
using System.Windows;

namespace KManager;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    private const string SingleInstanceMutexName = @"Local\KManager.SingleInstance";
    private const string ShowMainWindowEventName = @"Local\KManager.ShowMainWindow";

    private Mutex? _singleInstanceMutex;
    private EventWaitHandle? _showMainWindowEvent;
    private RegisteredWaitHandle? _showMainWindowRegistration;

    protected override void OnStartup(StartupEventArgs e)
    {
        _singleInstanceMutex = new Mutex(true, SingleInstanceMutexName, out var createdNew);
        if (!createdNew)
        {
            SignalExistingInstance();
            Shutdown();
            return;
        }

        base.OnStartup(e);

        _showMainWindowEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ShowMainWindowEventName);
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
            using var showEvent = EventWaitHandle.OpenExisting(ShowMainWindowEventName);
            showEvent.Set();
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
