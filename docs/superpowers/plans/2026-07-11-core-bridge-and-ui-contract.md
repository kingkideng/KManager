# KManager Core, Bridge, and UI Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the UI a typed, stable, least-privilege contract while preserving every current account-management workflow.

**Architecture:** Keep `BattleNetCore` as an orchestrator over the repositories and services created in plans 1–3. Expose only an explicit COM interface, normalize all JSON results in TypeScript, and turn startup/data failures into recoverable UI states instead of empty account screens.

**Tech Stack:** .NET 8 COM interop, WebView2, Next.js 15 static export, React 19, TypeScript, Vitest.

## Global Constraints

- Complete plans 1–3 and review the isolated test build before starting.
- Preserve every existing bridge method; new detailed methods must coexist with old boolean wrappers.
- Preserve JSON PascalCase fields consumed by the current frontend.
- Do not redesign layout, colors, cards, title bar, help flow, watermark, or animations.
- Do not enable GPU or change WebView2 process limits.
- Do not remove legacy localStorage avatar fallback until the backend avatar is confirmed persisted.
- Keep all user-facing Chinese strings concise and non-technical.

---

### Task 1: Finish responsibility-based core extraction

**Files:**
- Create: `KManager-Client/BattleNet/BattleNetConfigService.cs`
- Create: `KManager-Client/BattleNet/RegionPolicy.cs`
- Create: `KManager-Client.Tests/BattleNet/RegionPolicyTests.cs`
- Modify: `KManager-Client/Core/BattleNetCore.cs`
- Modify: `KManager-Client/Core/BattleNetCore.Constants.cs`

**Interfaces:**
- Produces: `IRegionPolicy.Normalize`, `IsTagged`, `IsCrossRegion`, `InferFromConfig`
- Produces: `IBattleNetConfigService.CopySavedConfig`, `WriteCleanLoginConfig`
- Preserves: `BattleNetCore` public method signatures

- [ ] **Step 1: Write region characterization tests**

Cover normalization of `asia`, `americas`, `europe`, `cn`, `global`, whitespace and unknown values. Cover `IsCrossRegion` for equal regions, different tagged regions and an unknown current region. Use the current behavior as expected values.

- [ ] **Step 2: Define exact interfaces**

```csharp
internal interface IRegionPolicy
{
    string Normalize(string region);
    bool IsTagged(string region);
    bool IsCrossRegion(string activeRegion, string targetRegion);
    string InferFromConfig(string configPath);
}

internal interface IBattleNetConfigService
{
    SnapshotOperationResult CopySavedConfig(string source, string destination);
    SnapshotOperationResult WriteCleanLoginConfig(string source, string destination, string targetRegion);
    SnapshotOperationResult WriteNewAccountLoginConfig(string destination, string targetRegion);
}
```

- [ ] **Step 3: Move, do not rewrite, current policy bodies**

Move `NormalizeAccountRegion`, `IsTaggedAccountRegion`, `InferRegionFromBattleNetConfig`, `CollectBattleNetRegionValues`, `MapBattleNetRegionCodeToAccountRegion`, clean-login JSON mutation and minimal-login configuration into these services. Keep constants and mappings byte-for-byte equivalent.

- [ ] **Step 4: Inject services and delete only proven duplicates**

Add both services to the internal core constructor. Replace calls one group at a time, run tests after each group, and delete a private core helper only after `rg` shows no remaining references.

- [ ] **Step 5: Verify and commit**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter RegionPolicyTests
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet build .\KManager-Client\KManager.csproj -c Release
git add KManager-Client/BattleNet KManager-Client/Core KManager-Client.Tests/BattleNet/RegionPolicyTests.cs
git commit -m "refactor: isolate Battle.net region and config policy"
```

### Task 2: Replace AutoDual with an explicit bridge interface

**Files:**
- Create: `KManager-Client/IKManagerBridge.cs`
- Create: `KManager-Client.Tests/Bridge/BridgeSurfaceTests.cs`
- Modify: `KManager-Client/WebBridge.cs`
- Modify: `KManager-Client/Core/Results.cs`

**Interfaces:**
- Produces: COM-visible `IKManagerBridge`
- Produces: `CoreInitializationState` and `CoreInitializationStatus`
- Preserves: every current frontend call

- [ ] **Step 1: Add initialization result models**

```csharp
public enum CoreInitializationState { Starting, Migrating, Ready, Failed }

public sealed class CoreInitializationStatus
{
    public string State { get; set; } = "starting";
    public int CompletedItems { get; set; }
    public int TotalItems { get; set; }
    public string ErrorCode { get; set; } = "";
}

