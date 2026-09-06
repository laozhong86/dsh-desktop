# upstream-sync 决策日志

> 追加式，新条目置顶。格式见 `upstream-sync.md` 合同。无日志的 merge 不算完成。

---

## 2026-09-06 · pin runtime 0.1.2-rc.1（a66e470204，跟随侧边栏 0.18.0 升级）

- **范围**：submodule `a66e4702047846cdaa10c66c9d3df3951f5ea70d`（`dsh-v0.1.2-rc.1`）；vendor `vendor/dsh-runtime/0.1.2-rc.1`（242 tarball，official profile）；`upstream.json` 更新指向 rc.1；desktop/market `@deepseek-ai/dsh*` → `0.1.2-rc.1`。
- **补丁**（全套 rc.1 官方产物检出与适配）：
  - 检出上游现成补丁集合：`dsh@0.1.2-rc.1.patch`、`dsh-app-boot@0.1.2-rc.1.patch`、`dsh-client-ui-directory-picker-browse@0.1.2-rc.1.patch`、`dsh-client-ui-primitives@0.1.2-rc.1.patch`、`dsh-client-ui-settings-general@0.1.2-rc.1.patch`、`dsh-host-directory-picker-browse@0.1.2-rc.1.patch`、`dsh-settings@0.1.2-rc.1.patch`、`dsh-subprocess-local@0.1.2-rc.1.patch`、`dsh-web-app@0.1.2-rc.1.patch`、`dsh-win32-process@0.1.2-rc.1.patch`。
  - 清理已失效的 `vendor/dsh-runtime/0.1.2-alpha.3` 与旧补丁 `patches/*@0.1.2-alpha.3.patch`（完好保留 `patches/dsh-better-sidebar/` 与 non-alpha.3 补丁）。
- **B 级模板与品牌锁定**：
  - 严格保持 OmniMux 桌面 App 品牌配置（`ai.omnimux.desktop`、`OmniMux`、`omnimux` 命令、preset 打包目录）。
  - 严格锁定生产端口 `44120`（`DESKTOP_PROD_WEB_PORT`）。
  - 保持单 channel 构建链，排除 beta channel workspace，保留 OmniMux 专有 scripts。
- **源码与测试适配**：
  - `AdvancedFrame.tsx`：确认细节面板已严格包裹在 `<SessionProvider>` 中，保留窄屏防抖迟滞断点逻辑。
  - `tests/package.spec.ts` 与 `tests/client-directory-picker-browse-patch.spec.ts`：补丁路径断言更新至 rc.1。
  - `dsh-community-market/tests/contracts.spec.ts`：peerDependencies 断言同步更新至 rc.1。
  - `scripts/verify-profile-boot.mjs`：适配 PR #51 恢复的 official native directory picker 断言。
- **验证**：
  - `verify-layout` + `sync-vendored-runtime --check` 全通过（242 packages verified）。
  - `corepack yarn workspace dsh-plugin-desktop typecheck`：通过（0 错误）。
  - `corepack yarn workspace dsh-plugin-desktop test`：112 passed（1075 tests pass）。
  - `corepack yarn check` 全量门禁：全绿通过。
- **决策人**：团队拍板跟进 dsh-better-sidebar 0.18.0，工程师实施底座升级。

---

## 2026-09-01 · pin runtime 0.1.2-alpha.3（dd6322d604，本会话 A–E）

- **范围**：submodule `dd6322d604e00eec1ba5e0c8541159906a21094a`（`dsh-v0.1.2-alpha.3`）；vendor `vendor/dsh-runtime/0.1.2-alpha.3`（244 tarball，official profile）；desktop/market `@deepseek-ai/dsh*` → `0.1.2-alpha.3`
- **配套**：cordis `4.0.2` / group `1.0.2` / include `1.0.7` / loader `1.0.3` / schemastery `^3.18.2`（alpha.3 peer）
- **补丁**（P0 全 apply-check 通过）：
  - 迁移并重打：`dsh-web-app` / `dsh` / `open@11` / directory-picker 两枚 / `dsh-subprocess-local` / `dsh-win32-process`
  - 按 alpha.3 `navIcon` 重打：`dsh-client-ui-settings-general`（desktop 图标）
  - 复活 P0：`dsh-llm-deepseek`（空 `call.id` / `function.name` 不写入，防 `prepare` 崩）
  - alpha.1 补丁归档 `_deprecated/patches/runtime-0.1.2-alpha.1/`
- **源码适配**：`settingsNamespace()` 工厂已从 `@deepseek-ai/dsh-settings` 移除，改用字面量 namespace
- **验证**：`verify-layout` + `sync-vendored-runtime --check`；desktop 1004 pass / 4 skip；market 268 pass
- **决策人**：老板本会话批准 A–E

---

## 2026-09-01 · 例行同步进 0.1.2-alpha.1（43 提交，C 级老板本会话批准 A–E）

