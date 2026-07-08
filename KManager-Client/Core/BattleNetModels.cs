using System;
using System.Collections.Generic;

namespace KManager.Core
{
    public class AccountInfo
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string Remark { get; set; } = "";
        public string Username { get; set; } = "";
        public DateTime LastUsed { get; set; } = DateTime.Now;
        public string GroupId { get; set; } = BattleNetCore.DefaultGroupId;
        public string Region { get; set; } = BattleNetCore.UnsetAccountRegion;
        public string AvatarDataUrl { get; set; } = "";
    }

    public class GroupInfo
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string Name { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    public class SwitchAccountResult
    {
        public bool Success { get; set; }
        public bool RequiresManualLaunch { get; set; }
        public string Error { get; set; } = "";
    }

    public class SaveAccountResult
    {
        public bool Success { get; set; }
        public bool SessionStateSaved { get; set; }
        public string Error { get; set; } = "";
    }

    internal class RegistryValueBackup
    {
        public string KeyPath { get; set; } = "";
        public string ValueName { get; set; } = "";
        public string ValueKind { get; set; } = "";
        public string Data { get; set; } = "";
    }

    internal class BattleNetSessionStateMetadata
    {
        public DateTime CapturedAtUtc { get; set; } = DateTime.UtcNow;
    }

    internal class LegacyMigrationState
    {
        public List<LegacyMigrationDataDirectory> DataDirectories { get; set; } = new();
    }

    internal class LegacyMigrationDataDirectory
    {
        public string Path { get; set; } = "";
        public bool PreferLegacyData { get; set; }
        public DateTime ImportedAtUtc { get; set; } = DateTime.UtcNow;
    }

    internal class BattleNetRegionSettings
    {
        public BattleNetRegionSettings(
            string allowedRegions,
            string allowedLocales,
            string loginAddress,
            string loginRegion,
            string tassadarHost)
        {
            AllowedRegions = allowedRegions;
            AllowedLocales = allowedLocales;
            LoginAddress = loginAddress;
            LoginRegion = loginRegion;
            TassadarHost = tassadarHost;
        }

        public string AllowedRegions { get; }
        public string AllowedLocales { get; }
        public string LoginAddress { get; }
        public string LoginRegion { get; }
        public string TassadarHost { get; }
    }
}
