# KManager Security, CI, and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the local WebView boundary, automate repeatable verification, and prepare an isolated `v2.0.1` test release without publishing it.

**Architecture:** Restrict navigation at the WPF host, make frontend synchronization deterministic, and use PowerShell verification as the single release gate. CI proves source quality; the local release script additionally validates Windows binaries, versions, hashes, artifacts, and signature status.

**Tech Stack:** WPF/WebView2, Next.js, GitHub Actions on Windows, PowerShell 7/Windows PowerShell, Inno Setup.

## Global Constraints

- Complete and review plans 1–4 first.
- Do not publish a GitHub Release, move a tag, push, or replace installed stable files without a new explicit user request.
- Target version is `2.0.1`; never overwrite `v2.0` again.
- Test delivery remains folder-only, isolated by `KM_TEST_BUILD`, with no zip and no shared stable data.
- Keep WebView2 GPU disabled and preserve runtime bootstrapper/repair behavior.
- Treat Data and logs as local sensitive material; never upload them as CI artifacts.
- `npm audit fix --force` is forbidden.

---

### Task 1: Restrict WebView2 navigation and release diagnostics

**Files:**
- Create: `KManager-Client/WebViewPolicy.cs`
- Create: `KManager-Client.Tests/Bridge/WebViewPolicyTests.cs`
- Modify: `KManager-Client/MainWindow.xaml.cs:125-164`

**Interfaces:**
- Produces: `WebViewPolicy.IsAllowedAppUri(Uri)`
- Enforces: only `http://app.local/` inside the embedded WebView

- [ ] **Step 1: Write policy tests**

Test that these are allowed/rejected exactly:

```csharp
[Theory]
[InlineData("http://app.local/index.html", true)]
[InlineData("http://app.local/_next/static/app.js", true)]
[InlineData("https://app.local/index.html", false)]
[InlineData("http://github.com/kingkideng/KManager", false)]
[InlineData("file:///C:/temp/index.html", false)]
[InlineData("javascript:alert(1)", false)]
public void Navigation_policy_is_allowlist_only(string value, bool expected)
{
    Assert.Equal(expected, WebViewPolicy.IsAllowedAppUri(new Uri(value)));
}
```

- [ ] **Step 2: Implement the policy**

```csharp
namespace KManager;

internal static class WebViewPolicy
{
    internal static bool IsAllowedAppUri(Uri uri) =>
        uri.Scheme == Uri.UriSchemeHttp
        && string.Equals(uri.Host, "app.local", StringComparison.OrdinalIgnoreCase)
        && uri.Port == 80;
}
```

- [ ] **Step 3: Enforce it before navigation completes**

After `EnsureCoreWebView2Async`, add:

```csharp
webView.CoreWebView2.NavigationStarting += (_, args) =>
{
    if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) || !WebViewPolicy.IsAllowedAppUri(uri))
    {
        args.Cancel = true;
        ShowStartupError("KManager 已阻止异常页面导航。");
    }
};

#if !DEBUG
webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
#endif
```

Keep `OpenExternalUrl` as the only GitHub-opening path.

- [ ] **Step 4: Verify and commit**

```powershell
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release --filter WebViewPolicyTests
dotnet build .\KManager-Client\KManager.csproj -c Release
git add KManager-Client/WebViewPolicy.cs KManager-Client/MainWindow.xaml.cs KManager-Client.Tests/Bridge/WebViewPolicyTests.cs
git commit -m "security: restrict embedded WebView navigation"
```

### Task 2: Make frontend output deterministic and centralize synchronization

**Files:**
- Modify: `KManager-UI/next.config.ts`
- Create: `scripts/Sync-Frontend.ps1`
- Create: `scripts/Test-FrontendSync.ps1`

**Interfaces:**
- Produces: `Sync-Frontend.ps1 -RepositoryRoot <path>`
- Guarantees: `out` and `wwwroot` contain identical relative files and hashes

- [ ] **Step 1: Add deterministic build ID selection**

Add to `nextConfig`:

```typescript
generateBuildId: async () => process.env.KMANAGER_BUILD_ID || 'kmanager-local',
```

CI and release commands must set `KMANAGER_BUILD_ID=2.0.1`; local builds use `kmanager-local`.

- [ ] **Step 2: Create the sync script**

Create `scripts/Sync-Frontend.ps1` with parameters:

```powershell
param([Parameter(Mandatory=$true)][string]$RepositoryRoot)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$source = Join-Path $root 'KManager-UI\out'
$target = Join-Path $root 'KManager-Client\wwwroot'
if (-not (Test-Path -LiteralPath (Join-Path $source 'index.html'))) { throw 'frontend_output_missing' }
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
New-Item -ItemType Directory -Path $target | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $target -Recurse -Force
```

