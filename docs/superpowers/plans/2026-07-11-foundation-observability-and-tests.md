# KManager Foundation, Observability, and Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a testable path boundary, a privacy-safe local logger, and characterization tests before changing KManager data or switching behavior.

**Architecture:** Keep `BattleNetCore` and every public `WebBridge` method intact. Add internal constructor injection for paths and logging so tests use temporary directories and never touch real Battle.net or `%LOCALAPPDATA%\KManager\Data`.

**Tech Stack:** .NET 8, WPF, xUnit, Microsoft.NET.Test.Sdk, PowerShell.

## Global Constraints

- Work in `C:\Users\KK\Desktop\KManager\SourceRepo`.
- Read `C:\Users\KK\Desktop\KManager\PROJECT_CONTEXT.md` with UTF-8 before editing.
- Do not read, copy, delete, or mutate the real `%LOCALAPPDATA%\KManager\Data` in tests.
- Do not change public `WebBridge` names, parameters, JSON casing, account IDs, group IDs, regions, or user-visible behavior.
- Do not change Battle.net process shutdown, snapshot contents, WebView2 GPU flags, window layout, or release version in this plan.
- Never log Token, Cookie, registry data, BattleTag, avatar data, config contents, or full account IDs.
- Commit each task independently. Stop when a command differs from the expected result.

---

### Task 1: Create the .NET test project

**Files:**
- Create: `KManager-Client.Tests/KManager-Client.Tests.csproj`
- Create: `KManager-Client.Tests/SmokeTests.cs`
- Modify: `KManager-Client/AssemblyInfo.cs`

**Interfaces:**
- Consumes: `KManager-Client/KManager.csproj`
- Produces: test assembly `KManager-Client.Tests` with access to internal production types

- [ ] **Step 1: Create the test project file**

Create `KManager-Client.Tests/KManager-Client.Tests.csproj` with exactly:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0-windows</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="coverlet.collector" Version="6.0.2">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\KManager-Client\KManager.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Add the internal-access declaration**

Append this line to `KManager-Client/AssemblyInfo.cs` after the existing `ThemeInfo` attribute:

```csharp
[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("KManager-Client.Tests")]
```

- [ ] **Step 3: Add a smoke test**

Create `KManager-Client.Tests/SmokeTests.cs`:

```csharp
namespace KManager.Client.Tests;

public sealed class SmokeTests
{
    [Fact]
    public void Test_runner_is_available()
    {
        Assert.True(true);
    }
}
```

- [ ] **Step 4: Run the test project**

Run:

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
```

Expected: `Passed: 1, Failed: 0`.

- [ ] **Step 5: Commit the test scaffold**

```powershell
git add KManager-Client.Tests KManager-Client/AssemblyInfo.cs
git commit -m "test: add KManager client test project"
```

### Task 2: Centralize application paths without changing production locations

**Files:**
- Create: `KManager-Client/Infrastructure/AppPaths.cs`
- Create: `KManager-Client.Tests/Infrastructure/AppPathsTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs:14-31`
- Modify: `KManager-Client/MainWindow.xaml.cs:125-140`

**Interfaces:**
- Produces: `internal sealed record AppPaths` and `AppPaths.CreateDefault()`
- Produces: `internal BattleNetCore(AppPaths paths, bool migrateLegacyData)` constructor; Task 3 extends it with logging
- Preserves: public parameterless `BattleNetCore()`

- [ ] **Step 1: Write the failing path test**

Create `KManager-Client.Tests/Infrastructure/AppPathsTests.cs`:

```csharp
using KManager.Infrastructure;

namespace KManager.Client.Tests.Infrastructure;

public sealed class AppPathsTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "KManagerTests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void CreateForTests_keeps_every_path_under_the_test_root()
    {
        var paths = AppPaths.CreateForTests(_root);

        Assert.Equal(Path.Combine(_root, "Data"), paths.DataDirectory);
        Assert.Equal(Path.Combine(_root, "BattleNetRoaming"), paths.BattleNetRoamingDirectory);
        Assert.Equal(Path.Combine(_root, "WebView2Cache"), paths.WebView2CacheDirectory);
        Assert.Equal(Path.Combine(_root, "Logs"), paths.LogDirectory);
        Assert.Equal(Path.Combine(_root, "InstallData"), paths.LegacyInstallDataDirectory);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, true);
    }
}
```

- [ ] **Step 2: Run the test and confirm the missing type**

Run:

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter AppPathsTests
```

Expected: compile failure because `KManager.Infrastructure.AppPaths` does not exist.

- [ ] **Step 3: Implement `AppPaths`**

Create `KManager-Client/Infrastructure/AppPaths.cs`:

