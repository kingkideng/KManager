# KManager Session Transaction and Process Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the last usable Battle.net state whenever capture, restore, shutdown, or launch fails.

**Architecture:** Extract the already-proven clean-exit behavior into a process service, then move Candidate/Current/Backup operations into a transaction service with explicit results and rollback. `BattleNetCore` remains the orchestrator and does not update `LastUsed` until the transaction and launch decision succeed.

**Tech Stack:** .NET 8, System.Diagnostics, Microsoft.Win32, xUnit, temporary filesystem fixtures.

## Global Constraints

- Complete plans 1 and 2 and review their full test output first.
- Do not change the 3-second stable-exit requirement or 30-second client-exit timeout.
- Do not replace normal client shutdown with forced client termination.
- Do not change snapshot contents, region inference, login configuration, or Battle.net launch arguments.
- Never test against the real Battle.net process, registry, or KManager Data directory.
- A failed capture or restore must not update `LastUsed`, Active UI state, or saved configuration.
- Commit one transaction boundary at a time.

---

### Task 1: Extract and test Battle.net process lifecycle control

**Files:**
- Create: `KManager-Client/BattleNet/BattleNetProcessService.cs`
- Create: `KManager-Client/Core/Results.cs`
- Create: `KManager-Client.Tests/BattleNet/BattleNetProcessServiceTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs:447-650,1530-1558`

**Interfaces:**
- Produces: `IBattleNetProcessService`
- Produces: `BattleNetLaunchResult`
- Produces: `PrepareCaptureAsync(CancellationToken)` and `SwitchFastPathAsync(CancellationToken)`

- [ ] **Step 1: Add process result types**

Create `KManager-Client/Core/Results.cs`:

```csharp
namespace KManager.Core;

internal sealed record BattleNetLaunchResult(bool Success, string ErrorCode)
{
    public static BattleNetLaunchResult Ok() => new(true, "");
    public static BattleNetLaunchResult Fail(string code) => new(false, code);
}

internal sealed record SnapshotOperationResult(bool Success, string ErrorCode)
{
    public static SnapshotOperationResult Ok() => new(true, "");
    public static SnapshotOperationResult Fail(string code) => new(false, code);
}
```

- [ ] **Step 2: Define the service interface and test seam**

At the top of `BattleNetProcessService.cs`, define:

```csharp
internal interface IBattleNetProcessService
{
    bool IsClientRunning();
    Task<bool> PrepareCaptureAsync(CancellationToken cancellationToken = default);
    Task SwitchFastPathAsync(CancellationToken cancellationToken = default);
    BattleNetLaunchResult Launch(string region);
}

internal interface IBattleNetProcessProbe
{
    int ClientCount { get; }
    void RequestClientClose();
    void KillAgentProcesses();
    void KillAllBattleNetProcesses();
    BattleNetLaunchResult Launch(string region);
}
```

- [ ] **Step 3: Write deterministic clean-exit tests**

Create a fake probe whose `ClientCount` sequence is supplied by the test. Add tests asserting:

- counts `1, 0, 0, 0` call `RequestClientClose`, then succeed after the configured stable interval;
- counts that remain `1` until the configured timeout return false and never call `KillAgentProcesses`;
- success calls `KillAgentProcesses` exactly once after stable exit.

Construct the service with injectable `stableExitDelay`, `timeout`, `pollDelay`, and `Func<TimeSpan, CancellationToken, Task> delay`. Use zero-duration test values; production constructor uses 3 seconds, 30 seconds, 500ms polling and 1 second Agent delay.

- [ ] **Step 4: Move current process code into the service**

The production factory must use exactly:

```csharp
internal static BattleNetProcessService CreateDefault(IAppLogger logger) =>
    new(
        new WindowsBattleNetProcessProbe(logger),
        logger,
        TimeSpan.FromSeconds(3),
        TimeSpan.FromSeconds(30),
        TimeSpan.FromMilliseconds(500),
        Task.Delay);
```

Move the existing bodies for process discovery, `CloseMainWindow`, Agent termination, executable lookup and `Process.Start` without changing process names or timing. Change `Launch` from silent `void` to:

```csharp
return !File.Exists(exePath)
    ? BattleNetLaunchResult.Fail("battlenet_not_found")
    : StartAndReturnResult(exePath);
```

