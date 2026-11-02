# OmniMux 桌面端构建、发布与 CDN 分发 SOP 规范

本文档定义 OmniMux 桌面客户端（macOS / Windows）从代码打包、版本门禁、Cloudflare R2 CDN 亚太存储分发的标准作业程序（SOP）。后续 Agent 在执行发版与构建任务时，必须严格遵守本契约。

**当前产品决策（Windows）**：以 **官网 CDN 直发** 为主；**Microsoft Store 暂停**，直至另行付费启用代码签名。详见 [windows-website-distribution.md](./windows-website-distribution.md)。

---

## 0. 打包环境前置条件

打包脚本对 Node 版本有硬性要求，**版本不符会直接拒绝**，不是警告：

```
macOS DMG smoke requires Node 22.19+ or Node 24.x with bundled Corepack; received 25.8.0
```

- **允许**：Node `22.19+`（22.x 线）或 Node `24.x`
- **拒绝**：Node `25.x` 及更高（未验证的 V8 与 Corepack 组合）
- **必须带 Corepack**：脚本通过 Corepack 解析 Yarn 4.18.0，裸装的 Node 不够

本机若默认 Node 是 25.x，打包前先切版本：

```sh
export PATH="$HOME/.nvm/versions/node/v24.18.1/bin:$PATH"
node --version   # 确认 24.18.1
```

打包前还需按仓库契约完成两项准备，否则会启动崩溃或依赖解析失败：

1. **stage preset**：仓库内已提交的 `dsh-plugin-desktop/preset/` 默认包含完整的 177 个已物化插件，**日常发版直接复用，禁止在本机盲目重跑 `yarn omnimux:stage`**（若本机 `../dsh-plugin` 源码树落后于线上分支，盲跑会导致 `preset/skeleton/package.json` 丢插件）。仅在明确需要从最新插件源码重刷时才执行 `OMNIMUX_PLUGINS_DIR=<插件目录> yarn omnimux:stage`，且执行后必须核对 `skeleton/package.json` 列表完整无缺失。
2. **依赖完整**：`corepack yarn install --immutable`（依赖树空心会让 electron-builder 在缺生产依赖时中断）
3. **本机直连网络门禁**：当在本机执行公证或大包上传时，必须确认当前生效的 Surge 主配置（`~/Library/Application Support/Surge/Profiles/Default.conf`）顶部已包含 `PROCESS-NAME,notarytool,DIRECT`、`DOMAIN-SUFFIX,notary-submissions-prod.s3-accelerate.amazonaws.com,DIRECT`、`DOMAIN,api.cloudflare.com,DIRECT`、`DOMAIN-SUFFIX,r2.cloudflarestorage.com,DIRECT`、`DOMAIN,dl.omnimux.ai,DIRECT` 与 `DOMAIN,upload.omnimux.ai,DIRECT`，否则代理节点（约 1 Mbps）会导致 547 MB 公证上传耗时 84+ 分钟并断流卡死。

---

## 1. 跨平台产物架构规范与「云端 + 本机混合构建分工」

### 1.1 macOS 产物规范（Apple Silicon vs Intel）与构建分工
- **双架构独立 DMG（当前主推）与通用 DMG**：
  - `OmniMux-<version>-arm64.dmg`（Apple Silicon M 系列芯片）
  - `OmniMux-<version>-x64.dmg`（Intel 芯片）
  - `OmniMux-<version>-universal.dmg`（通用二进制，按需）
- **云端 + 本机混合构建强制分工（2.0.21 实测铁律）**：
  - **Windows x64 + macOS arm64 → 走 GitHub Actions 云端构建与 R2 同步**：云端构建 `win`（约 12 分钟）与 `mac-arm64`（约 19 分钟）稳定快速，完成后直接触发私有仓 `r2-publish` 走机房带宽 1 分钟同步上云。
  - **macOS x64 → 强制走本机构建、签名、直连公证与 `upload.omnimux.ai` 分片上传**：GitHub Actions 的 macOS runner（无论 `macos-latest` arm64 还是 `macos-26-intel`）在对 50,765 个文件的 x64 包执行 `codesign` 时存在环境级退化（卡死 70–108 分钟直至超时取消），而在本机签名同一份 x64 包仅需 **1.5 分钟**，直连上传苹果公证（`--keychain-profile "AC_PASSWORD"`）仅需 **90 秒**，经自有域名 `https://upload.omnimux.ai` 分片上传 356.8 MB DMG 仅需 **2 分钟**。
  - **单架构精准瘦身 + ULMO 压缩 + 边缘全缓存 HIT**：`DSH_MAC_RELEASE_ARCH=arm64|x64` 会自动剔除另一颗芯片的 `primary-runtime` 与原生模块，配合 `dmg.format = "ULMO"`（LZMA），使 `arm64` DMG 降至 **393.07 MiB**、`x64` DMG 降至 **356.81 MiB**（连同 Windows `307.11 MiB` 全部低于 Cloudflare **512 MiB** 单文件边缘缓存上限），配合 `dl.omnimux.ai/*` 的 `cacheEverything` 边缘路由实现三端全员 `cf-cache-status: HIT`。
  - **完整操作指引**：已收敛为全局技能包 `omnimux-desktop-release`（真源：`/Users/x/Desktop/Project/opc-skills/skills/omnimux-desktop-release/SKILL.md`），执行发版前优先加载该技能。