```csharp
namespace KManager.Infrastructure;

internal sealed record AppPaths(
    string DataDirectory,
    string BattleNetRoamingDirectory,
    string WebView2CacheDirectory,
    string LogDirectory,
    string LegacyInstallDataDirectory)
{
    public string AccountsJsonPath => Path.Combine(DataDirectory, "accounts.json");
    public string GroupsJsonPath => Path.Combine(DataDirectory, "groups.json");
    public string MigrationStatePath => Path.Combine(DataDirectory, "migration-state.json");
    public string BattleNetConfigPath => Path.Combine(BattleNetRoamingDirectory, "Battle.net.config");

    public static AppPaths CreateDefault()
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return new AppPaths(
            Path.Combine(localAppData, AppIdentity.AppName, "Data"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Battle.net"),
            Path.Combine(localAppData, AppIdentity.AppName, "WebView2Cache"),
            Path.Combine(localAppData, AppIdentity.AppName, "Logs"),
            Path.Combine(AppContext.BaseDirectory, "Data"));
    }

    public static AppPaths CreateForTests(string root)
    {
        var fullRoot = Path.GetFullPath(root);
        return new AppPaths(
            Path.Combine(fullRoot, "Data"),
            Path.Combine(fullRoot, "BattleNetRoaming"),
            Path.Combine(fullRoot, "WebView2Cache"),
            Path.Combine(fullRoot, "Logs"),
            Path.Combine(fullRoot, "InstallData"));
    }
}
```

- [ ] **Step 4: Inject paths into `BattleNetCore`**

Replace the five path fields and public constructor at the start of `BattleNetCore` with:

```csharp
private readonly Infrastructure.AppPaths _paths;
private readonly string _appDataPath;
private readonly string _dataDir;
private readonly string _legacyDataDir;
private readonly string _accountsJsonPath;
private readonly string _groupsJsonPath;
private readonly string _configFilePath;
private readonly string _migrationStatePath;

public BattleNetCore()
    : this(Infrastructure.AppPaths.CreateDefault(), migrateLegacyData: true)
{
}

internal BattleNetCore(
    Infrastructure.AppPaths paths,
    bool migrateLegacyData)
{
    _paths = paths;
    _appDataPath = paths.BattleNetRoamingDirectory;
    _dataDir = paths.DataDirectory;
    _legacyDataDir = paths.LegacyInstallDataDirectory;
    _accountsJsonPath = paths.AccountsJsonPath;
    _groupsJsonPath = paths.GroupsJsonPath;
    _configFilePath = paths.BattleNetConfigPath;
    _migrationStatePath = paths.MigrationStatePath;

    Directory.CreateDirectory(_dataDir);
    if (migrateLegacyData)
        MigrateLegacyDataIfNeeded();
}
```

- [ ] **Step 5: Use `AppPaths` for WebView2 cache**

In `MainWindow.StartWebViewAsync`, replace the current `cacheDir` construction with:

```csharp
var cacheDir = Infrastructure.AppPaths.CreateDefault().WebView2CacheDirectory;
Directory.CreateDirectory(cacheDir);
```

- [ ] **Step 6: Run the path test and production build**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter AppPathsTests
dotnet build .\KManager-Client\KManager.csproj -c Release
```

Expected: the test passes; production build reports 0 errors.

- [ ] **Step 7: Commit path injection**

```powershell
git add KManager-Client/Infrastructure/AppPaths.cs KManager-Client/Core/BattleNetCore.cs KManager-Client/MainWindow.xaml.cs KManager-Client.Tests/Infrastructure/AppPathsTests.cs
git commit -m "refactor: centralize KManager application paths"
```

### Task 3: Add a privacy-safe rolling file logger

**Files:**
- Create: `KManager-Client/Infrastructure/AppLogger.cs`
- Create: `KManager-Client.Tests/Infrastructure/AppLoggerTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs`
- Modify: `KManager-Client/WebBridge.cs:19-38`

**Interfaces:**
- Produces: `IAppLogger.Info(string eventName, string detail)`
- Produces: `IAppLogger.Error(string eventName, string errorCode, Exception? exception = null)`
- Produces: `FileAppLogger` and `NullAppLogger.Instance`

- [ ] **Step 1: Write the failing logger test**

Create `KManager-Client.Tests/Infrastructure/AppLoggerTests.cs`:

```csharp
using KManager.Infrastructure;

namespace KManager.Client.Tests.Infrastructure;

