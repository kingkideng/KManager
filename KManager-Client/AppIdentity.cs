namespace KManager;

internal static class AppIdentity
{
#if KM_TEST_BUILD
    public const string AppName = "KManager-RegionSwitch-Test";
    public const string DisplayName = "KManager Beta";
    public const string SingleInstanceMutexName = @"Local\KManager.RegionSwitchTest.SingleInstance";
    public const string ShowMainWindowEventName = @"Local\KManager.RegionSwitchTest.ShowMainWindow";
    public const string AutoStartRegistryValueName = "KManager-RegionSwitch-Test";
    public const string AppUserModelId = "kingkideng.KManager.RegionSwitchTest.Beta.IconV2";
#else
    public const string AppName = "KManager";
    public const string DisplayName = "KManager";
    public const string SingleInstanceMutexName = @"Local\KManager.SingleInstance";
    public const string ShowMainWindowEventName = @"Local\KManager.ShowMainWindow";
    public const string AutoStartRegistryValueName = "KManager";
    public const string AppUserModelId = "kingkideng.KManager";
#endif
}
