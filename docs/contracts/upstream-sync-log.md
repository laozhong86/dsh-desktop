# upstream-sync 决策日志

> 追加式，新条目置顶。格式见 `upstream-sync.md` 合同。无日志的 merge 不算完成。

---

## 2026-10-25 · 前向合并 `68de0b3dad`（与 #3776 / #3786 交付物对齐）

- **范围**：把本分支（551 提交上游同步 + 本任务 11 个提交）与 `fork/omnimux` 的新 tip `68de0b3dad96e12c1ea4a6fbacc662a60187408c` 前向合并（**不是重做 `git merge origin/master`**，保住 2a/2b/2c 成果）。新 base 含 `1563675a4f`（#106 / #3776：Windows provider seam 核验 + 两处过期 CI 断言复位）与 `68de0b3dad`（#107 / #3786：macOS universal smoke 修复——sharp 钉版 `0.35.3→0.35.5` + `x64ArchFiles` 补三个 darwin 原生家族）。merge commit `19ee33171b`，父提交 `5350f70501` + `68de0b3dad`。
- **冲突 6 项与解法**：
  1. `dsh-community-market/package.json`：取本分支侧——保留上游新增的 `zod ^4.4.3`（`src/catalog/domain.ts` 直接 `import { z } from 'zod'`，是本次同步带进来的真实依赖）。
  2. `dsh-plugin-desktop/package.json`：取本分支侧——上游的 `x64ArchFiles` 是超集（含 `Contents/Resources/runtime/**` 与 `#107` 补的三个家族 `@deepseek-ai/libreoffice-kit-darwin-*` / `meshcall-router-darwin-*` / `sherpa-onnx-darwin-*`），并保留 `asar: false`。sharp 两侧同为 `0.35.5`，自动合并。
  3. `dsh-community-market/tests/market-settings-persistence.spec.ts`：**接受上游删除**（`git rm`，与 #3776 关闭评论口径一致）。
  4. `dsh-plugin-desktop/tests/package.spec.ts`：**按决定 2（跟随上游 Electron 44.7.0）后的真实 manifest 取值**，不保留 #106 的临时 `43.0.0` 断言。
  5. `dsh-plugin-desktop/tests/mac-universal.spec.ts`：**保留 #107 新增的「manifest / lockfile / 原生条目三处 sharp 版本一致」用例**，标题采用上游侧（`requires every CPU-specific file and repairs both uv binaries and node-pty helpers`）。
  6. `dsh-plugin-desktop/tests/windows-pwsh-sandbox.spec.ts`：两侧是**不同测试套件**（本分支=上游的 `windows-console-host` 两套；fork 侧=#106 的 provider seam 套件）。按「保留用例语义、按上游结构改写写法」合成一个文件：**上游的 4 个 describe 全保留 + #106 的 `desktop Windows ACL sandbox provider seam` 套件（含「上游裁决对象不被就地修改」的变异检查）与其 `aclSeam` mock 追加**；`configValue`（来自已删除的 `settings-access.ts`）不引入，改用上游 `desktopWindowsPwshConfig` 的 `.get()` 语义。
- **#3776 交付物确认落地**：`tests/profile.spec.ts` 自动合并带入 +10 行新 row id 断言（`desktop-windows-acl-sandbox` 存在、`disabled` 为假、旧 `desktop-windows-pwsh-sandbox` 不再出现）；`tests/windows-pwsh-sandbox.spec.ts` 带入 +77 行 provider seam 套件。
- **顺带修掉一个真实缺陷（本次同步引入）**：551 提交同步带进了上游的 `vite.client.config.ts`，但本仓 `build` 脚本（按合同 B 级保我们的链）没有跑它，而 `package.json` 的 `exports['./client']` 指向 `lib/client.js` → **没有任何构建产物能满足自己的导出**。已把 `vite build --config vite.client.config.ts` 加入本仓 build 链（保留 `generate-*-omnimux.mjs` 图标链与 `vite.native-ui.config.ts`），重建后 `lib/client.js` 701,926 字节。
- **`yarn.lock`**：以 `corepack yarn install` 结果为准（#107 的剪枝与上游重生成都包含在内）；`--immutable` 复跑通过。
- **验证证据（前向合并后实测）**：
  - typecheck：`dsh-plugin-desktop` / `dsh-desktop-next` / `dsh-community-market` **均 exit 0**。
  - `check:layout`：exit 0（双语 53 记录 / 106 文档、vendored-runtime 344 包、verify-layout 通过）。
  - `workspace dsh-plugin-desktop build`：**exit 0**。
  - `workspace dsh-plugin-desktop test`：**162 文件 / 2037 通过 / 18 失败 / 12 跳过**（前向合并前为 21 失败；`package.spec.ts`、`verify-packaged-runtime.spec.ts`、`host-process-integration.spec.ts` 已转绿）。
  - `tests/package.spec.ts` 单跑：**52 通过 / 1 跳过 / 0 失败**。
  - `workspace dsh-desktop-next test`：**86 文件 / 717 通过 / 3 跳过 / 0 失败**。
  - `corepack yarn check`：**仍未通过**，剩余 18 项见下。
