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

> 当前版本：v1.1.3

## v1.1.3 更新重点

- 启动时自动检测 Microsoft Edge WebView2 Runtime，环境正常时不显示任何额外提示。
- 缺少 WebView2 Runtime 时提示用户确认，并使用内置 Bootstrapper 联网下载和安装运行环境。
- WebView2 启动失败时可尝试联网安装/修复 Runtime，减少少数电脑打开后无法显示界面的情况。

## 适合谁

- 有多个同区 Battle.net 账号、小号、亲友号需要来回切换。
- 不想每次换号都重新输账号、收验证码、等登录流程。
- 希望账号按用途分组，比如“大号”“小号”“亲友号”“未排位”等。
- 希望数据保存在本地，不把账号密码交给第三方服务。

当前版本暂不支持国服和外服之间互相切换，这个功能会在后续版本继续完善。

## 快速开始

### 1. 下载安装

前往 [Releases](https://github.com/kingkideng/KManager/releases/latest) 下载最新版本。

推荐普通用户下载并运行：

```text
KManager_Setup_v1.1.3.exe
```

如果你更喜欢绿色版，也可以下载：

```text
KManager-v1.1.3-win-x64.zip
```

解压后运行其中的 `KManager.exe`。

### 2. 保存第一个账号

1. 打开官方 Battle.net 客户端。
2. 登录你想保存的战网账号。
3. 打开 KManager，点击右上角“添加账号”。
4. 选择“保存当前状态”。
5. 填写账号备注、战网 ID，并选择保存到哪个分组。

保存完成后，这个账号会以卡片形式出现在 KManager 里。

### 3. 保存更多账号

1. 在 KManager 点击“添加账号”。
2. 选择“前往登录新号”。
3. 在 Battle.net 客户端登录另一个账号。
4. 回到 KManager，再次点击“添加账号”并保存当前状态。

每个账号都会单独保存一份本地登录配置。

### 4. 切换账号

双击账号卡片，或点击卡片底部的“切换此号”。

KManager 会自动关闭 Battle.net 和 Agent 进程，替换为目标账号的本地登录配置，然后重新启动 Battle.net。已经保存且会话仍有效的账号，通常可以直接进入登录状态。

如果 Battle.net 官方会话过期，或触发官方安全验证，仍然需要按官方流程重新验证。

### 5. 管理分组和账号信息

- 点击“新建分组”创建分组。
- 点击分组标题可以展开或折叠。
- 账号卡片左上角三点菜单，或右键账号卡片，可以编辑账号信息。
- 在卡片菜单里可以把账号移动到其他分组。
- 也可以轻量拖拽账号卡片到其他分组。
- 删除分组不会删除账号，组内账号会回到“默认分组”。

## 主要功能

- 一键切换账号：保存并替换 Battle.net 本地登录配置。
- 账号分组：按用途整理账号，折叠不常用分组。
- 卡片编辑：修改账号备注、战网 ID、所属分组。
- 单实例运行：重复打开软件时会唤起已有窗口，不会多开多个实例。
- 开机自启与托盘：适合长期挂在后台，随用随唤。
- 本地数据：不保存账号密码，不上传账号数据，不注入游戏或客户端进程。

## 从 v1.0 升级

如果你之前是通过 `setup.exe` 安装的 v1.0：

1. 关闭 KManager 和 Battle.net 客户端。
2. 直接运行新版 `KManager_Setup_v1.1.3.exe` 覆盖安装。
3. 启动 KManager，旧账号会自动迁移到“默认分组”。

v1.1 起，KManager 会把旧安装目录里的：

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

WebView2 缓存保存在：

```text
%LOCALAPPDATA%\KManager\WebView2Cache
```

## 最新更新

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

构建前端：

```bash
cd KManager-UI
npm install
npm run build
```

然后将 `KManager-UI/out` 内容复制到 `KManager-Client/wwwroot`。

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
../ReleaseAssets/KManager_Setup_v1.1.3.exe
```

## 许可协议

本项目基于 [MIT License](LICENSE) 开源。

## 鸣谢

核心思路参考了 [Watt Toolkit (原 Steam++)](https://github.com/BeyondDimension/SteamTools) 对战网本地 Session 切换机制的开源实践。
