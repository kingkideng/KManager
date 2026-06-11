# KManager (战网账号管家)

<p align="center">
  <img src="KManager-Client/logo.png" width="128" alt="KManager Logo" />
</p>

KManager 是一款面向 Battle.net 多账号用户的 Windows 桌面工具。它通过保存和切换战网客户端本地会话配置，实现账号快速切换，不记录账号密码，不做内存注入。

> 当前版本：v1.1.0

## v1.1.0 更新重点

- 账号分组：支持创建、重命名、删除分组，旧账号会自动进入“默认分组”。
- 卡片管理：账号卡片左上角三点和右键菜单支持编辑账号信息、移动分组。
- 单实例运行：重复打开 KManager 时会唤起已有窗口，不再多开多个实例。
- 安装器升级兼容：v1.0 安装目录内的 `Data` 会自动迁移到用户数据目录。
- 更适合 setup.exe：账号数据和 WebView2 缓存不再依赖程序安装目录。

## 核心特性

- 高级桌面 UI：WPF + WebView2 外壳，Next.js + TailwindCSS + Motion 前端。
- 一键切换账号：自动关闭战网客户端，替换本地会话配置并重新启动 Battle.net。
- 分组管理：适合国服、外服、小号、亲友号、用途分类等场景。
- 信息编辑：可随时修改账号备注、战网 ID 和所属分组。
- 开机自启与托盘：支持最小化到托盘，随用随唤。
- 安全边界清晰：不保存密码，不注入进程，只管理本地配置文件。

## 下载与安装

前往 [Releases](../../releases) 下载最新版本。

推荐普通用户使用 `setup.exe` 安装包，安装时可以选择安装位置；如果下载的是绿色压缩包，也可以解压后直接运行 `KManager.exe`。

## 从 v1.0 升级

如果你是通过 `setup.exe` 安装的 v1.0：

1. 关闭 KManager 和战网客户端。
2. 直接运行 v1.1 的 `setup.exe` 覆盖安装。
3. 启动 KManager，旧账号会自动迁移到“默认分组”。

v1.1 会把旧安装目录里的：

```text
Data\
```

自动复制到当前 Windows 用户目录：

```text
%LOCALAPPDATA%\KManager\Data
```

迁移只在新目录没有账号数据时执行，不会覆盖已经存在的新数据。旧安装目录里的 `Data` 不会被删除，可以作为备份。

如果你使用绿色压缩包升级，也建议保留旧目录的 `Data` 文件夹；首次运行 v1.1 时同样会自动迁移。

## 使用说明

### 保存账号

1. 打开官方 Battle.net 客户端并登录目标账号。
2. 在 KManager 点击“添加账号”。
3. 选择“保存当前状态”。
4. 填写账号备注、战网 ID，并选择保存到哪个分组。

### 切换账号

双击账号卡片，或点击卡片底部的“切换此号”。KManager 会关闭 Battle.net 和 Agent 进程，替换本地会话配置，然后重新启动 Battle.net。

### 管理分组

- 点击“新建分组”创建分组。
- 分组标题处可展开或折叠。
- 非默认分组可重命名和删除。
- 删除分组不会删除账号，组内账号会回到“默认分组”。

### 编辑账号

账号卡片左上角三点菜单或右键账号卡片，可以：

- 编辑账号备注。
- 编辑战网 ID。
- 移动账号到其他分组。

## 数据位置

v1.1 起，用户数据默认保存在：

```text
%LOCALAPPDATA%\KManager\Data
```

其中：

- `accounts.json` 保存账号备注、战网 ID、分组和最近使用时间。
- `groups.json` 保存分组信息。
- 每个账号目录内的 `Battle.net.config` 是该账号的本地会话配置副本。

WebView2 缓存保存在：

```text
%LOCALAPPDATA%\KManager\WebView2Cache
```

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
../ReleaseAssets/KManager_Setup_v1.1.0.exe
```

## 许可协议

本项目基于 [MIT License](LICENSE) 开源。

## 鸣谢

核心思路参考了 [Watt Toolkit (原 Steam++)](https://github.com/BeyondDimension/SteamTools) 对战网本地 Session 切换机制的开源实践。