- **剩余 18 项（真实数字）**：`profile.spec` 5、`plugin.spec` 3、`client-environment.spec` 3、`dev-package.spec` 2、`setup-wizard-settings` 1、`setup-wizard-native-ui` 1、`desktop-runtime-environment` 1、`desktop-plugins` 1、`client-desktop-settings` 1。均为上游测试断言与本仓实现/品牌差异的逐项对账，无已知结构性阻塞。

---

## 2026-10-25 · 上游 551 提交大同步（Next 壳灰盒引入；C 级 13 项已获老板确认）

- **上游范围**：`63e160ab4387988db894adef766865eab897cf80`（2026-09-12 同步落地的 origin/master tip）→ `092e2ecef750d10db43cedbab8e81fd48c8de38e`，共 **551 提交**；fork base `dca12ebdd2b5a7b572663f491c84833da3e487ce`（`fork/omnimux` tip）。上游产品 2.0.9 → 2.0.18；DSH 运行时两侧同 pin `1f81c047fc48fa190a683e469daa699857e9afe8`（`0.2.1-rc.3`），submodule gitlink 无差异。
- **冲突规模**：`git diff --name-only --diff-filter=U` = **235 文件**（决策集）。`git merge-tree --write-tree --name-only` 的 `CONFLICT` 行 = 282（含 rename/delete 两侧路径，与 issue 的「260」同口径）。状态分布：`DU 119 · UU 81 · UD 13 · AA 8 · UA 7 · DD 7`。
- **分级记录**：**A 104 / B 68 / C 63 文件 → 13 个决策项 / D 0**。C 级 13 项全部由老板于 2026-10-25 显式确认（见下）；D 级 0（根 `LICENSE` 两侧零 diff，`dsh-desktop-next/LICENSE.upstream` 为 MIT；上游反向**移除** DeepSeek 产品分析行；fork 专有的 preset 种子机制未被要求拆除）。
- **C 级决策与逐项解法（老板已确认）**：
  1. **Next 壳灰盒引入**：`dsh-desktop-next/**`（270 文件、**0 冲突纯新增**）进 workspace + 根 `build`/`typecheck`/`test` + 根 `check`（`dsh-desktop-next check`），**不打包、不品牌化、不发布**；「采纳 next 作产品壳」拆独立 issue。判定依据：上游 `dsh-plugin-desktop/src/next-transition-notice.ts` 明写「下个版本发布后计划用 Next 取代当前稳定版桌面端」；`verify-desktop-variants.mjs` 证明 beta 与 next 是同一份源码的两个频道变体；next 与 beta 各有 29 个跨包相对 import 指回 `dsh-plugin-desktop`（beta→next 为 0），故 legacy 是共享底座、不可删；next 无 preset 种子、无端口常量、无自动更新资格。
  2. **维持单壳线**：不引入上游 `dsh-plugin-desktop-beta/**`（合并时整目录移除：51 modify/delete + 219 新增），`upstream.json` 保持单 `stable`（不加 `beta`/`next` channel），`activeChannel: stable`。
  3. **不引入变体门禁**：`scripts/verify-desktop-variants.mjs` 不落地，根脚本无 `check:desktop-variants` / `sync:beta-to-next` / `sync:next-to-beta`；`settings-bridge.ts` 里指向该门禁的注释一并改写。
  4. **依赖 major 全部跟随上游**：Electron `43.0.0 → 44.7.0`（含 `peerDependencies`）、`asar: { smartUnpack: true } → false`、`dshmarket 1.38.1 → 1.70.1`、`pnpm 11.8.0 → 11.28.5`、`@deepseek-ai/schemastery ^3.18.2 → ^3.18.5`、`node-addon-require-builtin ^0.1.4 → ^0.1.9`、`sharp 0.35.3 → 0.35.5`；**`koffi` 例外保我们的 `3.1.5`**（根 `resolutions` 已钉，比上游 `3.1.1` 新）。上游新增 devDeps（`papaparse`/`extract-zip`/`fflate`/`tar`）一并跟进。
  5. **品牌/端口/身份/端点全保 OmniMux**：更新端点 `https://updates.omnimux.local/api/desktop/version`、Windows 产物名 `OmniMux-${version}-${arch}-Portable.${ext}`、NSIS `shortcutName`/`artifactName` = `OmniMux` / `OmniMux-${version}-${arch}-Setup.${ext}`、Linux 产物名 `OmniMux-*`、bin `omnimux`、`desktopName: omnimux.desktop`、`homeDirectoryName = .omnimux`（Dev 槽 `.omnimux-dev`）、第二身份位仍映射 Dev（`productName: OmniMux-Dev`、同一 `appId`）、桌面端口 `44120` / Dev `45120`（`desktop-port.ts` 未被上游改动，值原样保留）。
  6. **更新频道口径（决定 3 与决定 1 的边界，可复核）**：**类型面接受上游三值联合 `stable | beta | next`**（保证 in-tree Next 包 typecheck 通过，且不改上游文件以免下次同步再冲突）；**运行时与默认值只走 `stable`** —— 删除上游 `parseCanonicalUpdateVersion` 的「Stable 可提升 Next 安装包」回退（`?? (channel === 'stable' ? parseCanonicalChannelVersion(input, 'next') : null)`），OmniMux 用户不会被 `updates.omnimux.local` 推送到 Next 安装包；`parseCanonicalChannelVersion` 的三频道准入规则保留，故 Next 包自身仍可 typecheck/测试。
  7. **设置入口**：接受上游 `settings` 服务为唯一入口，fork 的直读设置层 `dsh-plugin-desktop/src/settings-access.ts` **已删除**（重接后全仓 0 引用）；`index.ts` 采上游 `inject = ['webServer','appExit','settings','connection']` + `createDesktopSettingsPort`。
  8. **启动流程**：以上游新流程为基线（Setup Wizard `setupPending`/`beginDesktopSetupWizard`/`runtime.setupOnboarding` 状态机、`launchWorkspaceReady` 交接、`desktopPrimaryRuntime()`、`profileBoot.markReady()`、`observeDesktopPreferenceSettings`），重插 OmniMux 调用点；上游「共享数据目录迁移」弹窗在 OmniMux 禁用（新增 `SHARED_HOME_MIGRATION_PROMPT_ENABLED: boolean = false` 常量并置于该 `if` 首条件）。
  9. **preset/seed**：`preset/**` 继续物化 OmniMux 插件（`preset/skeleton/*`、`owned-packages.json`、`seed-version`），agent-preset 名册交给上游 `agent-preset-registry`；`package:dir` 链保留 `yarn run stage:preset`，`files` 保留 `{from: preset, to: preset}`。
  10. **门禁与 CI**：保 OmniMux 打包线（`ci.yml` 取本仓版本：`dsh-plugin-desktop` 矩阵 + OmniMux 产物名 + `verify:aa` 冒烟），**不加 linux job**，**不纳入 Next 的 4 个浏览器门禁**（window-controls / onboarding / protocol / sidebar-browser）。
  11. **`IMMUTABLE_BUNDLES` 扩容**（`desktop-plugins.ts` 新增 `'dshmarket'`、`'@agents-anywhere/dsh-bridge-next'`，**合并无冲突静默接受**）→ 用 profile patch 禁用，延续 community-market 先例。
  12. **`scripts/verify-layout.mjs` 重写**为本仓口径：workspaces 精确为 `['dsh-plugin-desktop','dsh-desktop-next','dsh-community-fabric','dsh-community-market']`、`activeChannel` 必须 `stable`、Next 必须 `private` 且其 `@deepseek-ai/dsh*` 依赖等于 `dsh-desktop-next/upstream-reference.json` 的 pin；删除上游的 beta 断言。
  13. **`AA_WORKSPACES` 适配**：上游 `scripts/agents-anywhere-release-policy.mjs` 常量含 `dsh-plugin-desktop-beta` → 改为 `['dsh-plugin-desktop', 'dsh-desktop-next']`（`aa:prepare-release` 的 `packagePaths` 与 `runtimePeerRanges` 都读该常量）。