public class OperationResult
{
    public bool Success { get; set; }
    public string Code { get; set; } = "";
    public string MessageKey { get; set; } = "";
    public bool Recoverable { get; set; }
}
```

- [ ] **Step 2: Create the explicit COM interface**

Create `IKManagerBridge.cs` with `[ComVisible(true)]` and `[InterfaceType(ComInterfaceType.InterfaceIsDual)]`. Include these methods exactly:

```csharp
string GetInitializationStatus();
bool IsCoreReady();
string GetCoreInitializationError();
string GetAccounts();
string GetGroups();
string CreateGroup(string name);
bool RenameGroup(string id, string name);
bool DeleteGroup(string id);
bool MoveAccountToGroup(string accountId, string groupId);
bool UpdateAccountInfo(string accountId, string remark, string battleTag, string region, string avatarDataUrl);
bool SaveCurrentAccount(string remark, string battleTag, string region, string avatarDataUrl);
string SaveCurrentAccountDetailed(string remark, string battleTag, string region, string avatarDataUrl);
bool SaveCurrentAccountToGroup(string remark, string battleTag, string groupId, string region, string avatarDataUrl);
string SaveCurrentAccountToGroupDetailed(string remark, string battleTag, string groupId, string region, string avatarDataUrl);
bool RefreshAccountSessionState(string id);
string RefreshAccountSessionStateDetailed(string id);
bool SwitchAccount(string id);
string SwitchAccountDetailed(string id);
void DeleteAccount(string id);
bool AddNewAccount(string region);
bool GetAutoStart();
bool SetAutoStartDetailed(bool enabled);
void SetAutoStart(bool enabled);
bool OpenExternalUrl(string url);
bool OpenLogDirectory();
void DragWindow();
void MinimizeApp();
void CloseApp();
```

- [ ] **Step 3: Make `WebBridge` implement only this interface**

Change attributes and declaration to:

```csharp
[ClassInterface(ClassInterfaceType.None)]
[ComVisible(true)]
public sealed class WebBridge : IKManagerBridge
```

Keep old wrappers. `SetAutoStartDetailed` must quote the executable path in the Run value, return false on registry failure, and `GetAutoStart` must compare the stored executable with the current executable rather than accepting any stale value.

Store initialization status in a private field guarded by `lock`; `GetInitializationStatus` returns `JsonSerializer.Serialize(_initializationStatus)`. Set `starting` before creating the task, `migrating` from migration progress, `ready` only after the core constructor completes, and `failed` with code `core_init_failed` in the task catch.

Implement `OpenLogDirectory` without accepting a caller-supplied path:

```csharp
public bool OpenLogDirectory()
{
    try
    {
        var directory = Infrastructure.AppPaths.CreateDefault().LogDirectory;
        Directory.CreateDirectory(directory);
        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{directory}\"") { UseShellExecute = true });
        return true;
    }
    catch (Exception ex)
    {
        _logger.Error("open_logs", "open_log_directory_failed", ex);
        return false;
    }
}
```

- [ ] **Step 4: Add bridge-surface reflection tests**

The test must compare the sorted public instance method names on `WebBridge` against the interface method names and fail if an extra public method is exposed. It must also assert `ClassInterfaceAttribute.Value == ClassInterfaceType.None`.

- [ ] **Step 5: Verify and commit**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter BridgeSurfaceTests
dotnet build .\KManager-Client\KManager.csproj -c Release
git add KManager-Client/IKManagerBridge.cs KManager-Client/WebBridge.cs KManager-Client/Core/Results.cs KManager-Client.Tests/Bridge
git commit -m "security: define explicit WebView bridge surface"
```

### Task 3: Type and test the frontend bridge contract

**Files:**
- Modify: `KManager-UI/package.json`
- Modify: `KManager-UI/package-lock.json`
- Create: `KManager-UI/vitest.config.ts`
- Create: `KManager-UI/lib/bridge.test.ts`
- Modify: `KManager-UI/lib/bridge.ts`
- Modify: `KManager-UI/lib/bridgeResults.ts`

**Interfaces:**
- Produces: TypeScript `KManagerBridge`
- Produces: `OperationResult` and `CoreInitializationStatus` types
- Preserves: MockBridge for browser development

- [ ] **Step 1: Install the test runner**

```powershell
Set-Location .\KManager-UI
npm install --save-dev vitest jsdom
npm pkg set scripts.test="vitest run"
Set-Location ..
```

Expected: package and lock file change; no production dependency is added.

- [ ] **Step 2: Configure Vitest**

