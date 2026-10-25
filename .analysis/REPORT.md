# Issue #3778 · 第一阶段：合并分级分析（origin/master → fork/omnimux）

**结论先行**：235 个冲突文件（A 104 / B 68 / **C 63 文件 → 13 个决策项** / D 0）。`dsh-desktop-next/**` **零冲突整体进入**（270 文件纯新增），但它是**上游要用来取代 stable 壳的新产品线**，不是可选插件；引入方式必须先由老板拍板，否则第二阶段无法开工。

- 主检出**未被触碰**；全部工作在 `.worktrees/next-shell-merge-issue-3778/`（分支 `agent/next-shell-merge-issue-3778`，base `omnimux`）。
- 未跑 `corepack yarn install`、未 commit、未 push、未 merge 收尾。
- 未触碰 `dsh-plugin-desktop/tests/package.spec.ts` 与 `dsh-community-market/tests/market-settings-persistence.spec.ts`（#3776 所有）。

## 0. 实测数字（可复现）

| 项 | 值 |
| --- | --- |
| merge base | `63e160ab43` |
| ours（fork/omnimux = 本地 `omnimux`） | `dca12ebdd2` |
| theirs（origin/master） | `092e2ecef7`（fetch 时从 `9847a9bb63` 前进 2 提交） |
| 落后 / 领先 | **551 / 195** |
| `git diff --name-only --diff-filter=U` | **235**（本次决策集） |
| `git merge-tree --write-tree --name-only` 的 `CONFLICT` 行 | **282**（含 rename/delete 两侧路径；issue 的 260、侦察的 273 是同一口径的更早 tip） |
| merge-tree 原始输出行 | 644（含 `Auto-merging` 进度行，不是冲突数） |

冲突状态分布：`DU 119 · UU 81 · UD 13 · AA 8 · UA 7 · DD 7`。

分组：`vendor/dsh-runtime 56 · dsh-plugin-desktop 68 · dsh-plugin-desktop-beta 51 · patches 27 · dsh-community-market 18 · scripts 4 · 根/文档 7 · _deprecated 1 · .agents 1 · .github 1`。

## 1. A/B/C/D 分级统计

| 级 | 文件数 | 构成 |
| --- | --- | --- |
| 🟢 **A** | **104** | vendor 旧运行时 56、patches 已废弃 rc 25、上游 src 演进 20、上游测试（无品牌断言）12、yarn.lock 1、`_deprecated` 1、i18n 侧车/假重命名 3… |
| 🟡 **B** | **68** | 品牌/版本字段、build 脚本链、测试品牌断言 8、market 18、patches 内容差异 2、docs/i18n、`AGENTS.md`、`.gitignore`、desktop 客户端 UI 与脚本 |
| 🟠 **C** | **63 文件 → 13 决策项** | 见第 2 节 |
| 🔴 **D** | **0** | 见第 5 节 |

产物：`.analysis/classification.json`、`.analysis/classification.md`、`.analysis/classify.py`（逐路径 code+bucket+理由，可重跑）。

## 2. 🟠 C 级逐条清单（可直接拿去问老板）

### C1 · `dsh-plugin-desktop/src/main.ts`（9 处冲突）
- **为什么结构性**：上游重排了启动流程——Setup Wizard 改成 `setupPending` + `beginDesktopSetupWizard` + `runtime.setupOnboarding` 状态机；新增 `launchWorkspaceReady` 工作区交接、`desktopPrimaryRuntime()` 主运行时、`healDesktopProfileModuleFallback` 移位、`profileBoot.markReady()` / `observeDesktopPreferenceSettings` / `logInactiveStartupEntries`；删除启动分析心跳；新增「共享数据目录迁移」与「Profile 通道准入」两段强制弹窗。
- **需要老板拍什么**：① 接受上游新启动流程为基线，我们在其上重新插入 4 个 OmniMux 调用点（seed 种子、`desktop-analytics` 生命周期上报、身份优先 harness home、44120 端口）——**这是唯一可行解，但要老板确认「接受」**；② 上游新增的共享数据目录迁移弹窗会不会动到现有 OmniMux 用户的 `~/.omnimux` 数据（会弹窗询问是否迁移），要不要在 OmniMux 上禁用。

