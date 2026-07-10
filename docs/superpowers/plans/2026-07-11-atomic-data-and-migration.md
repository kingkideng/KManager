# KManager Atomic Data and Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent silent account loss and make legacy/beta imports recoverable, idempotent, and safe to retry.

**Architecture:** Route JSON through one atomic store, then place account/group/migration behavior behind repositories. Legacy account directories are copied into staging, validated, and renamed into place before a source is marked completed.

**Tech Stack:** .NET 8, System.Text.Json, xUnit, Windows filesystem semantics.

## Global Constraints

- Complete and review `2026-07-11-foundation-observability-and-tests.md` first.
- Work only with temporary test roots and copied fixtures; never mutate the real KManager Data directory.
- Preserve current JSON property names and accept every existing v1, beta, and v2 JSON file.
- Do not delete or rename legacy source directories.
- Do not remove `BattleNetSessionStateBackup` in this plan; snapshot slimming is a separate experiment.
- Do not alter account switching, process control, registry state, WebView2 flags, or UI layout.
- Stop after each task for tests and a focused commit.

---

### Task 1: Implement atomic JSON reads and writes

**Files:**
- Create: `KManager-Client/Infrastructure/AtomicFileStore.cs`
- Create: `KManager-Client.Tests/Infrastructure/AtomicFileStoreTests.cs`

**Interfaces:**
- Produces: `AtomicReadResult<T>`
- Produces: `IAtomicFileStore.ReadJson<T>(string path)`
- Produces: `IAtomicFileStore.WriteJson<T>(string path, T value)`
- Produces: `DataStoreException.ErrorCode`

- [ ] **Step 1: Write failing atomic-store tests**

Create `KManager-Client.Tests/Infrastructure/AtomicFileStoreTests.cs`:

```csharp
using KManager.Infrastructure;

namespace KManager.Client.Tests.Infrastructure;

public sealed class AtomicFileStoreTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "KManagerAtomicTests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void WriteJson_creates_readable_main_file()
    {
        var store = CreateStore();
        var path = Path.Combine(_root, "data.json");
        store.WriteJson(path, new[] { "one", "two" });

        var result = store.ReadJson<List<string>>(path);

        Assert.True(result.Success);
        Assert.False(result.RecoveredFromBackup);
        Assert.Equal(new[] { "one", "two" }, result.Value);
    }

    [Fact]
    public void ReadJson_recovers_valid_backup_when_main_is_corrupt()
    {
        var store = CreateStore();
        var path = Path.Combine(_root, "data.json");
        Directory.CreateDirectory(_root);
        File.WriteAllText(path, "not-json");
        File.WriteAllText(path + ".bak", "[\"backup\"]");

        var result = store.ReadJson<List<string>>(path);

        Assert.True(result.Success);
        Assert.True(result.RecoveredFromBackup);
        Assert.Equal("backup", Assert.Single(result.Value!));
    }

    [Fact]
    public void ReadJson_throws_when_main_and_backup_are_both_corrupt()
    {
        var store = CreateStore();
        var path = Path.Combine(_root, "data.json");
        Directory.CreateDirectory(_root);
        File.WriteAllText(path, "bad-main");
        File.WriteAllText(path + ".bak", "bad-backup");

        var error = Assert.Throws<DataStoreException>(() => store.ReadJson<List<string>>(path));

        Assert.Equal("json_unreadable", error.ErrorCode);
    }

    private AtomicFileStore CreateStore() => new(NullAppLogger.Instance);

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, true);
    }
}
```

- [ ] **Step 2: Confirm the tests fail to compile**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter AtomicFileStoreTests
```

Expected: missing `AtomicFileStore` and related types.

- [ ] **Step 3: Implement the atomic store**

Create `KManager-Client/Infrastructure/AtomicFileStore.cs`:

```csharp
using System.Text.Json;

namespace KManager.Infrastructure;

internal sealed record AtomicReadResult<T>(bool Success, T? Value, bool RecoveredFromBackup);

internal sealed class DataStoreException : Exception
{
    public DataStoreException(string errorCode, Exception? inner = null)
        : base(errorCode, inner) => ErrorCode = errorCode;