### 1.2 Windows 产物规范
- **NSIS 安装包（x64 Installer - 官网主推）**：
  - 文件命名：`OmniMux-<version>-x64-Setup.exe`（兼容器名：`DSH-Desktop-<version>-x64-Setup.exe`）
  - 静默安装支持：支持 `/S` 参数无弹窗安装与自动更新，退出码为 `0` 表示成功。
  - **当前正式分发形态**：`yarn dist:win` 产出的 **unsigned** 安装包，经 R2/`dl.omnimux.ai` 官网下载。
  - **Microsoft Store**：暂停。Win32 商店包需 Authenticode（Policy 10.2.9）；付费签名路线见 `windows-trusted-signing-sop.md`，**不是**当前默认。

---

## 2. 双渠道分发：GitHub Release + Cloudflare R2

发行版资产**只构建一次**，随后由同一次 workflow 上传到**两个独立渠道**。渠道是分发手段的差异，不是构建流程的差异——不存在"GitHub 专用包"或"R2 专用包"。

### 2.1 渠道职责

| 渠道 | 定位 | 优势 | 国内可用性 |
| --- | --- | --- | --- |
| **GitHub Release** | 开源社区门面 + 版本归档 | 免费、公开可见、有历史版本 | 一般（受网络影响） |
| **Cloudflare R2**（`dl.omnimux.ai`） | 国内主分发 | 亚太节点、免出站流量费 | 好 |

两个渠道承载**完全相同的文件**。用户从任一处下载得到的安装包字节一致。

### 2.2 发布流程（单次构建，双渠道上传）

`.github/workflows/release.yml` 的 `publish` job 顺序执行：

1. **汇总产物**：`download-artifact` 把 `build-mac` / `build-win` 的产物合并到 `release-assets/`
2. **上传 GitHub Release**：`softprops/action-gh-release` 按 `release-assets/**/*.{dmg,exe,zip}` 发布
3. **同步 R2**：`node scripts/r2-dist-sync.mjs upload --dir release-assets`

### 2.3 渠道解耦（重要）

两个渠道**互不阻塞**：

- **GitHub Release 失败** → 整个 publish 失败，需要排查。
- **R2 失败或未配置** → 只跳过 R2，GitHub Release 照常发布。

R2 步骤带条件判断：`CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID` **两个 secret 都齐备**时才执行。缺任一个就跳过，不会因拼出 `accounts/undefined` 的 URL 而静默失败。

### 2.4 凭据管理

| 环境 | 存放位置 | 注入方式 |
| --- | --- | --- |
| CI 发布 | GitHub Actions Secrets | workflow 直接读 `secrets.*` |
| 本地开发 | 1Password Environment | `op run --environment <id> -- <cmd>` |
| 代码仓库 | **不存放任何凭据** | 只读 `process.env` |

**Account ID 与 API Token 一律不进仓库**。`r2-dist-sync.mjs` 要求 `CLOUDFLARE_ACCOUNT_ID` 必填，缺失时明确报错。本地凭据统一由 1Password 托管，不使用 `~/.wrangler/config/default.toml` 这类明文落盘文件。

### 2.5 应用内自动更新的版本元数据

应用检查更新时轮询**每通道一个静态对象**，与安装包同批上传：

```
https://dl.omnimux.ai/api/desktop/version-stable.json
https://dl.omnimux.ai/api/desktop/version-beta.json
https://dl.omnimux.ai/api/desktop/version-next.json
```

响应格式（由 `dsh-plugin-desktop/src/update-checker.ts` 解析）：

```json
{ "version": "2.0.20-next", "channel": "next", "sha256": { "mac": "<hex>", "windows": "<hex>" } }
```