### C2 · `dsh-plugin-desktop/src/index.ts`（13 处冲突）
- **为什么结构性**：插件注入面变了——`inject` 从 `['webServer','webApp','appExit','connection']` 变为 `['webServer','appExit','settings','connection']`（`settings` 变为强制注入）；Desktop 设置不再读我们 fork 的 `settings-access.ts`（`configValue`/`readSettingsValue`），改为上游 `createDesktopSettingsPort` / `resolveDesktopConfig`；新增 `watchUiThemeSource`、`watchPlatformLogin`。我们 fork 的设置访问层被整体替换。
- **需要老板拍什么**：接受上游 `settings` 服务作为唯一设置入口、废掉 fork 的 `settings-access.ts` 直读路径？（影响：fork 侧所有 `configValue` 调用点要迁移；OmniMux 自有设置项的写入路径要重接。）

### C3 · `dsh-plugin-desktop/src/profile.ts`（13 处冲突）
- **为什么结构性**：上游重写了 settings 文档的「行(row)」机制——`agent-presets` 行更名 `agent-preset-registry`（0.1.7 起 preset 声明改由 `@deepseek-ai/dsh-web-app/presets/*.patch.yml` 承载，不再走文件系统发现）、新增 `legacyWebRuntimeSources`、新增 `UPSTREAM_PRODUCT_ANALYTICS_ROW_IDS = ['desktop-product-telemetry','product-analytics']` 的**移除**逻辑、`pwsh-sandbox` / `desktop-windows-pwsh-sandbox` 行拆分。我们 fork 的 `stagedPresetRoot()`（`preset/agent-presets`）与 SANDBOX 行逻辑与之交叉。
- **需要老板拍什么**：确认「preset 种子目录 + 上游 preset 声明」并存的口径——上游已把 preset 名册迁到 patch 文件，我们是否继续用 `preset/**` 物化 OmniMux 专有插件（`owned-packages.json`）而只把 agent-preset 名册交给上游？另确认是否接受上游「默认移除 DeepSeek 产品分析行」的行为（与我们的 `analytics.omnimux.ai` 无关，但同一函数内）。

### C4 · `dsh-plugin-desktop/src/update-checker.ts` + `update-download.ts`（4 + 3 处冲突）
- **为什么结构性**：频道机制从**单 stable** 变为 **stable | beta | next** 三频道：`DesktopReleaseChannel` 类型扩容、版本准入规则按频道分支（`x.y.z-next` / `x.y.z-beta.N`）、产物名由 `OmniMux-*` 变为 `DSH-NEXT-*` / `DSH-Desktop-Beta-*` / `DSH-Desktop-*`。
- **需要老板拍什么**：① 更新端点保我们的 `https://updates.omnimux.local/api/desktop/version`（上游是 `https://www.dshdesktop.cn/...`）——按 B 级模板应保我们的，但**是否要把上游的 next 频道接进来**属于 C；② 产物名保 `OmniMux-*`；③ 是否引入 next 频道的更新链路（`dsh-desktop-next` 直接 import 这两个文件，见第 3 节）。

### C5 · `dsh-plugin-desktop/src/product-identity.ts`
- **为什么结构性**：身份表新增 `homeDirectoryName` 字段（上游 `.dsh` / `.dsh-beta`），且 beta 身份 `packageName` 由 `dsh-plugin-desktop` 改为 `dsh-plugin-desktop-beta`。这是 2026-09-12 那次 C 级决策（采用上游集中化品牌源、第二身份位映射 OmniMux Dev）的直接续集。
- **需要老板拍什么**：`homeDirectoryName` 取什么（我们现在是 `~/.omnimux`；是否声明 `.omnimux` / `.omnimux-dev`）；第二身份位是继续映射 Dev（`OmniMux-Dev`）还是改为映射 next 壳。

