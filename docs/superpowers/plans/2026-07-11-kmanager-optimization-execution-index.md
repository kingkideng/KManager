# KManager Optimization Execution Index

这是一份交接索引，不包含业务实现。低消耗模型必须一次只执行一份计划，并在完成门处停止。

## 必读文件

1. `C:\Users\KK\Desktop\KManager\PROJECT_CONTEXT.md`
2. `docs/superpowers/specs/2026-07-11-kmanager-compatibility-optimization-design.md`
3. 当前要执行的唯一一份实施计划

## 主线执行顺序

1. `docs/superpowers/plans/2026-07-11-foundation-observability-and-tests.md`
2. `docs/superpowers/plans/2026-07-11-atomic-data-and-migration.md`
3. `docs/superpowers/plans/2026-07-11-session-transaction-and-process-control.md`
4. `docs/superpowers/plans/2026-07-11-core-bridge-and-ui-contract.md`
5. `docs/superpowers/plans/2026-07-11-security-ci-and-release.md`

不得跳过顺序。每份计划开始前，确认上一份计划的完成门已经通过且工作区没有未解释改动。

## 设计覆盖关系

- 测试基础、路径隔离、脱敏日志：计划 1。
- 原子 JSON、备份恢复、仓库和迁移 journal/staging：计划 2。
- Battle.net 正常退出、快照事务、失败回滚、Active 提交顺序：计划 3。
- Core 职责拆分、显式 Bridge、稳定错误码、前端错误和交互一致性：计划 4。
- WebView 导航、安全边界、CI、前端同步、版本、测试产物和发布校验：计划 5。
- 快照瘦身、加密和 GPU 模式：仅记录为独立实验，五份主线不实施。

## 每次新对话的提示词

将以下文本发给实施模型，只替换 `<计划绝对路径>`：

```text
阅读并严格执行 KManager 实施计划：
<计划绝对路径>

开始前必须用 UTF-8 阅读：
C:\Users\KK\Desktop\KManager\PROJECT_CONTEXT.md
C:\Users\KK\Desktop\KManager\SourceRepo\docs\superpowers\specs\2026-07-11-kmanager-compatibility-optimization-design.md

要求：
1. 只执行这一份计划，不提前执行下一份，不加入计划外重构。
2. 不操作真实 %LOCALAPPDATA%\KManager\Data 或真实 Battle.net 注册表；测试只使用临时目录或复制的脱敏数据。
3. 严格按测试先失败、最小实现、测试通过、独立提交的顺序执行。
4. 保留现有账号、分组、区服、旧账号、托盘、单实例、WebView2 和测试版隔离行为。
5. 遇到计划与当前源码不一致时停止并报告证据，不自行扩大方案。
6. 完成该计划的 Completion Gate 后停止，报告测试结果、提交列表、工作区状态和用户体验变化。
7. 不 push、不发布 Release、不移动 tag、不覆盖已安装正式版。
```

## 审核要求

每份计划结束后至少检查：

- `git status --short --branch`
- 本计划新增测试的完整输出
- 全量 C# 测试和 Release build
- 涉及前端时运行 `npm test`、`npm run lint`、`npm run build`
- 是否使用了真实用户数据
- 是否出现计划外文件、依赖升级或大范围格式化
- 是否改变了未声明的用户体验

审核通过后，再新开对话执行下一份计划。

## 独立实验

快照瘦身、登录态加密和 WebView2 渲染模式不属于五份主线计划。完成 `v2.0.1` 主线并通过用户验收前，不创建或实施这些实验。