public sealed class AppLoggerTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "KManagerLoggerTests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void Error_writes_event_code_and_exception_type_without_exception_message()
    {
        var logger = new FileAppLogger(_root, maxBytes: 64 * 1024, retainedFiles: 2);

        logger.Error("migration", "copy_failed", new InvalidOperationException("secret-token-value"));

        var text = File.ReadAllText(Path.Combine(_root, "kmanager.log"));
        Assert.Contains("migration", text);
        Assert.Contains("copy_failed", text);
        Assert.Contains(nameof(InvalidOperationException), text);
        Assert.DoesNotContain("secret-token-value", text);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, true);
    }
}
```

- [ ] **Step 2: Run the test and confirm it fails to compile**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter AppLoggerTests
```

Expected: compile failure because `FileAppLogger` does not exist.

- [ ] **Step 3: Implement the logger**

Create `KManager-Client/Infrastructure/AppLogger.cs`:

```csharp
using System.Text;

namespace KManager.Infrastructure;

internal interface IAppLogger
{
    void Info(string eventName, string detail);
    void Error(string eventName, string errorCode, Exception? exception = null);
}

internal sealed class NullAppLogger : IAppLogger
{
    public static NullAppLogger Instance { get; } = new();
    private NullAppLogger() { }
    public void Info(string eventName, string detail) { }
    public void Error(string eventName, string errorCode, Exception? exception = null) { }
}

internal sealed class FileAppLogger : IAppLogger
{
    private readonly object _gate = new();
    private readonly string _directory;
    private readonly string _path;
    private readonly long _maxBytes;
    private readonly int _retainedFiles;

    public FileAppLogger(string directory, long maxBytes = 1_048_576, int retainedFiles = 3)
    {
        _directory = directory;
        _path = Path.Combine(directory, "kmanager.log");
        _maxBytes = maxBytes;
        _retainedFiles = Math.Max(1, retainedFiles);
    }

    public void Info(string eventName, string detail) =>
        Write("INFO", eventName, detail);

    public void Error(string eventName, string errorCode, Exception? exception = null)
    {
        var detail = exception == null
            ? errorCode
            : $"{errorCode} exception={exception.GetType().Name}";
        Write("ERROR", eventName, detail);
    }

    private void Write(string level, string eventName, string detail)
    {
        try
        {
            lock (_gate)
            {
                Directory.CreateDirectory(_directory);
                RotateIfNeeded();
                var line = $"{DateTime.UtcNow:O} {level} event={Sanitize(eventName)} {Sanitize(detail)}{Environment.NewLine}";
                File.AppendAllText(_path, line, new UTF8Encoding(false));
            }
        }
        catch
        {
        }
    }

    private void RotateIfNeeded()
    {
        if (!File.Exists(_path) || new FileInfo(_path).Length < _maxBytes)
            return;

        for (var index = _retainedFiles - 1; index >= 1; index--)
        {
            var source = index == 1 ? _path : $"{_path}.{index - 1}";
            var destination = $"{_path}.{index}";
            if (!File.Exists(source))
                continue;
            File.Move(source, destination, overwrite: true);
        }
    }

    private static string Sanitize(string value) =>
        (value ?? string.Empty).Replace('\r', ' ').Replace('\n', ' ');
}
```

- [ ] **Step 4: Extend the core constructor with logging and construct the production logger once**

Add `private readonly Infrastructure.IAppLogger _logger;`, then replace the Task 2 constructors with:

```csharp
public BattleNetCore()
    : this(Infrastructure.AppPaths.CreateDefault())
{
}

private BattleNetCore(Infrastructure.AppPaths paths)
    : this(paths, new Infrastructure.FileAppLogger(paths.LogDirectory), migrateLegacyData: true)
{
}

internal BattleNetCore(
    Infrastructure.AppPaths paths,
    Infrastructure.IAppLogger logger,
    bool migrateLegacyData)
{
    _paths = paths;
    _logger = logger;
    _appDataPath = paths.BattleNetRoamingDirectory;
    _dataDir = paths.DataDirectory;
    _legacyDataDir = paths.LegacyInstallDataDirectory;
    _accountsJsonPath = paths.AccountsJsonPath;
    _groupsJsonPath = paths.GroupsJsonPath;
    _configFilePath = paths.BattleNetConfigPath;
    _migrationStatePath = paths.MigrationStatePath;
    Directory.CreateDirectory(_dataDir);
    if (migrateLegacyData)
        MigrateLegacyDataIfNeeded();
}
```

Do not log account objects, JSON, registry records, paths below account directories, or exception messages.

- [ ] **Step 5: Log core initialization state in `WebBridge`**

Add a logger field and construct the core with the same `AppPaths` instance:

```csharp
private readonly Infrastructure.IAppLogger _logger;
private readonly Task<Core.BattleNetCore> _coreTask;

public WebBridge()
{
    var paths = Infrastructure.AppPaths.CreateDefault();
    _logger = new Infrastructure.FileAppLogger(paths.LogDirectory);
    _coreTask = Task.Run(() =>
    {
        _logger.Info("core_init", "started");
        try
        {
            var core = new Core.BattleNetCore(paths, _logger, migrateLegacyData: true);
            _logger.Info("core_init", "completed");
            return core;
        }
        catch (Exception ex)
        {
            _logger.Error("core_init", "failed", ex);
            throw;
        }
    });
}
```

- [ ] **Step 6: Run logger tests and the client build**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter AppLoggerTests
dotnet build .\KManager-Client\KManager.csproj -c Release
```

Expected: logger test passes; client build has 0 errors.

- [ ] **Step 7: Commit the logger**

```powershell
git add KManager-Client/Infrastructure/AppLogger.cs KManager-Client/Core/BattleNetCore.cs KManager-Client/WebBridge.cs KManager-Client.Tests/Infrastructure/AppLoggerTests.cs
git commit -m "feat: add privacy-safe KManager diagnostics"
```

### Task 4: Lock current account and group behavior with characterization tests

**Files:**
- Create: `KManager-Client.Tests/Core/BattleNetCoreDataTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs` only if a test exposes a path still hard-coded to the real machine

**Interfaces:**
- Consumes: internal `BattleNetCore(AppPaths, IAppLogger, bool)`
- Verifies: existing public `GetAccounts`, `GetGroups`, `DeleteGroup`, and `MoveAccountToGroup`

- [ ] **Step 1: Add the characterization tests**

Create `KManager-Client.Tests/Core/BattleNetCoreDataTests.cs`:

```csharp
using System.Text.Json;
using KManager.Core;
using KManager.Infrastructure;

namespace KManager.Client.Tests.Core;

public sealed class BattleNetCoreDataTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "KManagerCoreTests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void Missing_group_id_is_normalized_to_default()
    {
        var core = CreateCore(out var paths);
        Directory.CreateDirectory(paths.DataDirectory);
        File.WriteAllText(paths.AccountsJsonPath, "[{\"Id\":\"a1\",\"Remark\":\"A\",\"GroupId\":\"\"}]");

        var account = Assert.Single(core.GetAccounts());

        Assert.Equal(BattleNetCore.DefaultGroupId, account.GroupId);
    }

    [Fact]
    public void Deleting_non_default_group_moves_accounts_to_default()
    {
        var core = CreateCore(out var paths);
        Directory.CreateDirectory(paths.DataDirectory);
        File.WriteAllText(paths.GroupsJsonPath, JsonSerializer.Serialize(new[]
        {
            new GroupInfo { Id = BattleNetCore.DefaultGroupId, Name = "默认分组" },
            new GroupInfo { Id = "g1", Name = "Group 1" }
        }));
        File.WriteAllText(paths.AccountsJsonPath, JsonSerializer.Serialize(new[]
        {
            new AccountInfo { Id = "a1", Remark = "A", GroupId = "g1" }
        }));

        Assert.True(core.DeleteGroup("g1"));
        Assert.Equal(BattleNetCore.DefaultGroupId, Assert.Single(core.GetAccounts()).GroupId);
    }

    [Fact]
    public void Default_group_cannot_be_deleted()
    {
        var core = CreateCore(out _);
        Assert.False(core.DeleteGroup(BattleNetCore.DefaultGroupId));
    }

    private BattleNetCore CreateCore(out AppPaths paths)
    {
        paths = AppPaths.CreateForTests(_root);
        return new BattleNetCore(paths, NullAppLogger.Instance, migrateLegacyData: false);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root))
            Directory.Delete(_root, true);
    }
}
```

- [ ] **Step 2: Run the characterization tests**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter BattleNetCoreDataTests
```

Expected: all three tests pass without accessing real application data.

- [ ] **Step 3: Run the complete verification gate**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet build .\KManager-Client\KManager.csproj -c Release
Set-Location .\KManager-UI
npm run lint
npm run build
Set-Location ..
git status --short
```

Expected: all tests pass; C# and frontend builds succeed; lint has no new errors; Git lists only Task 4 files before commit.

- [ ] **Step 4: Commit the characterization suite**

```powershell
git add KManager-Client.Tests/Core/BattleNetCoreDataTests.cs
git commit -m "test: characterize KManager account data behavior"
```

## Plan Completion Gate

Run:

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet build .\KManager-Client\KManager.csproj -c Release
git status --short --branch
```

Expected: all tests pass, client build has 0 errors, and the branch contains exactly four new task commits after the plan-document commits. Do not start plan 2 until this output is reviewed.