### C6 · `dsh-plugin-desktop/package.json`（12 处冲突）——含两个合同点名的 major
- **为什么结构性**：
  - **Electron `43.0.0` → `44.7.0`（major）**，`peerDependencies.electron` 同步（合同点名 C）。
  - **`asar: { smartUnpack: true }` → `asar: false`**：上游关掉了 ASAR。我们 2026-09 整轮工作（选择性 ASAR 迁移 + `preset/**` 解包 + 物理孪生路径解析）建立在这个开关上，`asarUnpack` 里的 `preset/**`、`node_modules/pnpm/**`、`@agents-anywhere/dsh-bridge-next/lib/bundled-connector/**` 全部随之失效。
  - **依赖 major**：`dshmarket 1.38.1 → 1.70.1`（major，我们的 `.yarn/patches/dshmarket-npm-1.38.1-*.patch` 要重做）；`pnpm 11.8.0 → 11.28.5`（我们的 `patches/pnpm@11.8.0.patch` 要重做，这个补丁是 profile 安装链的承重件）；`koffi` 我们 `3.1.5` / 上游 `3.1.1`（我们更新）；`node-addon-require-builtin ^0.1.4 → ^0.1.9`；`sharp 0.35.3 → 0.35.5`；`@deepseek-ai/schemastery ^3.18.2 → ^3.18.5`。
  - build/typecheck 脚本链：上游改用 `node ../scripts/run-parallel.mjs` 并行，并**新增 `vite build --config vite.client.config.ts`**（我们仓里没有这个配置文件，客户端产物走 `tsdown` + `tsc --emitDeclarationOnly`）。
  - `check` 脚本语义：上游把 `dsh-plugin-desktop` 从根 `check` 里**摘掉**了（见 C7）。
- **需要老板拍什么**：① 跟进 Electron 44（原生模块 prebuild：`fs-ext` / `node-pty` / `koffi` / `sharp` / `@vscode/ripgrep` / `@dataiku/uv` + macOS universal `x64ArchFiles` 合并）；② 是否接受上游 `asar: false`（会作废我们的选择性 ASAR 与 preset 解包口径，打包冒烟与种子分发要重验）；③ dshmarket/pnpm 两个 major 跟进与补丁重做；④ 是否吸收上游新增的 client vite 构建步骤。

### C7 · 根 `package.json`（5 处冲突）
- **为什么结构性**：上游 workspaces 变成 `['dsh-plugin-desktop','dsh-plugin-desktop-beta','dsh-desktop-next','dsh-community-fabric','dsh-community-market']`（我们是 3 个）；上游根 `check` = market check + next check + beta check + check:layout + aa-connector + fabric check —— **不含 `dsh-plugin-desktop check`**；上游 `build/typecheck/test` 三个都包含 legacy + beta + next。我们根 `check` 是 `check:layout && fabric check && market check && dsh-plugin-desktop check`。
- **需要老板拍什么**：issue 的验收是 `corepack yarn check` 通过。请拍板 `check` 的最终形态：**(a)** 保我们口径（含 `dsh-plugin-desktop check`）并追加 `dsh-desktop-next check`；**(b)** 跟上上游口径（legacy 不进 check）；**(c)** 只加 next 的 build/typecheck 不进 check。另：是否把 `dsh-plugin-desktop-beta` 加进 workspaces（与 C11 同一决策）。

### C8 · `upstream.json`（1 处冲突）
- **为什么结构性**：上游把单 `stable` channel 扩为 `stable` + `beta`（beta 指向 `dsh-plugin-desktop-beta`），`activeChannel: "beta"`。这**正面推翻了 2026-09-12 老板确认的「不引入 beta 变体、保持单 channel」**。
- **需要老板拍什么**：维持单 stable（并在 next 落地时新增 `next` channel），还是接受上游双/三 channel 结构？`activeChannel` 取哪个？