Create `KManager-UI/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'jsdom' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 3: Define the typed interface**

In `bridge.ts`, add `CoreInitializationStatus`, `OperationResult`, and a `KManagerBridge` interface containing every method from `IKManagerBridge` with Promise return types. Change `getBridge` to return `KManagerBridge`; cast the WebView host proxy once at the boundary instead of using `any` throughout the page.

- [ ] **Step 4: Add normalizer tests**

Test PascalCase JSON, legacy boolean responses, invalid JSON and the new operation result. Expected invalid values must return stable `invalid_result`, never throw.

- [ ] **Step 5: Verify and commit**

```powershell
Set-Location .\KManager-UI
npm test
npm run lint
npm run build
Set-Location ..
git add KManager-UI/package.json KManager-UI/package-lock.json KManager-UI/vitest.config.ts KManager-UI/lib
git commit -m "test: type the frontend bridge contract"
```

### Task 4: Make startup and data-load failures recoverable

**Files:**
- Create: `KManager-UI/components/StartupState.tsx`
- Modify: `KManager-UI/app/page.tsx:109-200,818-824`
- Modify: `KManager-UI/lib/uiTypes.ts`

**Interfaces:**
- Produces: `StartupViewState = 'loading' | 'ready' | 'failed'`
- Consumes: `GetInitializationStatus`, `GetAccounts`, `GetGroups`, `OpenLogDirectory`

- [ ] **Step 1: Change `loadData` to propagate failures**

Remove its outer catch. Parse both JSON responses inside `try`; on any error throw `new Error('data_load_failed')`. The caller, not `loadData`, owns user-visible state.

- [ ] **Step 2: Replace infinite ready polling**

Poll `GetInitializationStatus` every 250ms. Display `migrating` progress when provided. After 120 seconds without `ready`, set failure code `core_init_timeout`; when state is `failed`, use the returned safe error code. Clear the timer on unmount.

- [ ] **Step 3: Add a failure component**

`StartupState.tsx` accepts `{ code, onRetry, onOpenLogs, isDarkMode }`. It renders a Chinese title, one code-specific explanation, “重试” and “打开日志目录” buttons. It must never display a raw exception message or filesystem path.

- [ ] **Step 4: Preserve the loading layout**

Keep the current centered spinner and background. Add only one line of migration text and `completed/total` when total is positive. Do not mount the account page until state is ready.

- [ ] **Step 5: Verify and commit**

```powershell
Set-Location .\KManager-UI
npm test
npm run lint
npm run build
Set-Location ..
git add KManager-UI/components/StartupState.tsx KManager-UI/app/page.tsx KManager-UI/lib/uiTypes.ts
git commit -m "fix: show recoverable startup failures"
```

### Task 5: Remove remaining UI false-success and legacy-host artifacts

**Files:**
- Create: `KManager-UI/components/TextInputDialog.tsx`
- Modify: `KManager-UI/app/page.tsx:139-232,358-392,601-606,678-695`
- Modify: `KManager-UI/lib/uiTypes.ts`

**Interfaces:**
- Produces: reusable in-app create/rename dialog
- Consumes: `SetAutoStartDetailed`

- [ ] **Step 1: Replace group prompt/alert**

Create one controlled `TextInputDialog` with title, initial value, confirm label, cancel, validation message and async confirm. Use it for create and rename. Keep duplicate-name and empty-name behavior unchanged; show failures through the existing top notice.

- [ ] **Step 2: Make auto-start pessimistic**

Do not update state before the bridge returns. Call `SetAutoStartDetailed(enabled)`; on true set the new value, on false retain the previous value and show an error notice.

- [ ] **Step 3: Restore lazy avatar behavior**

Remove unconditional `localStorage.getItem('avatar_' + account.Id)` from `loadData`. Keep backend `AvatarDataUrl`. The existing visible-account effect may read localStorage only when the account is visible and the backend avatar is empty.

- [ ] **Step 4: Delete the account timeout**

Remove the 150ms `setTimeout` wrapper around `DeleteAccount`. Await the bridge call directly, update UI after success, and retain the current error notice on rejection.

- [ ] **Step 5: Verify all layers and commit**

```powershell
Set-Location .\KManager-UI
npm test
npm run lint
npm run build
Set-Location ..
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet build .\KManager-Client\KManager.csproj -c Release
git diff --check
git add KManager-UI/components/TextInputDialog.tsx KManager-UI/app/page.tsx KManager-UI/lib/uiTypes.ts
git commit -m "refactor: unify KManager UI feedback"
```

## Plan Completion Gate

Use the isolated test build to verify account cards, both account menus, create/rename/delete groups, drag-to-group, save/edit/delete account, legacy prompt, help guide, theme, auto-start failure, minimize, tray hide and second-instance activation. Compare screenshots only for regression detection; do not redesign the UI.
