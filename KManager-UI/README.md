# KManager UI

KManager 的前端界面，使用 Next.js、TailwindCSS 和 Motion 构建，并通过 WebView2 嵌入到 `KManager-Client` 桌面壳中。

## 本地开发

要求：

- Node.js 20 或更高版本

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

构建静态资源：

```bash
npm run build
```

构建完成后，将 `out` 目录复制到 `../KManager-Client/wwwroot`，桌面端即可加载最新界面。

## 与桌面端通信

前端通过 `window.chrome.webview.hostObjects.bridge` 调用 C# `WebBridge`，用于账号保存、切换、分组管理、编辑信息和应用设置。浏览器开发模式下会使用前端 mock 数据，方便单独调试界面。