- **上游范围**：`8ad3491c49..e71a9ef0b1`（43 提交；runtime 0.1.2-alpha.1 + `runtimeSource` vendor 机制、Electron 43.3.0、打包校验改走 `dsh-agent-presets`、Win PTY 拆除、Setup Wizard 升级重跑等）
- **冲突**（6 文件，脚本因 `verify-packaged-runtime.ts` 行数不一致 abort 后手工解）：
  - 根 `package.json` scripts：上游 `upstream:install/build/official/pack/prepare-runtime` 与 OmniMux `omnimux:*` **并集**
  - `dsh-plugin-desktop/package.json`：🟡 B 级 `version` 取上游 `2.0.4`，`description` 保 OmniMux
  - `verify-packaged-runtime.ts` / `.spec.ts`：跟随上游 alpha 物理路径（`dsh-agent-presets` + `REQUIRED_DSH_CLI_RUNTIME_ENTRIES`）
  - `tests/plugin.spec.ts`：端口保 `44_120`；`windowsMaterial` 跟随上游默认 `off`（源码 `DEFAULT_WINDOWS_WINDOW_MATERIAL`）
  - `tests/client-environment.spec.ts`：保 HEAD（合并后 `extended-shell.ts` 未注册 `desktop-frame-titlebar`）
- **解法**：
  - 🟡 B 级：品牌字段按合同
  - 🟠 C 级（老板本会话批准 A–E）：submodule pin、Electron 43.3.0、`runtimeSource`、打包校验结构
- **分级记录**：A 级自动跟；B 级 2 项品牌；C 级 4 项（submodule / Electron / runtimeSource / packaged-runtime）老板确认；D 级 0
- **submodule**：工作树补签到 `cd5ef8148158c3a752a658978873241fdf8e2bbc`（`dsh-v0.1.2-alpha.1`），与 `upstream.json` 一致
- **验证**：本条目提交时尚未跑 yarn install/build（紧随其后）
- **决策人**：老板本会话批准执行 A–E
- **提交**：merge `0f3cf4f8e8` + 本条 submodule/log 收尾

---
## 2026-08-25 · 例行大同步（232 提交）

- **上游范围**：`f3eb74bb9f..321cbb6683`（232 提交；Setup Wizard 独立初始化向导 UI 与向导设置流程、Extended/Framed 窗口模式与 macOS/Windows 材质支持、Profile Checkpoint 统一三槽位健康检查点管理替代旧 install-recovery、窗口多显示器几何持久化与记忆校验、进程级 pnpm release-age 策略支持、空工具名死循环防护补丁与模型参数弹窗等）
- **冲突**：
  - `package.json`（根目录）：scripts 并集（test/typecheck 两 workspace 并行），resolutions 并集（吸收 dsh-agent-loop、dsh-client-runtime、dsh-subprocess-local、dsh-token-meter、open 补丁，保留 models 与 trajectory 补丁）
  - `dsh-plugin-desktop/package.json`：version 保持 `2.0.2`；description/bin/build 品牌保 OmniMux（`ai.omnimux.desktop`、`omnimux` 命令、`preset/**` 解包、nsis shortcut/artifactName）；scripts 保留品牌构建脚本；devDeps/dependencies 并集
  - `dsh-plugin-desktop/src/main.ts`：appId 保持 `ai.omnimux.desktop`，吸收上游完整的 Setup Wizard、Recovery Controller、Profile Checkpoint、Window State Persistence 等逻辑
  - `dsh-plugin-desktop/src/profile-manager.ts`：`DEFAULT_PROFILE_NAME` 保持 `'omnimux'`，吸收 state v2、staging pattern、checkpoint 清理与原子发布等能力
  - `dsh-plugin-desktop/src/desktop-port.ts`：保持默认 WebCarrier 端口 `44120`
  - `dsh-plugin-desktop/src/update-checker.ts`：保持当前 feed URL 设定
  - `dsh-plugin-desktop/tests/package.spec.ts`：品牌类断言保 OmniMux（appId、productName、bin、nsis shortcutName/artifactName、icon hash、preset 包含），结构性与新增功能断言跟随上游
  - `dsh-plugin-desktop/tests/profile.spec.ts` & `tests/plugin.spec.ts`：端口断言保 `44120`
  - `dsh-plugin-desktop/tests/profile-manager.spec.ts`：默认 profile 测试断言保 `'omnimux'`
  - `yarn.lock`：取上游后由 `corepack yarn install` 重算
- **解法**：
  - 🟡 B 级（模板与契约）：
    - 品牌与薄改点完全按 `docs/contracts/upstream-sync.md` 保留 OmniMux 特有属性。
    - 上游重构的新增功能模块（Setup Wizard, Material, Framed/Extended Shell, Checkpoint, Window State Tracker 等）全量合并。
    - 废弃的旧模块与旧测试（如 windows-agent-presets）按上游清理。
- **分级记录**：A 级 219 项自动合并/跟随；B 级 13 项按模板契约解；C 级 0 项；D 级 0 项
- **验证**：
  - `corepack yarn install`：exit 0，依赖图一致
  - `yarn build`：exit 0，包括 tsdown 构件与 vite native-ui 资源（setup-wizard、recovery、profile-create、dialog）
  - `yarn typecheck`：exit 0，类型检查零错误
  - `yarn test`：exit 0，**122 test files / 1,247 passed | 4 skipped 全部通过**
  - `yarn workspace dsh-plugin-desktop verify:closure`：exit 0（201 nodes 闭合图）