- **A/B 级逐项解法**：
  - **vendor/dsh-runtime（56 DU）**：上游保留全部历史运行时目录，本仓只留活动 rc。合并后 `git rm -r` 掉 `0.1.5-rc.2`、`0.1.7-alpha.2`、`0.1.7-rc.1`、`0.1.7-rc.2`、`0.2.0-rc.1`、`0.2.0-rc.2`、`0.2.1-alpha.1`、`0.2.1-alpha.2`，只留 `0.2.1-rc.3`（延续本仓剪枝策略）。`_deprecated/dsh-0.1.5-rc.2/**` 同样保留删除。
  - **patches（27）**：8 个 AA 中 6 个与上游字节相同直接取、2 个差异重做（见「发现」）；7 DD / 7 UA / 5 DU 属废弃 rc，删除；随后按策略删掉合并带入的 143 个废弃 rc 补丁。最终保留 35 个（活动 rc `0.2.1-rc.3` 全套 + `app-builder-lib@26.15.7`、`fs-ext@2.1.1`、`open@11.0.1`、`open@11.0.4`、`vscode-ripgrep@1.18.0`、`pnpm@11.28.5`、`node-pty@1.2.0-beta.15`、`pi-ai@1.1.0`、`@electron__osx-sign@1.3.3` + 本仓专有 `dsh-better-sidebar/**`）。
  - **根与文档**：`AGENTS.md` 保双方并去 beta（改写上游新增的 `dev:next`/变体镜像两条 bullet 为单壳线灰盒口径；`market:prepare` 段改为本仓 `resolutions` + `.yarn/patches/dshmarket-desktop.patch` 的实际口径）；`.gitignore` 并集（保本仓 preset/worktree 忽略 + 上游 Next 构建产物忽略，去掉 beta 专属行）；`README.md` 赞助行并集（保本仓 AstraFlow 新链接 + 上游 88API/立秋两行）；`dsh-plugin-desktop/README.md`/`README.zh.md` 逐 hunk 解（上游打包/运行时段落 + 本仓图标生成链与 rc3 版本号）；5 个 i18n 侧车（`README`、`PRIVACY`、`dsh-plugin-desktop/README`、`.agents/.../omnimux-ecosystem-map`、`dsh-community-market/docs/install-and-uninstall`）按 `git hash-object` 重算。
  - **dsh-community-market（18）**：按上游侧解（`MarketSettingsScope` → `MarketStateStore` 重构、`install/service.ts` +284 行、`install/github.ts` 的 `BLOCKED_PACKAGES` 取上游 4 项）。唯一保留本仓差异：`tests/host-routes.spec.ts` 的 builtIns 期望补上本仓专有的 `DSH Marketplace`（`dsh-marketplace-qilewl`，fork 提交 `7b3207914c`，base 与上游均无）。
  - **dsh-plugin-desktop 测试/脚本（25）**：取上游（含 13 个 UD 上游删除项接受删除、5 个 DU 恢复上游、2 个图标保本仓），后按合并后实现对齐断言（见下）。
  - **dsh-plugin-desktop src（26）**：19 取上游、2 保本仓（`client/extended-styles.ts` 的 sidebar footer 布局、`client/styles.ts` 的 macOS advanced 内嵌与 sidebarCol 选择器）、`client/layout-state.ts` 保本仓（64px 迟滞 + `panelInfo` observable；上游的 `panelSnapshot` 重命名无外部引用，未采用）、`client/AdvancedFrame.tsx` 保本仓 `GlobalStandardProps` 并叠加上游新增的 `dshDesktop_sidebarCol` 锚点、`windows-pwsh-sandbox.ts` 以上游为基座并补回本仓 `desktopWindowsAclAdaptation()` / `adaptWindowsAclArgv()`（`windows-acl-sandbox-provider.ts` 需要）、`setup-wizard-copy.ts` 取上游新键、`electron-runtime.ts` 补回本仓原生多选文件选择器、`desktop-network.ts` 恢复上游导出名 `desktopBrowserAccessAvailable`。
  - **根 `package.json`**：workspaces 4 个；`build`/`typecheck`/`test` 追加 `dsh-desktop-next`；`check` = `check:layout && fabric check && market check && desktop check && dsh-desktop-next check`；`resolutions` 取上游 703 条（688 条 `@deepseek-ai/dsh*` 指向 `vendor/dsh-runtime/0.2.1-rc.3/*`）并覆盖 `koffi@npm:^3.1.0 = 3.1.5`；`version` 取上游 `2.0.18`（`scripts/verify-version.mjs` 要求与桌面包一致）；保留本仓全部 `omnimux:*` / `dist:r2-*` / `package:dev` / `dist:win-release`。