**为什么每通道一个文件**：响应必须自报通道名，客户端会校验 `channel` 与请求通道一致。单文件无法同时满足多个通道。

**生成方式**：`scripts/build-release-metadata.mjs` 按版本号的预发布标签判定通道（`x.y.z` → stable、`x.y.z-next` → next），并计算安装包真实 SHA256。`--check` 供 CI 校验是否过期。release workflow 在发布前生成，`r2-dist-sync` 负责上传。

**注意**：`.json` 必须带 `application/json` content-type，否则客户端解析失败（脚本已映射）。

**历史问题**：此前端点为 `updates.omnimux.local`，一个开发期占位域名，解析到 `198.18.34.17`（RFC 2544 保留测试网段），实测 HTTP `000` 完全不可达——安装后的用户永远检查不到更新。

### 2.6 插件索引的前置条件：插件必须先在 npm 发布

索引条目最终会被市场客户端拼成 `name@version` 的安装规格，所以**索引里出现的每个版本都必须已在 npm 上可安装**。

`scripts/build-plugin-index.mjs` 生成时会联网核对，未发布直接失败：

```
Error: omnimux@0.1.2 is not published on npm (available: 0.1.0, 0.1.1)
```

**发布顺序不能颠倒**：

1. `npm publish` 插件包（如 `omnimux@0.1.2`、`omnimux-market`）
2. 生成插件索引（此时版本校验通过）
3. 索引随发布上传到 `plugins/dsh-index.json`

**为什么必须卡住**：索引指向不存在的版本，用户点安装就是 404，而且错误发生在客户端，服务端日志里看不到。

`--offline` 可跳过该校验，**仅供离线验证，真实发布不得使用**。

---

## 3. Cloudflare R2 亚太 CDN 存储与直链拓扑

所有发行版二进制资产均托管于 Cloudflare R2 亚太存储桶（亚太位置，国内与全球下载免出站流量费），并通过自定义域名 `https://dl.omnimux.ai` 全球 CDN 加速。

### 3.1 存储桶元数据
- **存储桶名称**：`omnimux-dist`
- **Account ID**：由 CI secret `CLOUDFLARE_ACCOUNT_ID` 提供（不写入文档）
- **绑定自定义域名**：`https://dl.omnimux.ai` (Zone: `omnimux.ai`, 证书与 SSL: 活跃)

### 3.2 存储路径标准拓扑
```
omnimux-dist (Bucket Root)
├── health.txt                                          # 监控与探活探针
├── releases/
│   ├── v<version>/                                     # 版本快照持久化目录
│   │   ├── OmniMux-<version>-x64-Setup.exe             # Windows 正式安装包（官网）
│   │   ├── OmniMux-<version>-universal.dmg             # macOS 通用 DMG
│   │   ├── DSH-Desktop-<version>-x64-Setup.exe         # Windows 兼容别名
│   │   └── DSH.Desktop-<version>-universal.dmg         # macOS 兼容别名
│   └── latest/                                         # 永久最新版本指针
│       ├── OmniMux-Setup.exe                           # Windows 最新安装包
│       ├── OmniMux-x64-Setup.exe                       # Windows x64 最新
│       ├── OmniMux-universal.dmg                       # macOS 通用最新
│       ├── OmniMux-mac.dmg                             # macOS 默认最新
│       ├── DSH-Desktop-Setup.exe                       # 兼容别名
│       └── DSH-Desktop.dmg                             # 兼容别名
```

---

## 4. Agent 发版命令速查表（CLI Matrix）

| 阶段 | 命令 | 说明 |
| :--- | :--- | :--- |
| **1. 前置物化** | `yarn omnimux:stage` | 从产品源码完整物化官方 `ALL_PLUGINS` 及其生产依赖；失败时不得发布部分 preset |
| **2. 版本一致性** | `node scripts/verify-version.mjs` | 校验根 `package.json` 与 `dsh-plugin-desktop/package.json` 版本一致 |
| **3. macOS 打包** | `yarn dist:mac` / `yarn dist:mac-smoke` | 打包 Universal macOS DMG 镜像 |
| **4. Windows 官网包（当前默认）** | `yarn dist:win` | 打包 **unsigned** Windows x64 NSIS，用于官网 / R2 分发 |
| **4b. Windows 付费签名包（暂停默认）** | `yarn dist:win-release` | Azure Trusted Signing；仅当明确恢复商店/付费签名时使用，见 `windows-trusted-signing-sop.md` |
| **5. R2 产物同步** | `yarn dist:r2-sync` | 自动上传 `dist/` 产物至 R2 并建立 `latest/` 别名（带智能去重） |
| **6. CDN 巡检** | `yarn dist:r2-verify` | 自动化并发探测 `https://dl.omnimux.ai` 节点可用性与字节数 |
| **7. 桶清单查询** | `yarn dist:r2-list` | 查阅当前 R2 桶中的所有在线对象与文件大小 |