- [ ] **Step 3: Create a hash comparison script**

Create `scripts/Test-FrontendSync.ps1`:

```powershell
param([Parameter(Mandatory=$true)][string]$RepositoryRoot)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$leftRoot = (Resolve-Path -LiteralPath (Join-Path $root 'KManager-UI\out')).Path
$rightRoot = (Resolve-Path -LiteralPath (Join-Path $root 'KManager-Client\wwwroot')).Path

function Get-HashMap([string]$base) {
  $map = @{}
  Get-ChildItem -LiteralPath $base -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($base.Length + 1)
    $map[$relative] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
  }
  return $map
}

$left = Get-HashMap $leftRoot
$right = Get-HashMap $rightRoot
$keys = @($left.Keys + $right.Keys | Sort-Object -Unique)
$different = @($keys | Where-Object { $left[$_] -ne $right[$_] })
if ($different.Count -gt 0) {
  $different | ForEach-Object { Write-Error "frontend_mismatch: $_" }
  exit 1
}
Write-Output "frontend_sync_ok files=$($keys.Count)"
```

- [ ] **Step 4: Prove the gate fails then passes**

Build once, create a temporary extra file under `wwwroot`, run the comparison and expect exit 1. Remove only that temporary file, run `Sync-Frontend.ps1`, then rerun comparison and expect exit 0.

- [ ] **Step 5: Commit**

```powershell
git add KManager-UI/next.config.ts scripts/Sync-Frontend.ps1 scripts/Test-FrontendSync.ps1 KManager-Client/wwwroot
git commit -m "build: make frontend synchronization verifiable"
```

### Task 3: Add Windows continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: repeatable source verification for pushes and pull requests

- [ ] **Step 1: Create the workflow**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: windows-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: KManager-UI/package-lock.json
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: 8.0.x
      - name: Install frontend dependencies
        working-directory: KManager-UI
        run: npm ci
      - name: Lint frontend
        working-directory: KManager-UI
        run: npm run lint
      - name: Test frontend
        working-directory: KManager-UI
        run: npm test
      - name: Build frontend
        working-directory: KManager-UI
        env:
          KMANAGER_BUILD_ID: 2.0.1
        run: npm run build
      - name: Sync frontend
        shell: pwsh
        run: ./scripts/Sync-Frontend.ps1 -RepositoryRoot $PWD
      - name: Verify frontend sync
        shell: pwsh
        run: ./scripts/Test-FrontendSync.ps1 -RepositoryRoot $PWD
      - name: Test client
        run: dotnet test ./KManager-Client.Tests/KManager-Client.Tests.csproj -c Release
      - name: Build client
        run: dotnet build ./KManager-Client/KManager.csproj -c Release
      - name: Check NuGet vulnerabilities
        run: dotnet list ./KManager-Client/KManager.csproj package --vulnerable --include-transitive
      - name: Report npm audit
        continue-on-error: true
        working-directory: KManager-UI
        run: npm audit --omit=dev
      - name: Ensure generated changes are intentional
        shell: pwsh
        run: git diff --check
```

- [ ] **Step 2: Run the workflow commands locally**

Run every command in workflow order. Expected: all required commands exit 0; npm audit may report the known transitive PostCSS advisory but must not modify dependencies.

- [ ] **Step 3: Commit**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: verify KManager on Windows"
```

### Task 4: Add a release verification script

**Files:**
- Create: `scripts/Verify-Release.ps1`
- Create: `scripts/Build-TestRelease.ps1`

**Interfaces:**
- Produces: version, content, hash and signature report
- Produces: isolated folder under outer `TestBuild`

- [ ] **Step 1: Implement version verification**

`Verify-Release.ps1` accepts `-RepositoryRoot`, `-ExpectedVersion`, `-InstallerPath`, and optional `-RequireSignature`. It must:

- parse `KManager-UI/package.json` version;
- parse `KManager.csproj` `Version`, `FileVersion`, `InformationalVersion`;
- parse `installer/KManager.iss` `MyAppVersion`;
- fail when any value differs from `2.0.1`/`2.0.1.0` as applicable;
- run `Test-FrontendSync.ps1`;
- print SHA-256 for published `KManager.exe` and installer;
- call `Get-AuthenticodeSignature` for both;
- fail on non-Valid signatures only when `-RequireSignature` is supplied;
- print `UNSIGNED_TEST_ARTIFACT` when signature is missing in normal test mode.

- [ ] **Step 2: Implement isolated test publishing**

`Build-TestRelease.ps1` must resolve the repo and outer folder, build/sync frontend with build ID `2.0.1-test`, and publish using:

```powershell
dotnet publish "$repo\KManager-Client\KManager.csproj" -c Release -r win-x64 --self-contained true -p:DefineConstants=KM_TEST_BUILD -o "$outer\TestBuild\KManager-v2.0.1-Test"
```

Before deleting an old test directory, resolve its absolute path and verify it starts with the resolved outer `TestBuild` path. Delete only old `KManager-*-Test` directories and test zips; never delete unrecognized files.

- [ ] **Step 3: Execute test build and report**

Run `Build-TestRelease.ps1`, then `Verify-Release.ps1` without `-RequireSignature`. Expected: isolated folder exists, version checks pass, signature report says unsigned test artifact, and no stable Data/install location changes.

- [ ] **Step 4: Commit**

```powershell
git add scripts/Verify-Release.ps1 scripts/Build-TestRelease.ps1
git commit -m "build: add KManager release verification"
```

### Task 5: Align `v2.0.1` metadata and documentation

**Files:**
- Modify: `KManager-UI/package.json`
- Modify: `KManager-UI/package-lock.json`
- Modify: `KManager-Client/KManager.csproj`
- Modify: `installer/KManager.iss`
- Modify: `installer/KManager.Beta.iss`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `C:\Users\KK\Desktop\KManager\PROJECT_CONTEXT.md`

**Interfaces:**
- Produces: consistent `2.0.1` metadata and user-facing change record

- [ ] **Step 1: Change versions consistently**

Set UI package version to `2.0.1`; C# `Version` and `InformationalVersion` to `2.0.1`; `FileVersion` and `AssemblyVersion` to `2.0.1.0`; both installer script versions to `2.0.1` and version resources to `2.0.1.0`.

- [ ] **Step 2: Write release notes without overstating behavior**

Add a `v2.0.1` CHANGELOG section covering data recovery, migration transactions, snapshot rollback, diagnostics, bridge/UI error handling and build verification. State that switching behavior and official Battle.net verification rules are unchanged.

- [ ] **Step 3: Update project context**

Record the five-plan implementation, new tests, atomic data rules, log location, test artifact path and the rule that snapshot slimming/encryption/rendering remain experiments. Read the file back explicitly as UTF-8.

- [ ] **Step 4: Run the complete gate**

```powershell
Set-Location .\KManager-UI
npm ci
npm test
npm run lint
$env:KMANAGER_BUILD_ID='2.0.1'
npm run build
Set-Location ..
.\scripts\Sync-Frontend.ps1 -RepositoryRoot $PWD
.\scripts\Test-FrontendSync.ps1 -RepositoryRoot $PWD
dotnet test .\KManager-Client.Tests\KManager-Client.Tests.csproj -c Release
dotnet publish .\KManager-Client\KManager.csproj -c Release -r win-x64 --self-contained true
& 'C:\Users\KK\Desktop\KManager\Tools\InnoSetup\ISCC.exe' '.\installer\KManager.iss'
.\scripts\Verify-Release.ps1 -RepositoryRoot $PWD -ExpectedVersion '2.0.1' -InstallerPath 'C:\Users\KK\Desktop\KManager\ReleaseAssets\KManager_Setup_v2.0.1.exe'
git diff --check
```

Expected: required tests/builds/version/content checks pass. Signature may report unsigned unless a real certificate is available. Do not publish.

- [ ] **Step 5: Commit metadata and docs**

```powershell
git add KManager-UI/package.json KManager-UI/package-lock.json KManager-Client/KManager.csproj installer/KManager.iss installer/KManager.Beta.iss CHANGELOG.md README.md KManager-Client/wwwroot
git commit -m "chore: prepare KManager v2.0.1 test release"
```

Then verify whether the outer context file is tracked in the outer repository:

```powershell
git -C 'C:\Users\KK\Desktop\KManager' ls-files --error-unmatch PROJECT_CONTEXT.md
```

If exit code is 0, commit it separately with:

```powershell
git -C 'C:\Users\KK\Desktop\KManager' add PROJECT_CONTEXT.md
git -C 'C:\Users\KK\Desktop\KManager' commit -m "docs: record KManager v2.0.1 optimization workflow"
```

If it is not tracked there, leave the verified UTF-8 file in place and report that state. Do not copy the context file into SourceRepo.

## Plan Completion Gate

Deliver only `C:\Users\KK\Desktop\KManager\TestBuild\KManager-v2.0.1-Test` for manual testing. Do not create a test zip. Do not publish, tag, push, or install over stable KManager. Record manual results for new install, v1/beta/v2 migration, corrupt JSON recovery, client-exit timeout, missing snapshot, same-region switch, cross-region switch, old untagged account, tray behavior and WebView2 startup.