- **发现（本仓自身缺陷，已顺带修复）**：
  1. **`patches/dsh-client-ui-directory-picker-browse@0.2.1-rc.3.patch` 引用了不存在的图标导出**：本仓补丁用 `IconFolderOpen16`，而 rc3 的 `@deepseek-ai/dsh-client-ui-primitives` 包里**没有该导出**（解包 `vendor/dsh-runtime/0.2.1-rc.3/deepseek-ai-dsh-client-ui-primitives-0.2.1-rc.3.tgz` 实测只有 `IconFolderOpen`/`IconFolderOpenRegular`/`IconFolderOpenOutline*`/`IconFolderOpenArtwork`/`IconFolderOpenMedium`）。该补丁作用于预构建 bundle，类型检查抓不到，属静默失效。已取上游补丁内容（`IconFolderOpenRegular`）修复。
  2. **上游 `typecheck` 不覆盖 client**：上游脚本为 `run-parallel "tsc -p tsconfig.native-ui.json" "tsc -p tsconfig.tests.json" "tsc -p tsconfig.tests.client.json"`，**不含 `tsconfig.client.json`**；本仓的 `typecheck` 含全部五套 tsconfig。因此上游 client 源码在本仓更严门禁下暴露 `PropsRuntime<'root'>`（该 SlotMap 键在 rc3 已不存在）。已保本仓 `AdvancedFrame.tsx`（`GlobalStandardProps`）并叠加上游新增的 sidebar 锚点类。