`StartAndReturnResult` catches exceptions, logs only exception type, and returns `battlenet_launch_failed`.

- [ ] **Step 5: Inject the service into `BattleNetCore`**

Add `IBattleNetProcessService processService` to the internal constructor. The public constructor passes `BattleNetProcessService.CreateDefault(logger)`. Replace calls to the moved process methods with `_processService` calls; keep public core methods and result JSON unchanged in this task.

- [ ] **Step 6: Verify and commit**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter BattleNetProcessServiceTests
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet build .\KManager-Client\KManager.csproj -c Release
git add KManager-Client/BattleNet KManager-Client/Core/Results.cs KManager-Client/Core/BattleNetCore.cs KManager-Client.Tests/BattleNet
git commit -m "refactor: isolate Battle.net process lifecycle"
```

Expected: all tests pass and build reports 0 errors.

### Task 2: Make destructive backup operations fail closed

**Files:**
- Create: `KManager-Client/BattleNet/DirectoryTransfer.cs`
- Create: `KManager-Client.Tests/BattleNet/DirectoryTransferTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs:1364-1449`

**Interfaces:**
- Produces: `IDirectoryTransfer.CopyAndVerify`, `ReplaceFromSnapshot`, `DeleteIfExists`
- Guarantees: source is not deleted when backup verification fails

- [ ] **Step 1: Define the transfer interface**

```csharp
internal interface IDirectoryTransfer
{
    SnapshotOperationResult CopyAndVerify(string source, string destination);
    SnapshotOperationResult ReplaceFromSnapshot(string source, string destination);
    void DeleteIfExists(string path);
}
```

- [ ] **Step 2: Write failure-closed tests**

Add tests with a source containing two files. Inject a copy callback that throws on the second file. Assert `CopyAndVerify` returns `snapshot_copy_failed`, the source files still exist, and the incomplete destination is deleted. Add a successful test asserting source and destination relative file sets and lengths match.

- [ ] **Step 3: Implement deterministic verification**

`DirectoryTransfer.CopyAndVerify` must:

1. delete an old destination;
2. copy with `FileStream` using `FileShare.ReadWrite | FileShare.Delete` on the source;
3. compare sorted relative paths and file lengths;
4. return success only when sets and lengths match;
5. remove the incomplete destination on error.

Do not hash cache contents in this plan because hashing multi-gigabyte snapshots adds startup and switching cost.

- [ ] **Step 4: Replace `BackupAndDeleteDirectory` behavior**

Use this exact decision:

```csharp
var backup = _directoryTransfer.CopyAndVerify(sourcePath, backupPath);
if (!backup.Success)
    return backup;

_directoryTransfer.DeleteIfExists(sourcePath);
return SnapshotOperationResult.Ok();
```

Change callers to stop the reset/switch operation when the result fails. Never catch the error and continue deleting registry or restoring another account.

- [ ] **Step 5: Verify and commit**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter DirectoryTransferTests
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
git add KManager-Client/BattleNet/DirectoryTransfer.cs KManager-Client/Core/BattleNetCore.cs KManager-Client.Tests/BattleNet/DirectoryTransferTests.cs
git commit -m "fix: preserve Battle.net state when backup fails"
```

### Task 3: Implement Candidate/Current/Backup snapshot transactions

**Files:**
- Create: `KManager-Client/BattleNet/SessionSnapshotService.cs`
- Create: `KManager-Client/BattleNet/RegistryStateService.cs`
- Create: `KManager-Client.Tests/BattleNet/SessionSnapshotServiceTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs:760-1033`

**Interfaces:**
- Produces: `ISessionSnapshotService.Capture`, `HasUsableSnapshot`, `Restore`
- Consumes: `IDirectoryTransfer`, `IRegistryStateService`, paths, logger

- [ ] **Step 1: Define the interface**

```csharp
internal interface ISessionSnapshotService
{
    bool HasUsableSnapshot(string accountDirectory);
    SnapshotOperationResult Capture(string accountDirectory, string liveConfigPath);
    SnapshotOperationResult Restore(string accountDirectory, string liveBattleNetDirectory, string liveConfigPath);
}
```