    public string ErrorCode { get; }
}

internal interface IAtomicFileStore
{
    AtomicReadResult<T> ReadJson<T>(string path);
    void WriteJson<T>(string path, T value);
}

internal sealed class AtomicFileStore : IAtomicFileStore
{
    private readonly IAppLogger _logger;
    private static readonly JsonSerializerOptions JsonOptions = new();

    public AtomicFileStore(IAppLogger logger) => _logger = logger;

    public AtomicReadResult<T> ReadJson<T>(string path)
    {
        if (!File.Exists(path))
            return new AtomicReadResult<T>(true, default, false);

        try
        {
            return new AtomicReadResult<T>(true, Deserialize<T>(path), false);
        }
        catch (Exception mainError)
        {
            var backupPath = path + ".bak";
            try
            {
                if (!File.Exists(backupPath))
                    throw new FileNotFoundException("backup_missing", backupPath);
                var value = Deserialize<T>(backupPath);
                _logger.Error("data_read", "recovered_from_backup", mainError);
                return new AtomicReadResult<T>(true, value, true);
            }
            catch (Exception backupError)
            {
                _logger.Error("data_read", "json_unreadable", backupError);
                throw new DataStoreException("json_unreadable", backupError);
            }
        }
    }

    public void WriteJson<T>(string path, T value)
    {
        var directory = Path.GetDirectoryName(path) ?? throw new DataStoreException("invalid_path");
        Directory.CreateDirectory(directory);
        var temporaryPath = path + ".tmp." + Guid.NewGuid().ToString("N");
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(value, JsonOptions);
            using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, FileOptions.WriteThrough))
            {
                stream.Write(bytes);
                stream.Flush(flushToDisk: true);
            }

            if (File.Exists(path))
                File.Replace(temporaryPath, path, path + ".bak", ignoreMetadataErrors: true);
            else
                File.Move(temporaryPath, path);
        }
        catch (Exception ex)
        {
            TryDelete(temporaryPath);
            _logger.Error("data_write", "atomic_write_failed", ex);
            throw new DataStoreException("atomic_write_failed", ex);
        }
    }

    private static T Deserialize<T>(string path)
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return JsonSerializer.Deserialize<T>(stream, JsonOptions)
            ?? throw new JsonException("json_null");
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }
}
```

- [ ] **Step 4: Run tests**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter AtomicFileStoreTests
```

Expected: all three tests pass.

- [ ] **Step 5: Commit**

```powershell
git add KManager-Client/Infrastructure/AtomicFileStore.cs KManager-Client.Tests/Infrastructure/AtomicFileStoreTests.cs
git commit -m "feat: add atomic JSON storage"
```

### Task 2: Move account and group persistence into repositories

**Files:**
- Create: `KManager-Client/Data/RepositoryLoadResult.cs`
- Create: `KManager-Client/Data/AccountRepository.cs`
- Create: `KManager-Client/Data/GroupRepository.cs`
- Create: `KManager-Client.Tests/Data/RepositoryRecoveryTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs:33-139,1560-1663`

**Interfaces:**
- Produces: `AccountRepository.Load()`, `Save(List<AccountInfo>)`
- Produces: `GroupRepository.Load()`, `Save(List<GroupInfo>)`, `EnsureValidGroupId(string)`
- Preserves: all public `BattleNetCore` account/group methods

- [ ] **Step 1: Write failing repository recovery tests**

Create `KManager-Client.Tests/Data/RepositoryRecoveryTests.cs`:

```csharp
using KManager.Core;
using KManager.Data;
using KManager.Infrastructure;

namespace KManager.Client.Tests.Data;

public sealed class RepositoryRecoveryTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "KManagerRepositoryTests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void Account_repository_recovers_backup()
    {
        var paths = AppPaths.CreateForTests(_root);
        Directory.CreateDirectory(paths.DataDirectory);
        File.WriteAllText(paths.AccountsJsonPath, "bad-main");
        File.WriteAllText(paths.AccountsJsonPath + ".bak", "[{\"Id\":\"a1\",\"GroupId\":\"default\"}]");
        var store = new AtomicFileStore(NullAppLogger.Instance);
        var groups = new GroupRepository(paths, store);
        var accounts = new AccountRepository(paths, store, groups, NormalizeRegion, SanitizeAvatar);

        var result = accounts.Load();

        Assert.True(result.RecoveredFromBackup);
        Assert.Equal("a1", Assert.Single(result.Value).Id);
    }

    [Fact]
    public void Group_repository_recovers_backup()
    {
        var paths = AppPaths.CreateForTests(_root);
        Directory.CreateDirectory(paths.DataDirectory);
        File.WriteAllText(paths.GroupsJsonPath, "bad-main");
        File.WriteAllText(paths.GroupsJsonPath + ".bak", "[{\"Id\":\"default\",\"Name\":\"默认分组\"}]");
        var groups = new GroupRepository(paths, new AtomicFileStore(NullAppLogger.Instance));

        var result = groups.Load();

        Assert.True(result.RecoveredFromBackup);
        Assert.Equal("default", Assert.Single(result.Value).Id);
    }

    private static string NormalizeRegion(string value) =>
        new[] { "asia", "americas", "europe", "cn" }.Contains((value ?? "").Trim().ToLowerInvariant())
            ? value.Trim().ToLowerInvariant()
            : "";

    private static string SanitizeAvatar(string value) => value ?? "";

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, true);
    }
}
```

Use this exact result type in both repositories:

```csharp
internal sealed record RepositoryLoadResult<T>(T Value, bool RecoveredFromBackup);
```

Place it in `KManager-Client/Data/RepositoryLoadResult.cs` under namespace `KManager.Data`; do not duplicate the record in both repositories.

- [ ] **Step 2: Run tests and confirm missing repository types**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter RepositoryRecoveryTests
```

Expected: compile failure for `AccountRepository` and `GroupRepository`.

- [ ] **Step 3: Implement `GroupRepository`**

Implement `GroupRepository` with constructor `(AppPaths paths, IAtomicFileStore store)`. Move the existing `CreateDefaultGroup`, `NormalizeGroups`, and `NormalizeGroupName` bodies unchanged from `BattleNetCore`. `Load` returns a default group when the file is absent, but propagates `DataStoreException` when both main and backup are corrupt. `Save` normalizes then calls `_store.WriteJson`.

The public surface must be exactly:

```csharp
internal sealed class GroupRepository
{
    internal GroupRepository(AppPaths paths, IAtomicFileStore store);
    internal RepositoryLoadResult<List<GroupInfo>> Load();
    internal void Save(List<GroupInfo> groups);
    internal string EnsureValidGroupId(string groupId);
}
```

- [ ] **Step 4: Implement `AccountRepository`**

Implement `AccountRepository` with constructor `(AppPaths paths, IAtomicFileStore store, GroupRepository groups)`. Move the current account normalization loop unchanged, including group fallback, region normalization and avatar sanitization. Pass the two normalization functions as constructor delegates so the repository does not depend on `BattleNetCore`:

```csharp
internal AccountRepository(
    AppPaths paths,
    IAtomicFileStore store,
    GroupRepository groups,
    Func<string, string> normalizeRegion,
    Func<string, string> sanitizeAvatar);
```

`Load` returns an empty list only when `accounts.json` does not exist. It propagates `DataStoreException` for corrupt main and backup. `Save` normalizes and atomically writes.

- [ ] **Step 5: Delegate existing core methods to repositories**

Add fields `_groups` and `_accounts`, construct them in the injected `BattleNetCore` constructor, then replace only the persistence bodies:

```csharp
public List<AccountInfo> GetAccounts() => _accounts.Load().Value;
private void SaveAccounts(List<AccountInfo> accounts) => _accounts.Save(accounts);
private List<GroupInfo> ReadGroups() => _groups.Load().Value;
private void SaveGroups(List<GroupInfo> groups) => _groups.Save(groups);
private string EnsureValidGroupId(string groupId) => _groups.EnsureValidGroupId(groupId);
```

Delete the duplicated persistence/normalization methods only after repository tests and existing characterization tests pass.

- [ ] **Step 6: Run repository and characterization tests**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter "RepositoryRecoveryTests|BattleNetCoreDataTests"
dotnet build .\KManager-Client\KManager.csproj -c Release
```