- **验证证据（本条提交时的真实状态）**：
  - `corepack yarn install` 通过（1m24s）；`corepack yarn install --immutable` 通过（yarn.lock 重生 17927 行、无冲突标记）。
  - `corepack yarn workspace dsh-plugin-desktop typecheck`：**exit 0**。
  - `corepack yarn workspace dsh-desktop-next typecheck`：**exit 0**。
  - `corepack yarn workspace dsh-community-market typecheck`：**exit 0**。
  - `corepack yarn check:layout`：**exit 0**（`verify-bilingual-docs: 53 records and 106 documents are consistent`；`sync-vendored-runtime: stable 344 packages from 1f81c047fc are verified`；`verify-layout: Yarn workspace and upstream 1f81c047fc are consistent`）。
  - `corepack yarn workspace dsh-community-market test`：**14 文件 / 309 通过**。
  - `corepack yarn workspace dsh-plugin-desktop test`：**162 文件 / 1902 通过 / 20 失败 / 11 跳过**（首轮 131 → 48 → 20，逐项对账中；剩余项见文末「未完」）。
  - `corepack yarn workspace dsh-desktop-next test`：**86 文件 / 717 通过 / 3 跳过 / 0 失败**（Next 灰盒工作区全绿）。
  - **`corepack yarn check`：尚未通过** —— 阻塞项为 desktop 套件的 48 项断言对账，以及 `tests/package.spec.ts`（该文件由并行任务 #3776/#3786 所有，本次按上游侧保留，待其合并后前向对齐）。
  - 环境：`env -u NODE_OPTIONS PATH=<managed node 22.22.2>/bin:/usr/bin:/bin:/usr/sbin:/sbin`（本机 `22.22.2-6` 目录名与合同示例的 `22.22.2` 不同）。
- **批准包决定 5 的第 5 个调用点（老板 2026-10-25 追加确认补回）**：fork 的「release/Dev 构建首次启动直接落默认值、不弹 Setup Wizard」在本次合并中一度丢失。已按**上游新的** `setupPending` / `beginDesktopSetupWizard` 状态机语义重插：当上游判定 Setup 必需时，先写默认偏好、重跑 `prepareDesktopProfile`、用 `completeOrSkipDesktopSetupWizard(..., 'skipped', ...)` 把 Setup 记为已结算，再把 `setupPending` 置 false，因此向导不会打开、`runtime.setupOnboarding` 仍报告一致且已结算的文档；`OMNIMUX_FORCE_SETUP_WIZARD=1` 仍可强制走上游向导。新增 `settlesFirstRunSetup(required)` 作为可测决策点，并补 3 个测试（策略 2 个 + `main.ts` 接线 1 个）钉住「不弹向导 / 非 release 行为不变 / 接线在向导之前」。
- **未完（本条提交时的真实状态）**：`corepack yarn check` 尚未通过。剩余 20 项 desktop 失败为上游测试断言与本仓实现差异的逐项对账（`profile.spec` 4、`plugin.spec` 3、`client-environment.spec` 3、`host-process-integration.spec` 2、`dev-package.spec` 2、`setup-wizard-settings` 1、`setup-wizard-native-ui` 1、`recovery-plugin-uninstall` 1、`desktop-runtime-environment` 1、`desktop-plugins` 1、`client-desktop-settings` 1），加上 `tests/package.spec.ts`（**并行任务 #3776/#3786 所有**，本次按上游侧保留，待其合并后前向对齐）与 `tests/verify-packaged-runtime.spec.ts`（需 `lib/` 构建产物，`yarn check` 会先 build，非缺陷）。

---

## 2026-09-12 · 上游 2.0.9 全量同步（106 提交，C 级双项已获老板确认）