- **决策人**：agent 自主（遵循 upstream-sync 契约规则）
- **提交**：`164bb1e003`（merge）+ 后续收尾提交 + 本条日志

---

## 2026-08-22 · 例行同步（49 提交，含 2 项 C 级老板确认）

- **上游范围**：`d457d79029..6201080cfa`（49 提交；dsh rc.8→0.1.1-rc.2 运行时升级与补丁迁移、native UI 恢复/建 Profile 窗口、desktop settings、市场/通知、打包修复、Windows 终端恢复）
- **冲突**：3 文件 —— `dsh-plugin-desktop/package.json`（4 处）、`dsh-plugin-desktop/tests/package.spec.ts`（1 处）、`yarn.lock`
- **解法**：
  - 🟡 B 级（模板）：
    - build 链：保 `generate-mac-app-icon-omnimux.mjs`/`generate-tray-icons-omnimux.mjs`，并入上游 `vite build --config vite.native-ui.config.ts`；typecheck 跟随上游（+native-ui tsc）
    - 依赖：`@deepseek-ai/dsh*` 全部取上游 0.1.1-rc.2（与本仓 10:24 已升级的 dsh-credentials rc.2 一致）
    - devDeps：并集 —— 保 `@electron/rebuild` + 上游 `@fontsource-variable/inter`、`@tailwindcss/vite`
    - nsis 块与 spec 断言：品牌保 OmniMux（shortcutName/artifactName），功能跟随上游（`useZip:false`）
    - `yarn.lock`：取上游后由 `yarn install` 重算
  - 🟠 C 级·老板确认：
    1. build 链结构性冲突（上游新增 vite native-ui 构建）→ 老板选择「合并两条链」：品牌脚本 + vite native-ui 一并进入产品
    2. `deepseek-harness` 子模块 pin 变更（rc.8 `141eb6fe` → rc.2 `b150a551b8d`）→ 老板确认跟进；单独提交 `421572af93`（merge 初版误留 rc.8，已修正）
- **分级记录**：A 级 44 项自动合并；B 级 2 项（package.json 模板解 + spec/yarn.lock）；C 级 2 项老板确认；D 级 0
- **验证**：`yarn build`（含 vite native-ui）exit 0；typecheck exit 0；vitest **77 files / 757 passed | 4 skipped**
- **决策人**：老板确认
- **提交**：`70941c89af`（merge）+ `421572af93`（submodule pin）+ 本条日志

---
## 2026-08-21 · 例行同步（11 提交）

- **上游范围**：`8eaefb3149..d457d79029`（11 提交，含 rc.7→rc.8 依赖升级、macOS native menu 本地化）
- **冲突**：仅 1 处 —— `dsh-plugin-desktop/package.json` 的 `version` + `description`（上游升 2.0.2 + DSH 品牌描述 vs 我们的 OmniMux 描述）
- **解法**：🟡 B 级模板 —— version 取上游 `2.0.2`，description 保 OmniMux 文案
- **分级记录**：A 级 10 项自动合并；B 级 1 项按模板解；C 级 0；D 级 0
- **验证**：merge 后测试 2 项失败（依赖 rc.8 未装 + lib 未重编）→ `yarn install` + 干净 env `build` 后 **36 passed | 1 skipped 全绿**；typecheck exit 0
- **决策人**：agent 自主（贾维斯会话）
- **提交**：`a099217f8c`（merge）+ `2d26cbe400`（lockfile/gitignore）

## 2026-08-21 · 大合并（191 提交，fork 落地前置）

- **上游范围**：fork 基点之后 191 提交（8 月中旬 → 8-21 上午）
- **冲突**：3 处，全部在预期薄改点 —— `main.ts` 的 appId 行、`profile-manager.ts` 的 DEFAULT_PROFILE_NAME、`update-checker.ts` 的 feed URL
- **解法**：🟡 B 级 —— 全部保 OmniMux 值（appId=`ai.omnimux.desktop`、profile=`omnimux`、feed 保持禁用态占位）
- **分级记录**：A 级 188 项；B 级 3 项；C 级 0；D 级 0
- **验证**：typecheck exit 0；seed 端到端验证通过（rm -rf 临时 DSH_HOME → 8 bundles + 235 deps 重建）
- **决策人**：agent 自主（贾维斯会话）
- **提交**：`c3e9348300`（merge，后续经历史重建对应 `8eaefb3149` 基点）

---

### 追加新条目的模板

```markdown
## YYYY-MM-DD · 同步类型（N 提交）

- **上游范围**：`SHA..SHA`
- **冲突**：逐项列出
- **解法**：分级 + 逐项处理
- **分级记录**：A/B/C/D 各几项，C 级谁确认
- **验证**：typecheck/test/CI 真实输出
- **决策人**：agent 自主 / 老板确认
- **提交**：commit SHA
```
