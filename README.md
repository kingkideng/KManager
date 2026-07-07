# KManager

<p align="center">
  <img src="KManager-Client/logo.png" width="96" alt="KManager Logo" />
</p>

<p align="center">
  <strong>战网账号管家</strong><br />
  为 Battle.net 多账号玩家准备的 Windows 桌面工具
</p>

<p align="center">
  <a href="https://github.com/kingkideng/KManager/releases/latest">下载最新版</a>
  ·
  <a href="#快速开始">快速开始</a>
  ·
  <a href="#数据与安全">数据与安全</a>
</p>

<p align="center">
  <img src="docs/images/kmanager-cover.png" alt="KManager 战网账号管理器封面" />
</p>

KManager 通过保存并切换 Battle.net 客户端的本地登录配置，让多个战网账号之间的切换更顺手。已经保存过的账号，后续通常可以直接切换进入登录状态，减少反复输入账号、等待验证码、重新登录的打断。

> 当前版本：v2.0

## v2.0 更新重点

- 新增区服标签，账号可标记为亚服、美服、欧服或国服。
- 支持按账号区服切换战网登录状态，国服和国际服互切时会清理必要的本地状态并恢复目标账号快照。
- 新增账号头像自定义、账号删除、登录状态更新和登录新号时选择区服。
- 新增首次使用指南和旧版本升级引导；beta 测试版用户的账号数据会自动导入正式版。

## 适合谁

- 有多个同区 Battle.net 账号、小号、亲友号需要来回切换。
- 不想每次换号都重新输账号、收验证码、等登录流程。
- 希望账号按用途和区服分组，比如“大号”“小号”“亲友号”“亚服”“国服”等。
- 希望数据保存在本地，不把账号密码交给第三方服务。

KManager 不绕过战网官方验证。已保存且会话有效的账号通常可以直接进入登录状态；如果官方会话过期、换设备/IP 或触发安全验证，仍需按战网官方流程重新登录或验证。

## 快速开始

### 1. 下载安装