- **上游范围**：`91b12fcd60fe85a39c6aa21dcd3056d89d0b69a4`（fork base 已含的上游 merge parent）→ `63e160ab43`（origin/master HEAD），共 106 个提交；fork base `6a8e66a35e`（fork/omnimux tip）。上游产品 2.0.5 → 2.0.9，DSH 运行时 `0.1.2-rc.1` → `0.1.5-rc.1`。
- **前置事故与纠正**：首次尝试误用**本地陈旧分支** `omnimux`（`947a5b2c57`）作为 ours；该分支落后 `fork/omnimux` 161 个提交（缺 PR #75 双击缩放、PR #71 部分上游融合）。已把该次尝试存为孤立提交 `7c918df2df` 供参考，并以 `fork/omnimux` 重做本次 merge。教训：同步前必须校验 ours 与远端 fork 分支的领先/落后关系。
- **C 级决策（老板确认）**：
  1. **不引入上游 `dsh-plugin-desktop-beta/` 变体包**（fork 此前已自行移除，上游在本区间继续维护它）。本次整体删除该包及其根 workspace/脚本/CI 矩阵/`check:desktop-variants` 门禁引用，保持单产品线 OmniMux；仓库内仅保留 `BLOCKED_PACKAGES` 之类「禁止安装为插件」的字符串。
  2. **采用上游集中化品牌源** `src/product-identity.ts`（`DESKTOP_PRODUCT_NAME` / `DESKTOP_APP_ID` / `DESKTOP_PACKAGE_NAME` 常量）并把值设为 OmniMux：`OmniMux` / `ai.omnimux.desktop` / `dsh-plugin-desktop`；第二身份位映射本仓 Dev 版（`OmniMux Dev`），非上游 Beta。
- **版本与品牌（B 级模板）**：根与 `dsh-plugin-desktop` 版本取 `2.0.9`；`description` 保 OmniMux；electron-builder `appId=ai.omnimux.desktop`、`productName=OmniMux`、Windows/Linux 产物名 `OmniMux-*`、NSIS `shortcutName=OmniMux`；bin 保 `omnimux`；桌面默认端口保 **44120**（Dev **45120**）；更新端点保本仓契约 `https://updates.omnimux.local/...`（既有占位域名，见 deploy-infrastructure-audit）；`DEFAULT_PROFILE_NAME='omnimux'`；preset 种子机制（`preset-profile.ts` / `stage-preset-profile.ts` / `preset/**` 打入并解包）完整保留。
- **冲突分类与解法**：
  - 接受上游删除：`_deprecated/patches/runtime-0.1.2-alpha.1/**`、`patches/*@0.1.2-rc.1.patch`、`patches/*@0.1.3-alpha.1.patch`、`patches/dsh-web-app@0.1.1-rc.2.patch`。
  - 运行时与补丁：整套换上游 `0.1.5-rc.1`（16 个 patch + `vendor/dsh-runtime/0.1.5-rc.1` 265 包）；submodule gitlink 钉 `183f08e9c6`（`dsh-v0.1.5-rc.1`）；`upstream.json` 采上游 channel 结构、单 `stable` channel；`scripts/sync-vendored-runtime.mjs` 采上游实现并去掉 beta/other-channel 分支。
  - 门禁与脚本：`scripts/verify-layout.mjs` 保留 fork 的 3 workspace/子模块检查并改读 channel 形态，删除 beta 断言；删 `scripts/verify-desktop-variants.mjs`；`scripts/prepare-agents-anywhere-release.mjs` 单包化；`.github/workflows` 去掉 beta 矩阵；`.yarnrc.yml` 保 `npmMinimalAgeGate: 0` 并并入上游 `npmPreapprovedPackages`。
  - 品牌集中化后，`bin.ts`、`profile.ts`、`main.ts`、`index.ts` 等处的字面 `DSH Desktop` 改为复用 `product-identity.ts` 常量；`dsh-plugin-desktop/README*`、`README.md`、`docs/architecture*`、`docs/user-guide*`、`AGENTS.md` 去 beta 并改 OmniMux 口径（i18n 侧车 hash 按门禁命令重算）。
  - 桌面壳源码：以上游 2.0.9 为基线（隔离 Host、layout ownership、LAN HTTPS、profile-preferences、safe mode、认证会话等上游均已原生实现），逐文件仅回填 OmniMux 独有增量——Dev/Prod 身份与 CDP 端口、44120/45120 端口选择、L2 启动与 seed 调用点、身份优先的 harness home、`DEFAULT_PROFILE_NAME='omnimux'`、窄屏 64px 滞回、双击缩放 IPC。
  - 测试：按合并后清单（根/桌面 workspace 与脚本、OmniMux 品牌与产物名、更新端点、身份常量）重写断言。