Expected: all tests pass; build reports 0 errors.

- [ ] **Step 7: Commit**

```powershell
git add KManager-Client/Data KManager-Client/Core/BattleNetCore.cs KManager-Client.Tests/Data
git commit -m "refactor: protect account and group persistence"
```

### Task 3: Add a backward-compatible migration journal

**Files:**
- Create: `KManager-Client/Data/MigrationStateRepository.cs`
- Create: `KManager-Client.Tests/Migration/MigrationStateRepositoryTests.cs`
- Modify: `KManager-Client/Core/BattleNetModels.cs`

**Interfaces:**
- Produces: `MigrationStatus` enum
- Produces: `MigrationSourceState`
- Produces: `MigrationJournal`
- Produces: `MigrationStateRepository.Load()`, `Save(MigrationJournal)`

- [ ] **Step 1: Write the legacy-schema conversion test**

Create `KManager-Client.Tests/Migration/MigrationStateRepositoryTests.cs`:

```csharp
using KManager.Core;
using KManager.Data;
using KManager.Infrastructure;

namespace KManager.Client.Tests.Migration;

public sealed class MigrationStateRepositoryTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "KManagerMigrationStateTests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void Legacy_completed_entries_convert_to_schema_two()
    {
        var paths = AppPaths.CreateForTests(_root);
        Directory.CreateDirectory(paths.DataDirectory);
        File.WriteAllText(paths.MigrationStatePath,
            "{\"DataDirectories\":[{\"Path\":\"C:\\\\Beta\\\\Data\",\"PreferLegacyData\":true,\"ImportedAtUtc\":\"2026-07-08T00:00:00Z\"}]}");
        var repository = new MigrationStateRepository(paths, new AtomicFileStore(NullAppLogger.Instance));

        var journal = repository.Load();

        Assert.Equal(2, journal.SchemaVersion);
        var source = Assert.Single(journal.Sources);
        Assert.Equal(MigrationStatus.Completed, source.Status);
        Assert.True(source.PreferLegacyData);
        Assert.Equal(Path.GetFullPath("C:\\Beta\\Data"), source.Path);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, true);
    }
}
```

- [ ] **Step 2: Add the journal models**

Add these types to `BattleNetModels.cs`:

```csharp
internal enum MigrationStatus { Pending, InProgress, Completed, Failed }

internal sealed class MigrationJournal
{
    public int SchemaVersion { get; set; } = 2;
    public List<MigrationSourceState> Sources { get; set; } = new();
}

internal sealed class MigrationSourceState
{
    public string Path { get; set; } = "";
    public bool PreferLegacyData { get; set; }
    public MigrationStatus Status { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public long FileCount { get; set; }
    public long TotalBytes { get; set; }
    public string ErrorCode { get; set; } = "";
}
```

- [ ] **Step 3: Implement the repository and old-schema conversion**

`MigrationStateRepository.Load` first reads the JSON as `JsonDocument`. If `SchemaVersion == 2`, deserialize `MigrationJournal`. If the root contains `DataDirectories`, deserialize the existing `LegacyMigrationState` and convert every entry to `Completed`. Save the converted journal atomically before returning it.

Constructor and methods:

```csharp
internal MigrationStateRepository(AppPaths paths, IAtomicFileStore store);
internal MigrationJournal Load();
internal void Save(MigrationJournal journal);
internal MigrationSourceState GetOrCreate(MigrationJournal journal, string path, bool preferLegacyData);
```