前往 [Releases](https://github.com/kingkideng/KManager/releases/latest) 下载最新版本。

推荐普通用户下载并运行：

```text
KManager_Setup_v2.0.exe
```

如果你更喜欢绿色版，也可以下载：

```text
KManager-v2.0-win-x64.zip
```

解压后运行其中的 `KManager.exe`。

### 2. 保存第一个账号

1. 打开官方 Battle.net 客户端。
2. 登录你想保存的战网账号。
3. 打开 KManager，点击右上角“添加账号”。
4. 选择“保存当前状态”。
5. 填写账号备注、战网 ID、所属分组和区服。

保存完成后，这个账号会以卡片形式出现在 KManager 里。

### 3. 保存更多账号

1. 在 KManager 点击“添加账号”。
2. 选择“前往登录新号”。
3. 在 Battle.net 客户端登录另一个账号。
4. 回到 KManager，再次点击“添加账号”并保存当前状态。

每个账号都会单独保存一份本地登录配置。

### 4. 切换账号

双击账号卡片，或点击卡片底部的“切换此号”。

KManager 会自动关闭 Battle.net 和 Agent 进程，替换为目标账号的本地登录配置和必要的本地登录状态，然后重新启动 Battle.net。已经保存且会话仍有效的账号，通常可以直接进入登录状态。

如果 Battle.net 官方会话过期，或触发官方安全验证，仍然需要按官方流程重新验证。登录成功后，可以在账号卡片菜单里点击“更新登录状态”。

### 5. 管理分组和账号信息

- 点击“新建分组”创建分组。
- 点击分组标题可以展开或折叠。
- 账号卡片左上角三点菜单，或右键账号卡片，可以编辑账号信息、更新登录状态、删除账号记录。
- 编辑账号时可以选择区服，也可以自定义账号头像。
- 在卡片菜单里可以把账号移动到其他分组。
- 也可以轻量拖拽账号卡片到其他分组。
- 删除分组不会删除账号，组内账号会回到“默认分组”。

## 主要功能

- 一键切换账号：保存并替换 Battle.net 本地登录配置。
- 区服切换：账号可标记为亚服、美服、欧服或国服。
- 账号分组：按用途整理账号，折叠不常用分组。
- 卡片编辑：修改账号备注、战网 ID、所属分组、区服和头像。
- 更新登录状态：账号重新登录成功后，可刷新本地登录状态快照。
- 单实例运行：重复打开软件时会唤起已有窗口，不会多开多个实例。
- 开机自启与托盘：适合长期挂在后台，随用随唤。
- 本地数据：不保存账号密码，不上传账号数据，不注入游戏或客户端进程。

## 从旧版本升级

如果你之前使用过旧版本：

1. 关闭 KManager 和 Battle.net 客户端。
2. 直接运行新版 `KManager_Setup_v2.0.exe` 覆盖安装。
3. 启动 KManager，旧账号会自动保留；beta 测试版数据也会自动导入正式版。

没有区服标签的旧账号会显示“待标记区服”。你可以先点击“登录此号”按旧版方式打开战网；确认账号登录成功后，回到 KManager 编辑账号补充区服，再点击“更新登录状态”。

KManager 会把旧安装目录里的：

```text
Data\
```

自动复制到当前 Windows 用户目录：

```text
%LOCALAPPDATA%\KManager\Data
```

迁移只在新目录没有账号数据时执行，不会覆盖已经存在的新数据。旧安装目录里的 `Data` 不会被删除，可以作为备份。

## 数据与安全

KManager 不保存 Battle.net 密码，也不做内存注入。它管理的是 Battle.net 客户端已经生成的本地登录配置文件。

用户数据默认保存在：

```text
%LOCALAPPDATA%\KManager\Data
```

其中：

- `accounts.json` 保存账号备注、战网 ID、分组和最近使用时间。
- `groups.json` 保存分组信息。
- 每个账号目录内的 `Battle.net.config` 是该账号的本地登录配置副本。
- 新版账号目录可能包含 `BattleNetSessionState`，保存战网本机登录状态快照，用于更稳定地切换区服。

这些数据都只保存在你的电脑本机。不要把整个 `Data` 目录发给别人，它可能包含有效登录态。

WebView2 缓存保存在：

```text
%LOCALAPPDATA%\KManager\WebView2Cache
```

## 最新更新

### v2.0

- 新增亚服、美服、欧服、国服区服标签，并支持按区服切换账号。
- 新增完整登录状态快照、更新登录状态、登录新号时选择区服。
- 新增账号头像自定义和账号删除入口。
- 新增首次使用指南、旧账号升级引导和 beta 数据导入。

### v1.1.4

- 最小化或隐藏到托盘时主动回收内存，降低后台常驻占用。
- 限制 WebView2 渲染进程和 V8 堆大小，减少活跃内存开销。
- 新增最小化按钮；关闭按钮改为隐藏到托盘。
- 启用 .NET Concurrent Workstation GC。

### v1.1.3

- 启动时自动检测 WebView2 Runtime，正常环境不显示额外提示。
- 缺少 WebView2 Runtime 时，用户确认后使用内置 Bootstrapper 联网下载安装。
- WebView2 启动失败时可尝试联网安装/修复 Runtime。

### v1.1.2

- 改善少数电脑上 WebView2 启动后窗口空白的问题。
- WebView2 启动失败时显示中文错误提示，便于修复运行环境。
- 根据屏幕工作区固定窗口尺寸，并禁止手动拉伸，避免顶部白条和布局变形。

### v1.1.1

- 新增软件内 `@Jayden` 水印，点击可打开 GitHub 项目主页。
- 重新构建并发布安装包和绿色压缩包。
- 更新 README、版本号和安装器元数据。

### v1.1.0

- 新增账号分组：创建、重命名、删除、展开折叠、跨组移动。
- 账号卡片左上角三点和右键菜单支持编辑信息、移动分组。
- 新增单实例启动：重复打开时唤起已有窗口。
- 用户数据和 WebView2 缓存迁移到 `%LOCALAPPDATA%\KManager`。
- v1.0 安装目录内的旧数据可自动迁移。

## 本地开发与编译

项目结构：

```text
KManager-Client  C# WPF / WebView2 桌面壳和系统能力
KManager-UI      Next.js 静态前端
```

本仓库不提交 `node_modules`、`.next`、`out`、`bin`、`obj` 等可再生成内容。别人从开源仓库复刻或二次开发时，按下面流程从源码重新安装依赖并构建即可。

环境准备：

- Windows 10/11
- .NET 8 SDK，需包含 Windows Desktop / WPF 支持
- Node.js 20 或更新版本
- 如需打包安装程序，额外安装 Inno Setup

从源码构建前端：

```bash
cd KManager-UI
npm install
npm run build
```

然后将 `KManager-UI/out` 内容同步到 `KManager-Client/wwwroot`。在 PowerShell 中可直接执行：

```powershell
$source = Resolve-Path .\KManager-UI\out
$target = Resolve-Path .\KManager-Client\wwwroot
Remove-Item -LiteralPath $target.Path -Recurse -Force
New-Item -ItemType Directory -Path $target.Path | Out-Null
Copy-Item -Path (Join-Path $source.Path '*') -Destination $target.Path -Recurse -Force
```

如果只修改 C# 桌面端逻辑，可以直接使用仓库中已有的 `KManager-Client/wwwroot`；如果修改了 `KManager-UI`，必须重新执行前端构建并同步 `wwwroot`。

构建 Windows 客户端：

```bash
cd KManager-Client
dotnet publish -c Release -r win-x64 --self-contained true
```

发布输出位于：

```text
KManager-Client/bin/Release/net8.0-windows/win-x64/publish
```

构建 `setup.exe` 安装包需要安装 Inno Setup，然后在仓库根目录运行：

```bash
iscc installer/KManager.iss
```

安装包输出到：

```text
../ReleaseAssets/KManager_Setup_v2.0.exe
```

## 许可协议

本项目基于 [MIT License](LICENSE) 开源。

## 鸣谢

核心思路参考了 [Watt Toolkit (原 Steam++)](https://github.com/BeyondDimension/SteamTools) 对战网本地 Session 切换机制的开源实践。