### C9 · `.github/workflows/ci.yml`（5 处冲突）
- **为什么结构性**：上游 CI 的打包矩阵已是 `workspace: [dsh-plugin-desktop-beta]`（windows/macos/linux 三平台），**ci.yml 里 `dsh-plugin-desktop` 出现 0 次**（我们 9 次）；新增 `desktop-linux` job；PR 上把 beta 的完整 check 换成精简版（`build + verify:frontend + 3 个 spec`），master push 才跑完整 beta check；check job 追加 Next 的 Playwright 门禁（window-controls / onboarding / protocol / sidebar-browser，需 xvfb）。脚本名改为 `check:win-package:platform` / `check:linux-package:platform`，新增 `DSH_WINDOWS_PACKAGE_COMPRESSION` / `DSH_WINDOWS_REUSE_UNPACKED`。
- **需要老板拍什么**：CI 打包线保留我们的 OmniMux 产物（`OmniMux-*-x64-Setup.exe` / `Portable.zip` / `latest.yml` + `verify:aa` 冒烟）不变；是否新增 linux 打包 job；是否把 Next 的 4 个浏览器门禁纳入（它们是 next 专属，跑起来要 Chromium + xvfb）。

### C10 · `scripts/verify-layout.mjs`（6 处冲突）+ `scripts/verify-desktop-variants.mjs`（上游新增，我们仓里没有）
- **为什么结构性**：`verify-layout.mjs` 上游**硬断言** 5 个 workspace 的精确列表、`activeChannel ∈ {stable,beta}`、读 `dsh-desktop-next/upstream-reference.json` 校验 next 的 `@deepseek-ai/dsh*` 全部等于 pin 版本。`verify-desktop-variants.mjs` 是一个 **next ↔ beta 字节级平价门禁**：固定替换表（`ai.deepseek.dsh.desktop.next`↔`.beta`、`.dsh`↔`.dsh-beta`、`NEXT`↔`BETA`、channel `next`↔`beta`…）+ `SYNCED_FILES`/`SYNCED_DIRECTORIES`，并提供 `sync:beta-to-next` / `sync:next-to-beta` 自动改写。
- **需要老板拍什么**：这个门禁要不要引入？它把「next 与 beta 必须保持同一份源码」写成了制度——如果我们只留一条壳线（next），这个门禁无意义；如果两条都留，它会强制我们的品牌改动同时落到两个包。**建议：不引入该门禁，改为只保留我们自己的单壳线校验。**

### C11 · `dsh-plugin-desktop-beta/**`（51 个 modify/delete + 合并会**新增 219 个文件**）
- **为什么结构性**：上游本区间继续维护 beta（版本 `2.0.20-beta.1`，292 文件），并把 beta 迁移成了新壳架构（219 个新增文件）。我们 2026-09-12 已决定移除该包；若维持该决定，第二阶段必须在合并后 `git rm -r dsh-plugin-desktop-beta` 并清掉根 workspaces / 根脚本 / CI / 变体门禁的所有引用。
- **需要老板拍什么**：维持「不引入 beta」（2026-09-12 决策延续）还是改为引入？**建议维持不引入**——beta 与 next 是同一份源码的两个频道变体（见第 3 节），同时引入两个是纯冗余。

### C12 · `dsh-desktop-next/**`（270 文件，**0 冲突**，纯新增）
- **为什么结构性**：零冲突意味着它「悄悄地」进来，没有任何 git 信号提醒需要决策；但它是上游新的产品线（见第 3 节判定）。
- **需要老板拍什么**：**引入方式**（第 3 节给建议）：① 只进 workspace 不发布（灰盒，`check` 不含）；② 作为 OmniMux 的下一版产品壳（整体采纳，重做品牌/种子/更新）；③ 暂不引入（保留 `.gitignore` 掉、不进 workspaces）。

### C13 · `dsh-plugin-desktop/src/desktop-plugins.ts`（**无冲突**，合并干净通过）
- **为什么结构性**：`IMMUTABLE_BUNDLES` 上游扩容——新增 `'dshmarket'` 与 `'@agents-anywhere/dsh-bridge-next'`（合同点名的「上游新增强制注入插件」，先例 community-market，我们用 profile patch 禁用）。因为该文件在两边都没被改到同一行，**合并会静默接受上游的扩容**，没有任何冲突提示。
- **需要老板拍什么**：这两个 bundle 变为不可禁用后，OmniMux 是否用 profile patch 关掉（延续 community-market 先例）？还是接受 `dshmarket`（我们的市场是 `dsh-community-market`，两者并存会不会出现双市场入口）。

## 3. `dsh-desktop-next/**` 引入方式判定