Define `IRegistryStateService` with `Capture(string destination)`, `ClearAndBackup(string backupRoot)`, `Restore(string source)` returning `SnapshotOperationResult`. Move current registry serialization bodies unchanged behind this interface; do not change keys or value names.

- [ ] **Step 2: Write transaction tests**

Use temporary directories and a fake registry service. Cover:

- successful capture replaces Current, updates saved config and removes Backup;
- candidate validation failure keeps old Current and saved config;
- config commit failure restores old Current and old config;
- restore failure returns an error and does not report success;
- `HasUsableSnapshot` preserves current metadata/registry/local-state requirements.

- [ ] **Step 3: Implement capture ordering**

Use these names exactly:

```csharp
var current = Path.Combine(accountDirectory, "BattleNetSessionState");
var candidate = Path.Combine(accountDirectory, "BattleNetSessionStateCandidate");
var backup = Path.Combine(accountDirectory, "BattleNetSessionStateBackup");
var savedConfig = Path.Combine(accountDirectory, "Battle.net.config");
var candidateConfig = Path.Combine(accountDirectory, "Battle.net.config.candidate");
var backupConfig = Path.Combine(accountDirectory, "Battle.net.config.transaction-backup");
```

Capture Candidate and candidate config, validate Candidate, move Current/config to transaction backups, move Candidate/config into place, then delete backups. In `catch`, restore both directory and config backups before returning `snapshot_commit_failed`. Persistent Backup from older versions may be read during rollback migration, but a newly successful transaction must not leave a second full copy.

- [ ] **Step 4: Implement restore results**

Return only these codes: `snapshot_missing`, `snapshot_local_restore_failed`, `snapshot_registry_restore_failed`, `snapshot_config_restore_failed`. Perform local state, registry and config restore in that order; if an intermediate step fails, use the reset backups created before restore to return the machine to its pre-operation state.

- [ ] **Step 5: Integrate without changing public results**

Replace `TrySaveCurrentBattleNetSessionSnapshot`, `HasBattleNetSessionState`, and `RestoreBattleNetSessionState` calls with the service. Map new internal error codes to existing `missing_session_snapshot` until plan 4 expands the bridge contract. Keep `SaveAccountResult` and `SwitchAccountResult` JSON unchanged.

- [ ] **Step 6: Verify and commit**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter SessionSnapshotServiceTests
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet build .\KManager-Client\KManager.csproj -c Release
git add KManager-Client/BattleNet/SessionSnapshotService.cs KManager-Client/Core/BattleNetCore.cs KManager-Client.Tests/BattleNet/SessionSnapshotServiceTests.cs
git commit -m "fix: make session snapshots transactional"
```

### Task 4: Prevent premature Active updates and expose launch failures internally

**Files:**
- Create: `KManager-Client.Tests/Core/SwitchTransactionTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs:299-421`

**Interfaces:**
- Consumes: fake process and snapshot services
- Verifies: `LastUsed` changes only after file transaction success

- [ ] **Step 1: Add orchestration tests**

Construct `BattleNetCore` with temporary paths, a fake process service and fake snapshot service. Test three cases: exit timeout, restore failure, and successful switch. Assert the first two preserve the original `LastUsed`; assert success updates it and invokes launch once.

- [ ] **Step 2: Reorder the core method**

In `SwitchAccountDetailedAsync`, keep `targetAccount.LastUsed` and `SaveAccounts(accounts)` after configuration/snapshot commit. Call `_processService.Launch` next. If launch fails, return failure code but do not roll back an already committed target configuration; the UI will offer retry in plan 4. Record this state as `battlenet_launch_failed`.

- [ ] **Step 3: Complete verification**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet build .\KManager-Client\KManager.csproj -c Release
Set-Location .\KManager-UI
npm run lint
npm run build
Set-Location ..
git diff --check
```

- [ ] **Step 4: Commit**

```powershell
git add KManager-Client/Core/BattleNetCore.cs KManager-Client.Tests/Core/SwitchTransactionTests.cs
git commit -m "fix: update active account after successful commit"
```

## Plan Completion Gate

Produce an isolated folder test build using `KM_TEST_BUILD`. Verify same-region switching, one cross-region switch, a forced client-exit timeout, and a simulated snapshot-copy failure using copied fixture data. Stop for user review; do not publish or install over the stable version.
