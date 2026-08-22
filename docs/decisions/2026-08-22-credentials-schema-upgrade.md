# Decision: credentials 包升级 0.1.1-rc.2（跨 app schema 断层修复）

Date: 2026-08-22
Commit: c63897f288
Status: Implemented（生产 /Applications/OmniMux.app 2.0.2 已携带）

## 问题（为什么改）

`~/.dsh/.credentials.yaml` 是全局共享凭证文件（不分 app、不分 profile）。2026-08-22 出现跨 app 互杀：

- 官方 DSH Desktop 2.0.2 打包 `dsh-credentials-local 0.1.1-rc.2`（新版 reader）：Host 每次启动读到旧平铺格式会 `migrateFlatDocument()` **原地重写**为 version-1 嵌套格式（watcher 重读不迁移）。
- 本 fork 出的 OmniMux 2.0.1 打包 `0.1.0-rc.7`（旧版 reader）：读嵌套格式抛 `the value for "version" must be a string` → Host 拒绝启动 → App 黑屏。

两个 app 共存一天内互杀两次（DSH Desktop 日志 09:40:57 / 09:56:35 两条迁移记录与 OmniMux 启动失败时间严丝合缝）。

## 决策（改了什么）

**最小升级集 = 2 个包**：`dsh-plugin-desktop/package.json` 里 `@deepseek-ai/dsh-credentials` 与 `@deepseek-ai/dsh-credentials-local` 从 `0.1.0-rc.8` → `0.1.1-rc.2`。

- 其余 95 个 `0.1.0-rc.8` 依赖**不动**；5 个 fork patch（rebranding）**不动**。
- 兼容性依据：新版 credentials-local 实际 import 的 `withFileLock/writeFileAtomic/canonicalizeWatchPath/resolveDshHome/launchEnvironmentOf` 在 0.1.0-rc.8 伙伴包全部存在；唯一断点 `parseCredentialKey` 由 dsh-credentials 同步升级补齐。
- `.yarnrc.yml` 增加 `npmMinimalAgeGate: 0`：上游 rc 发布节奏快于 Yarn 4.18 默认 24h 检疫窗；0.1.1-rc.2 是官方 DSH Desktop 2.0.2 出包同款（生产已验证）。
- 素材佐证：官方 DSH Desktop 2.0.2 用同一套 0.1.1-rc.2 在同机稳定运行数日。

## 防回滚红线（未来 agent 必读）

1. **出包前必须确认** `dsh-plugin-desktop/package.json` 中两个 credentials 包版本 **≥ 0.1.1-rc.2**。任何把它们降回 0.1.0-rc.x 的操作（依赖回滚、lockfile 重置、package.json reset）都会复活跨 app 互杀。
2. **禁止安装旧产物**：
   - `dist/release-download/OmniMux-2.0.1-arm64.dmg`（旧版，已标记 DEPRECATED）
   - `/Applications/OmniMux.app.bak-2.0.1-credentials-rc7`（旧版备份，仅供回滚取证，确认稳定后删除）
   任何从旧 dmg 重装或从旧备份恢复的操作 = 旧 reader 回归。
3. **上游 sync 时的检查项**：merge 上游后如果 `yarn.lock` 里 credentials 双包被解析回旧版本（上游 lockfile 覆盖、resolutions 冲突），按 upstream-sync 合同走 user-confirm 层重新升级。
4. **上游正式版注意**：上游首个 tagged release 将移除平铺迁移逻辑（上游源码注释明示）。届时两边都已是嵌套格式，无影响；但**不要再用任何 0.1.1 之前的工具写这个文件**。

## 已知遗留

- fork 本地领先 origin 5 个提交（含本决策），**尚无远程备份**——见 upstream-sync-log 与推送计划。
- credentials 文件当前为嵌套格式（新 app 首启自动迁移），与官方 DSH Desktop 一致。