- **上游新架构带来的适配修复**：上游 2.0.9 在 compatibility 模式使用**隔离 Host**（renderer 落在独立 `WebContentsView`，`window.webContents` 不再是应用渲染器），导致 PR #75 双击缩放的 `event.sender` 守卫会拒绝全部事件。已在 `titlebar-double-click.ts` 增加可选 `rendererWebContents` 覆盖并在 `electron-shell-generation.ts` 传入真实 renderer WebContents（无行为回归，旧签名仍兼容）。
- **分级记录**：A 级自动合并；B 级 6 项（版本/品牌/端口/bin/产物名/端点）按模板解；**C 级 2 项**（beta 变体取舍、品牌集中化）由老板于 2026-09-12 显式确认；D 级 0 项。
- **验证（逐项实测）**：
  - `corepack yarn install` 通过；期间修复 `dsh-plugin-desktop/node_modules` 陈旧链接（`dshmarket` 实为 1.17.1 应为 1.38.1+patch、`pnpm` 未应用 `patches/pnpm@11.8.0.patch`）——`yarn install --immutable` 报 Done 却不会重建，需移走陈旧目录后重装。
  - `check:vendored-runtime`：stable 265 包全部校验通过；`verify-layout`：通过（单 channel + 3 workspace）。
  - `workspace dsh-plugin-desktop typecheck`：exit 0（含 client / native-ui / tests 五套 tsconfig）。
  - `workspace dsh-plugin-desktop build`：exit 0。
  - `workspace dsh-plugin-desktop test`（vitest）：**145 文件 / 1474 通过 / 9 跳过 / 0 失败**。
  - `verify:closure` / `verify:cli` / `verify:loader` / `verify:profile` / `verify:licenses` / `verify:notices` / `verify:operations` / `verify:aa`：全部 exit 0。
  - 根 `check:bilingual-docs`、`check:architecture`：exit 0；`workspace dsh-community-fabric check`、`workspace dsh-community-market check`：exit 0。
  - 说明：`yarn check` 由上述同一组子门禁组成，已逐项等价验证。
- **复核发现（已处理 / 待跟进）**：
  - 已修：`host-runtime-bridge.ts` 未转发本仓 `pickFiles`；`AdvancedFrame.tsx` 的 `PropsRuntime<'root'>` 在 0.1.5-rc.1 已无此 SlotMap 键（改用 `GlobalStandardProps`）；`product-identity.ts` 第二身份 productName 需为 `OmniMux-Dev` 以匹配 Dev.app 真实 userData 目录；隔离兼容壳使 `window.webContents` 不再是应用渲染器（双击缩放增加 `rendererWebContents`）。
  - 已清：`.github/workflows/ci.yml` 的 beta workspace 循环；全仓已无 `claimDesktopLayout` / `resolveRequiredBundle` / `DETAILS_*` / `stageShippedAgentPresets` 引用。
  - 待跟进（非本次合并引入）：`dsh-plugin-desktop/dist/mac-release/**` 与 `dist/OmniMux.app-2.0.2-bak/**` 内打包的 `pnpm` 仍是未打补丁的旧副本，若作为候选发布物需重新 stage/打包。
