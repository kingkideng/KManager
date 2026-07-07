namespace KManager.Core
{
    public partial class BattleNetCore
    {
        public const string DefaultGroupId = "default";
        public const string UnsetAccountRegion = "";
        public const string RegionAsia = "asia";
        public const string RegionAmericas = "americas";
        public const string RegionEurope = "europe";
        public const string RegionChina = "cn";
        public const string DefaultAccountRegion = RegionAsia;

        private const string DefaultGroupName = "默认分组";
        private const string BetaTestAppName = "KManager-RegionSwitch-Test";
        private const string BetaInstallerAppName = "KManager Beta";
        private const int MaxAvatarDataUrlLength = 700_000;
        private const string RegistryKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    }
}