`omnimux:stage` 必须递归保留 `dependencies` / `optionalDependencies` 可达的本地 `file:` 目录包，并在临时副本中改写为 preset 内部相对路径。只有候选 `plugins/`、`owned-packages.json` 与 `seed-version` 全部校验通过后才能一起发布；pnpm 失败必须输出 status、stdout 与 stderr 并退出，禁止从 profile 或旧 `node_modules` 回退成假成功。

打包时将已完成分发筛选的 `preset/` 作为独立 FileSet 保留；不得再用 App 默认的开发文件过滤规则删除插件声明的 `.d.ts`、源码、资源或原生文件，也不得全局关闭 App 过滤。候选验收需比较 stage 与最终 packaged preset 的声明分发清单、文件哈希和必要执行权限，并通过候选 Electron 与 bundled pnpm 执行隔离 Profile 重建和真实终端命令。嵌套依赖清单的官方元数据转换必须逐字段核对安装、解析及生命周期构建语义，不能概括忽略 `package.json` 或 `scripts` 差异。

---

## 5. 分发渠道策略

### 5.1 官网（当前 Windows 主路径）
- Installer URL：`https://dl.omnimux.ai/releases/v<version>/OmniMux-<version>-x64-Setup.exe`
- 最新指针：`https://dl.omnimux.ai/releases/latest/OmniMux-Setup.exe`
- SmartScreen / 未知发布者文案：见 [windows-website-distribution.md](./windows-website-distribution.md)
- 下载页信息架构 / 主 CTA / 禁止链：见 [download-page-spec.md](./download-page-spec.md)

### 5.2 Microsoft Store（暂停）
- **开发者账号**：`laozhong86@gmail.com`（个人开发者资质认证已通过；一次性注册费 ≠ 代码签名费）
- **应用名称**：`OmniMux`
- **Product ID**：`18c7607a-4248-4706-b796-c104bbf2ed42`
- **状态**：**不要重提**。上次认证因 Policy 10.2.9 / `Unsigned` 失败（报告 `aebe26db-16c8-4aa4-abe8-62963eca5bba`）。
- 若未来恢复商店：必须先付费完成 Authenticode（Trusted Signing 或 OV/EV），再按 `windows-trusted-signing-sop.md` 签名后重提；**禁止**再用 unsigned `dist:win` 作为 Package URL。

---

## 6. 发布后验收：自动更新链路

发布完成不等于链路可用。必须确认装机的应用能真的发现新版本。

### 6.1 应用侧的检查时机（来自 `dsh-desktop-next/src/updates.ts`）

| 项 | 行为 |
| --- | --- |
| 首次检查 | 启动后 **30 秒** |
| 轮询间隔 | 每 **6 小时** |
| 生效条件 | `app.isPackaged` 为真，且平台是 `darwin` 或 `win32` |
| 请求端点 | `https://dl.omnimux.ai/api/desktop/version-<channel>.json` |
| 超时 | 20 秒 |

**关键约束**：开发模式（源码直跑）**不会**触发更新检查。验收必须用真实安装包。

### 6.2 验收步骤

1. 装一个较低版本的真实包
2. 确认 `dl.omnimux.ai/api/desktop/version-<channel>.json` 上的版本**高于**已装版本
3. 启动应用，等待 30 秒
4. 确认出现「发现新版本」提示
5. 触发升级，确认安装包下载并完成替换

### 6.3 常见失败点

| 现象 | 原因 |
| --- | --- |
| 永远不提示更新 | 端点返回 404 或版本号不高于当前 |
| 提示了但下载失败 | 安装包 URL 不可达，或 `sha256` 与实际文件不符 |
| 提示 `service` 错误 | 端点不可达、超时，或 `channel` 字段与请求通道不匹配 |

### 6.4 为什么 GitHub Release 不能做更新源

GitHub Release 的资源 URL 会 **302 跳转**到 `objects.githubusercontent.com`，而更新检查器固定使用 `redirect: 'error'`（安全设计：防止更新请求被重定向到不可信地址）。因此：

- **R2（`dl.omnimux.ai`）**：唯一能支撑自动更新的渠道
- **GitHub Release**：只做人工下载与版本归档