- **打包冒烟路径口径（本仓偏差，已记入）**：上游 `packaged-runtime-smoke` 断言 `rgPath` 字符串必须落在 `app.asar.unpacked`，但同一套校验器的 `FORBIDDEN_UNPACKED_RUNTIME_ENTRIES` 明令禁止解包 `node_modules/@vscode/ripgrep/lib/index.js`（shim 必须留在 asar 内，1.18 起 ripgrep 已是分平台包：二进制在 `@vscode/ripgrep-<platform>`，由 smartUnpack 解包）。两者不可同时满足，故本仓改为：把逻辑路径映射到物理孪生（`app.asar` → `app.asar.unpacked`）后断言其存在，并仍以真实执行 `rg --version` 作为最终保证。校验器契约未放宽。
- **打包冒烟终稿根因（选择性 ASAR 迁移漏项，已修）**：本仓解析器仍把 JS 模块锚点映射到物理 `app.asar.unpacked` 孪生路径——`asarUnpack` 还含 `lib/**` 时期的遗留（2e4a6dfefb），改成选择性 ASAR（dae8660de3）后未同步清理。迁移后仅图标、`@agents-anywhere/**/bundled-connector/**`、`preset/**` 与 smart-unpack 的原生包是物理文件，`lib/**` 与 `node_modules/@deepseek-ai/**` 都在 `app.asar` 内，于是 `createRequire(app.asar.unpacked/lib/index.js)` 向上找到不存在的 node_modules 树（CI 报 `Cannot find module '@deepseek-ai/schemastery'`）。修复：`module-resolution.ts` 的 `DESKTOP_ENTRY_URL`/`DESKTOP_PACKAGE_URL`、`packaged-runtime-path.ts` 的 `packagedDependencyPath()`、`profile.ts` 的 `INSTALL_ANCHOR` 与 `shippedPresetRoot()` 恢复逻辑 ASAR 路径；保留 `preset` 种子目录、bundled-connector、ripgrep 物理孪生三处。附带修复 `healDesktopProfileModuleFallback` 的 `app.asar` 判定在打包态被静默跳过。另：smoke 的 ripgrep 步骤改为始终执行物理孪生——解析返回逻辑 asar 路径时，从 ESM 执行会 ENOTDIR（Electron 的 asar 重定向只覆盖 CJS 调用方），保证在两种布局下都成立。
- **测试断言对账**：20 个失败用例全部为「断言仍描述合并前世界」，逐项以合并后实现为准：`package.spec`（窗口安全策略/Profile checkpoint/compat 选择器列表已随 fork 的移除而更新；托盘色 `#7961f2`、iOS 图标 sha256、macOS 图标 8-bit sRGB 按实际产物重算）、`updates.spec`（取消 Beta 双频道，改单 stable 且保留「旧版本永不安装、安装必经显式动作」）、`dev-package.spec`（`package:dir` 链补 `prepare:electron-native`）、`desktop-data-directory.spec`（profile 名 `omnimux`）、`plugin.spec`（productName `OmniMux`）、`client-narrow-breakpoint.spec`（SSR 用例改 `GlobalStandardProps`，窄屏契约断言原样保留）；`dshmarket-compat` / `profile` / `pnpm` 三个文件零改动（失败全部源于陈旧 node_modules）。无删除用例、无放水断言。
- **preset 种子校验口径**：`verifySelectiveUnpackedRuntime` 新增 `requirePreset`（默认 `true`，所有直接调用方维持严格），`verifyPackagedRuntime` 按桌面包是否真的 stage 出 `preset/plugins/omnimux/package.json`（由脚本自身位置推导，不读 `process.cwd()`）决定该值；未 stage 时跳过校验并在 stderr 输出单行声明。CI 打包 job 不 stage（无 plugins 源），故只验证打包链路本身；发布打包仍必须 stage 后才能通过严格校验。

## 2026-09-07 · #59 上游桌面壳稳定线融合（验证中）

- 范围：merge-base `681ba66091fc5b1e827650137f69b3ee4c435922` 至冻结上游 `91b12fcd60fe85a39c6aa21dcd3056d89d0b69a4`（153 个上游提交）；fork base `2b72c8b13d0a73954286d09dccf14a359d31754f`。
- 用户明确批准 C 级启动/Profile/更新融合，并要求保留上游 merge parent、稳定 DSH rc.1、OmniMux 品牌和物理运行时；本次不发布正式版、不上传 R2、不修改插件源仓。
- 49 路径的分级与逐项解法、稳定线和打包例外见 [#59 合并记录](../evidence/issue-59-upstream-sync.md)。
- 本地 `yarn check`、初轮完整平台 CI、真实包内运行时、隔离 Safe Mode/普通启动与认证后的 IAB 交互通过。最终纳入 fork `947a5b2c579eb3ee68794ebd47bb86a772d1a242` 的 sidebar 默认设置，26 项 preset 回归通过；最终平台 CI、Dev 安装与连续重启验收完成后才能关闭 #59。

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

## 2026-10-25 · 主机运行时升级（44 提交）

- **上游范围**：`a4c74a91e06b00fe0b0937bde982170c526cc842..1f81c047fc48fa190a683e469daa699857e9afe8`（`dsh-v0.1.5-rc.3` → `dsh-v0.2.1-rc.3`）
- **冲突**：子模块指针冲突 1 处；适配层挑选引入 241 处（`vendor/**`、`patches/**`、`scripts/**` 取上游；`dsh-desktop-next/**`、`dsh-plugin-desktop-beta/**` 删除）
- **解法**：指针用 `git update-index --cacheinfo` 直接写入目标提交；适配层按目录分级取用，产品壳保留本仓实现并逐个跟上新契约
- **分级记录**：A（自动合并）指针与文档；B（模板解决）`patches/**` 与 `scripts/**` 取上游后重建；C（需确认）无——本次为运行时升级，产品行为改动均由 agent 自主完成并在报告中标出；D（拒绝）`dsh-desktop-next/**` 不在本次范围
- **验证**：`corepack yarn check` 退出码 0；壳单元测试 1533 通过 / 0 失败；七项自检（闭包、CLI、Loader、配置、AA、许可证、运维）全过
- **决策人**：agent 自主（用户委派"按你的建议推进"）
- **提交**：见本次合并提交