**判定：上游的终局是「整体采纳新框架」，方式是「next 就地取代 stable」；当前阶段是「新旧并存」，且 legacy `dsh-plugin-desktop` 会长期保留为共享底座。**

### 证据（全部实测）

1. **上游自己写了替换公告**：`dsh-plugin-desktop/src/next-transition-notice.ts`（上游新增，被 `electron-runtime.ts` 调用）文案：*「Next 将成为新的稳定版桌面端 / 下个版本发布后，我们计划用 Next 版取代当前稳定版桌面端。届时，你可以通过『检查更新』获取新版本。」* → 终局 = 整体采纳，路径 = stable 用户经「检查更新」升级到 Next。
2. **三条壳线并存**：上游根 workspaces = `dsh-plugin-desktop` + `dsh-plugin-desktop-beta` + `dsh-desktop-next`；根 `build/typecheck/test` 三个包都跑。`dsh-desktop-next/PLAN.md`：*"Desktop Next is a separate experimental package in the outer Yarn workspace… Stable and Beta keep their current implementations."*
3. **beta 与 next 是同一份源码的两个频道**：`scripts/verify-desktop-variants.mjs` 把 next↔beta 的 `src`/`tests`/`scripts`/`assets`/配置**逐字节对齐**，只允许固定替换表里的品牌差异；根脚本提供 `sync:beta-to-next` / `sync:next-to-beta`。→ 上游实际只有**两套壳**：legacy stable、以及新壳（beta/next 两个频道）。
4. **发布线已经切到新壳**：上游 CI 的 windows/macos/linux 打包矩阵只有 `[dsh-plugin-desktop-beta]`，`ci.yml` 中 `dsh-plugin-desktop` 出现 **0 次**；根 `check` 也**不含** `dsh-plugin-desktop check`。legacy 只保留 build/test，不再被门禁和打包覆盖。
5. **legacy 不是废弃品，而是新壳的共享底座**：`dsh-desktop-next` 有 **29 个跨包相对 import** 指回 `dsh-plugin-desktop`（`scripts/package*.ts`、`scripts/mac-universal.ts`、`scripts/release-preflight.ts`、`src/update-checker.ts`、`src/update-download.ts`、`src/desktop-installation-id.ts`、`src/client/desktop-settings-*.ts`、`src/product-identity.ts`、`src/disposable-tree.ts`…）；`dsh-plugin-desktop-beta` 同样是 29 个，而 beta→next 是 **0**。→ **删不掉 `dsh-plugin-desktop`**，它承载打包脚本链、客户端设置 UI、身份常量和更新客户端。
6. **next 明确不参与遥测**：`dsh-desktop-next/cordis.patch.yml` 里 `desktop-product-telemetry: disabled` + `product-analytics: disabled`；上游 `profile.ts` 也新增了移除 DeepSeek 分析行的逻辑。
7. **next 的成熟度有限**：`PLAN.md`：*"This iteration targets a runnable development package. Signed installers, offline release seeds, automatic updates, data migration from Stable/Beta, and enhanced windows require separate release qualification."* → 无签名安装包、**无离线 release 种子**、无自动更新、无数据迁移。

### 建议

| 选项 | 核心作用 | 优先级 | 必要性 | 风险/代价 |
| --- | --- | --- | --- | --- |
| **① 先灰盒引入**（进 workspace + 能 build/typecheck/test，不进 `check`、不打包、不品牌化） | 用最低成本把上游 551 提交的壳线纳入本仓，保住后续每次同步不再积压 | **P0** | 不做则下次同步冲突继续增长（本次 235 已接近合并地狱） | 低；`yarn install`/CI 时间增加，需在根 workspaces 与 `verify-layout` 同步 |
| **② 作为下一版产品壳整体采纳**（品牌化 + 种子 + 更新 + 打包） | 兑现上游「next 取代 stable」的路线，避免我们被留在已停止门禁/打包的 legacy 线上 | P1 | 不做则我们长期维护一条上游已放弃打包的壳 | 高：next **无 preset 种子机制**、无自动更新资格，等于把 `preset-profile.ts` / `stage-preset-profile.ts` / `preset/**` 整套种子与更新链路移植到新壳（`agent/omnimux-next` 分支已做出原型：`scripts/brand-omnimux.mjs`、`dsh-desktop-next/src/update-release.ts`、`tests/preset-seed.spec.ts`、`tests/stage-preset.spec.ts`） |
| **③ 暂不引入**（`.gitignore` 掉） | 零工作量 | P2 | 冲突与债务继续累积 | 中：下次同步仍要面对 270 文件与 legacy 停更 |