- [ ] **Step 4: Run tests and commit**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter MigrationStateRepositoryTests
git add KManager-Client/Data/MigrationStateRepository.cs KManager-Client/Core/BattleNetModels.cs KManager-Client.Tests/Migration
git commit -m "feat: add recoverable migration journal"
```

### Task 4: Stage and validate legacy account-directory imports

**Files:**
- Create: `KManager-Client/Data/LegacyMigrationService.cs`
- Create: `KManager-Client.Tests/Migration/LegacyMigrationServiceTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs:1784-2263`

**Interfaces:**
- Produces: `MigrationRunResult(bool Success, string ErrorCode, int CompletedSources)`
- Produces: `LegacyMigrationService.Run()`
- Consumes: account/group repositories, migration journal, app paths, logger

Define the source seam exactly:

```csharp
internal sealed record LegacyDataSource(string Path, bool PreferLegacyData);
internal interface ILegacySourceProvider
{
    IReadOnlyList<LegacyDataSource> GetSources();
}
```

- [ ] **Step 1: Write three failing staging tests**

Create `LegacyMigrationServiceTests.cs` with a fake `ILegacySourceProvider` returning one temporary source. Use these three test names and assertions:

```csharp
[Fact] public void Valid_source_is_committed_and_marked_completed();
[Fact] public void Missing_config_is_failed_without_destination_directory();
[Fact] public void Completed_source_is_not_written_twice();
```

For the first test, create `accounts.json` with account `a1`, `a1/Battle.net.config`, `a1/BattleNetSessionStateCandidate/temp.bin`, and `a1/BattleNetSessionStateBackup/keep.bin`. After `Run`, assert destination config and backup exist, Candidate does not exist, and the journal state is `Completed`.

For the second test, omit `Battle.net.config`; assert `ErrorCode == "missing_config"`, state `Failed`, and destination `a1` is absent.

For the third test, run once, record destination config `LastWriteTimeUtc`, advance the fake provider without changing its path, run again, and assert timestamp equality plus `CompletedSources == 0`.

Use only temporary roots. Include a `BattleNetSessionStateCandidate` directory in fixture 1 and assert it is absent from the committed destination. Include `BattleNetSessionStateBackup` and assert it remains present.

- [ ] **Step 2: Implement staged copy rules**

Use a staging root inside Data named `.migration-staging`. For each account, create `<accountId>.<guid>`, recursively copy with this filter, validate config, then rename into place:

```csharp
private static bool ShouldCopy(string sourceRoot, string path)
{
    var relative = Path.GetRelativePath(sourceRoot, path);
    var firstSegment = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)[0];
    return !string.Equals(firstSegment, "BattleNetSessionStateCandidate", StringComparison.OrdinalIgnoreCase);
}
```

When beta data overwrites an existing account, rename the current destination to `<accountId>.migration-backup`, move staging into place, and delete the migration backup only after account metadata is atomically saved. On any exception, remove staging and restore the migration backup.

- [ ] **Step 3: Persist state transitions**

Before copying, save `InProgress` with `StartedAtUtc`. On success, save `Completed`, counts and bytes. On failure, save `Failed` and a stable code; log only the code and exception type. Never set `Completed` in a `finally` block.

- [ ] **Step 4: Replace constructor migration with the service**

Construct `LegacyMigrationService` in the injected core constructor. Replace `MigrateLegacyDataIfNeeded()` with `_migration.Run()`. Preserve the existing candidate discovery and beta-preference rules by moving their bodies into the service; do not re-derive them.

- [ ] **Step 5: Run migration tests and complete verification**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet build .\KManager-Client\KManager.csproj -c Release
Set-Location .\KManager-UI
npm run lint
npm run build
Set-Location ..
git diff --check
```

Expected: all tests pass; builds succeed; no new lint errors; no whitespace errors.

- [ ] **Step 6: Commit**

```powershell
git add KManager-Client/Data/LegacyMigrationService.cs KManager-Client/Core/BattleNetCore.cs KManager-Client.Tests/Migration/LegacyMigrationServiceTests.cs
git commit -m "feat: make legacy migration transactional"
```

## Plan Completion Gate

Do not use real user data. Copy a sanitized fixture into a temporary directory and run the tests twice. Confirm the second run reports completed sources without new destination writes. Review `git status --short --branch`, then stop for approval before plan 3.
