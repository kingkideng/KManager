# KManager (战网账号管家)

<p align="center">
  <img src="KManager-Client/logo.png" width="128" alt="KManager Logo" />
</p>

KManager 是一款拥有极简、高级 UI 设计的**战网（Battle.net）多账号无缝切换工具**。只需在官方战网客户端正常登录一次，即可提取并永久保存该账号的登录凭证。之后无论您有多少个国服/外服账号，都可以通过 KManager 实现**一键无缝秒切**，彻底告别繁琐的密码输入和安全令验证！

## ✨ 核心特性

- 🎨 **高级感 UI 设计**: 采用 Next.js + TailwindCSS + Framer Motion 构建的现代化前端界面，支持深浅色模式自动检测切换，拥有原生桌面级的丝滑拖拽与物理动画体验。
- ⚡ **一键无缝切换**: 底层通过 C# 智能管理战网核心配置文件，切换账号如同本地切换文件夹一样迅速。
- 🛡️ **安全可靠**: 不涉及任何内存注入或密码记录，完全基于战网官方的本地会话（Session）机制实现，绿色安全。
- 🚀 **开机自启与静默托盘**: 支持开机自动隐藏到右下角托盘，随用随唤。

## 📦 下载与安装

1. 前往 [Releases](../../releases) 页面下载最新版本。
2. 解压到一个固定目录（建议不要放在包含中文或特殊字符的路径下）。
3. 双击运行 `KManager.exe` 即可。

## 🎮 使用说明

1. **保存账号**：
   - 先打开官方战网客户端，正常登录您的任意一个账号。
   - 在 KManager 界面中点击右上角的 **“添加账号”** -> **“保存当前状态”**。
   - 随意输入一个备注（例如：国服大号），点击确认即可永久保存。
2. **切换账号**：
   - 在列表中双击任意卡片，或点击卡片下方的“切换此号”，KManager 会自动帮您重启战网客户端并直接登入该账号。
3. **登录新号**：
   - 点击 **“添加账号”** -> **“前往登录新号”**，KManager 会强制关闭战网并清理当前登录状态，让您可以输入全新的账号密码进行登录。

## 🛠️ 本地开发与编译

本项目架构为 `C# WPF (WebView2)` + `Next.js`，包含前后端分离源码：

1. **前端构建 (KManager-UI)**：
   进入 `KManager-UI` 目录：
   ```bash
   npm install
   npm run build
   ```
   将 `out` 目录下的所有文件复制到外层 C# 工程的 `wwwroot` 目录下。

2. **C# 客户端编译 (KManager-Client)**：
   在安装了 .NET 8 SDK 的环境下进入 `KManager-Client` 运行：
   ```bash
   dotnet publish -c Release -r win-x64 --self-contained true
   ```

## 📄 许可协议

本项目基于 [MIT License](LICENSE) 开源，您可以自由修改、分发和用于商业用途。

## 🙏 鸣谢 (Credits)

* **核心思路借鉴**: 感谢 [Watt Toolkit (原 Steam++)](https://github.com/BeyondDimension/SteamTools) 为战网本地 Session 切换机制提供的开源参考与灵感！