**建议路径：本次同步先做 ①（把 next 纳入 workspace、纳入 build/typecheck/test，但 `check` 与打包仍以 OmniMux legacy 壳为准），同时把 ② 作为独立 issue 排期**——理由是 next 缺种子与更新资格，第二阶段若强行一次做完会把「同步」和「换壳」两件高风险事情耦合在一次合并里。

### 对 preset/seed、品牌、Dev/Prod 端口的影响（实测）

| 面 | legacy（我们现在的产品壳） | next（上游新壳） | 影响 |
| --- | --- | --- | --- |
| **preset/seed** | `src/preset-profile.ts` + `scripts/stage-preset-profile.ts` + `preset/skeleton/*` + `preset/owned-packages.json` + `preset/seed-version`，打包期 stage、`preset/**` 解包 | **完全没有**（只有 `src/host/agent-preset.ts`）；`PLAN.md` 明说 offline release seeds 需要单独发布资格 | 采纳 next = 整套种子机制要移植（含 `.gitignore` 里 `preset/plugins|agent-presets|skills` 的构建期目录约定） |
| **品牌** | `product-identity.ts`（`OmniMux` / `ai.omnimux.desktop` / `OmniMux-Dev`）、bin `omnimux`、产物 `OmniMux-*`、`appId`、图标 | 全为上游通用值（`dsh-desktop-next`、`DSH NEXT`、`ai.deepseek.dsh.desktop.next`、`~/.dsh`、`DEFAULT_PROFILE='desktop'`） | 采纳 next 需要一次完整品牌化（`agent/omnimux-next` 的 `brand-omnimux.mjs` 是现成起点） |
| **Dev/Prod 端口** | 生产 `44120`（`desktop-port.ts`）、Dev `45120`；`web-server-port.ts` 的 `requireWebServerPort` 做绑定前硬失败 | next **没有端口常量**（`webserver.ts` 继承 `@deepseek-ai/dsh-host-webserver`，`listen(0)` 类随机口），仅 `mac-update-feed.ts` 用 `127.0.0.1:0` 做私有更新源 | 端口契约（44120/45120）在 next 里**没有落点**，需要重新设计；否则 Dev/Prod 并行与浏览器直连的既有约定会失效 |
| **更新链路** | 我们的端点 `updates.omnimux.local` + `OmniMux-*` 产物名；next **直接 import legacy 的 `update-checker.ts` / `update-download.ts`** | 频道写死 `'next'` | 我们在 C4 的解法会自动传导到 next（好消息）；但 next 没有自动更新发布资格 |
| **用户数据目录** | `~/.omnimux`（`DEFAULT_PROFILE_NAME='omnimux'`，`profile-manager.ts` 未冲突、我们的值原样保留） | `~/.dsh` + profile `desktop` | 采纳 next 需要数据迁移决策（上游 `PLAN.md` 把「从 Stable/Beta 迁移数据」列为未做） |

## 4. 第二阶段工作量估计

前提：只做「同步」（选项 ①），不含 next 产品化。

| 阶段 | 内容 | 估计 |
| --- | --- | --- |
| 2a 机械解冲突 | 104 A + 68 B：`git rm -r vendor/dsh-runtime/0.1.5-rc.2`、`_deprecated`、beta 处置、patches 收敛、i18n 侧车重算、yarn.lock 重生成 | **1–1.5 人日** |
| 2b C 级落地（老板拍板后） | `main.ts` / `index.ts` / `profile.ts` / `update-*` / `product-identity.ts` / `package.json` 逐项按模板解；吸收上游 43 个新 src 文件；重新接线我们 13 个 fork-only src 文件 | **2–4 人日** |
| 2c 依赖与打包链 | Electron 44 原生 prebuild、`asar: false` 口径重定、dshmarket 1.70.1 补丁重做、pnpm 11.28.5 补丁重做、`x64ArchFiles` 合并 | **1.5–3 人日** |
| 2d 验证 | `corepack yarn install`（慢）+ `typecheck` + `test`（基线：145 文件 / 1474 通过 / 9 跳过）+ 全量 `yarn check` + Next 冷启动 | **1–2 人日 + CI** |
| **小计（选项 ①）** | | **约 5.5–10.5 人日** |
| **+ 选项 ②（next 产品化）** | 品牌化、种子移植、更新链路、端口契约重设计、打包与冒烟 | **再 +3–6 人日**，不确定性最高 |

## 5. 🔴 D 级判定：0 项（附证据）

| D 级触发条件 | 判定 | 证据 |
| --- | --- | --- |
| 上游 license 变更（不再是 MIT） | **未命中** | 根 `LICENSE` 在 HEAD 与 origin/master 之间**零 diff**；两仓 `package.json` 均为 `"license": "MIT"`；新增的 `dsh-desktop-next/LICENSE.upstream` 全文为 MIT（Copyright (c) 2026 DeepSeek） |
| 上游闭源化 / 强制遥测 | **未命中**（方向相反） | 上游 `profile.ts` 新增 `UPSTREAM_PRODUCT_ANALYTICS_ROW_IDS` 主动**移除** DeepSeek 产品分析行；`dsh-desktop-next/cordis.patch.yml` 把 `desktop-product-telemetry`、`product-analytics` 设为 `disabled` |
| 必须拆除 seed 机制才能完成合并 | **未命中** | `src/preset-profile.ts`、`scripts/stage-preset-profile.ts`、`preset/**` 在 merge base 与 origin/master 中**都不存在**（fork 专有新增），合并不会删除它们；本次只在 `main.ts` 的调用点与 `profile.ts` 的 preset 行机制上发生交叉（已列入 C1/C3） |
| 要求把 OmniMux 专有改动回流上游 | **未命中** | 上游无任何此类要求；`.gitmodules` 上游 submodule 仍为只读 pin |

## 6. 风险清单（第二阶段）

1. **Electron 43 → 44（major）**：`fs-ext` / `node-pty` / `koffi` / `sharp` / `@vscode/ripgrep` / `@dataiku/uv` 的 prebuild 与 macOS universal `x64ArchFiles` 合并；本仓历史上打包冒烟在这个位置反复翻车（见 2026-09-12 日志的 ASAR 与 ripgrep 两处根因）。**高**。
2. **`asar: false`**：作废我们整轮「选择性 ASAR + `preset/**` 解包 + 物理孪生路径解析」的口径，`packaged-runtime-path.ts` / `module-resolution.ts` / `profile.ts` 的 `INSTALL_ANCHOR` 都要重验。**高**。
3. **`dshmarket 1.38.1 → 1.70.1`**：`.yarn/patches/dshmarket-npm-1.38.1-*.patch` 要重做到 1.70.1（上游用 `patches/dshmarket-desktop.patch`）。`agent/omnimux-next` 分支已做过一次（`fix(market): rebase the dshmarket desktop patch onto 1.70.1`），可作为先例但要独立验证。**高**。
4. **`pnpm 11.8.0 → 11.28.5`**：`patches/pnpm@11.8.0.patch` 是 profile 安装链的承重件，必须重做并验证 profile 物化。**中高**。
5. **静默丢失风险**：我们 13 个 fork-only src 文件中，多数**不冲突**（合并会保留文件），但它们的调用点在冲突文件里被重排——`desktop-analytics.ts` 的 4 个上报点、`preset-profile.ts` 的 seed 调用点、`desktop-identity.ts`、`web-server-port.ts`(44120)、`titlebar-double-click.ts`、`window-state.ts`、`managed-profile.ts`、`desktop-first-run.ts`、`desktop-mode-default.ts`、`settings-access.ts`。**必须逐调用点核对，不能靠「无冲突」判定安全。** **高**。
6. **`IMMUTABLE_BUNDLES` 静默扩容**（`dshmarket`、`@agents-anywhere/dsh-bridge-next`）：文件无冲突，合并直接接受；若不给 profile patch，用户将无法禁用这两个 bundle。**中**。
7. **边界文件协同**：`dsh-community-market/tests/market-settings-persistence.spec.ts` **已被上游删除**（`UD`），而 #3776 正在另一个 worktree 修改它——集成时必须先确认 #3776 的改动是对「上游已删除的文件」做的，可能整体作废。`dsh-plugin-desktop/tests/package.spec.ts` 为 `UU`。**高（协同风险）**。
8. **`yarn check` 口径**：上游 `check` 已摘掉 `dsh-plugin-desktop`；我们必须保留它并追加 next（或明确不追加），同时 `check:vendored-runtime` 上游是 channel 作用域（stable+beta）、我们是单次。**中**。
9. **`yarn.lock` 75 处冲突 + 上游 2469 个 vendor 文件新增**：若不先执行 vendor 剪枝策略，lock 与 `check:vendored-runtime` 会双红。**中**。
10. **验收语义未定**：「Next 壳在新主机上能起」——next 无签名安装包、无离线种子、无自动更新资格（PLAN.md）。需要老板明确「起」是 `yarn dev:next` 级开发启动、还是打包产物启动。**中（会直接决定 2d 的验收方式）**。
11. **主检出脏**：2.7GB 未跟踪 `dsh-desktop-next/` + 未提交 `dsh-plugin-desktop/preset/skeleton/cordis.patch.yml` → 任何原地 merge 都不可能；最终集成必须在 worktree 完成并经 PR 落地。

## 7. 三态声明

**已验证（本 worktree 实测）**：第 0 节全部数字；`dsh-desktop-next` 270 文件 0 冲突；beta 292/219/51；next 与 beta 各 29 个跨包 import、beta→next 0 个；`verify-desktop-variants.mjs` 的平价机制与替换表；`PLAN.md` 与 `next-transition-notice.ts` 原文；上游 workspaces/根脚本/CI 内容与 `dsh-plugin-desktop` 在 ci.yml 出现 0 次；Electron 43.0.0→44.7.0 与全部依赖差异；`asar` smartUnpack→false；`IMMUTABLE_BUNDLES` 扩容；更新端点两值；`DEFAULT_PROFILE_NAME` 我们 `'omnimux'` / 上游 `'desktop'` 且该文件无冲突；preset/seed 与 `desktop-analytics.ts` 为 fork 专有（base 与 theirs 均无）；上游 profile.ts 移除分析行；next `~/.dsh` + `DEFAULT_PROFILE='desktop'` + 无端口常量 + 无 preset/seed；LICENSE 零 diff；6 个 AA 补丁字节相同、2 个不同；`market-settings-persistence.spec.ts` 被上游删除。

**未验证（第二阶段才能确认）**：解冲突后的 typecheck/test 结果；`corepack yarn check` 是否全绿；Electron 44 下原生模块 prebuild 与 macOS universal 打包是否成立；`asar: false` 对我们打包冒烟与种子分发的实际影响；dshmarket/pnpm 补丁能否无痛重做；Next 壳在任何主机上的启动结果。

**推测（不作为结论）**：第二阶段人日区间；「上游会在下一个 release 把 next 推成 stable」的具体时间点（公告说「下个版本发布后」，但 PLAN.md 同时把自动更新列为未取得资格，故时点不确定）；next 的端口最终会否由上游补上常量。

## 8. 边界遵守

- 只在 `.worktrees/next-shell-merge-issue-3778/` 写入（分析产物在 `.analysis/`）。
- 主检出**只读**：未执行 merge / checkout / stash / clean / reset；未运行 `scripts/sync-upstream.sh`。
- 未跑 `corepack yarn install`；未 commit / push / `worktree.sh ship`。
- 未编辑 `dsh-plugin-desktop/tests/package.spec.ts`、`dsh-community-market/tests/market-settings-persistence.spec.ts`（仅记录）。
- worktree 保持**冲突落盘**状态（`MERGE_HEAD` 存在，无提交），供第二阶段接手。
