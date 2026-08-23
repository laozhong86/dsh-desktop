# OmniMux 官网发布全链路差距分析（2026-08-23）

> 从「用户视角」反推：一个外部用户从听说 OmniMux 到用上、并持续获得更新的完整链条，对照当前仓库代码逐环节盘点，标注缺失的组件 / 基础设施 / 规范合同。与 `docs/release-plan.md`（已归档 slim 壳迁移的发布方案）配套：本文档回答「差什么」，release-plan 回答「怎么补」。

## 1. TL;DR

- **发布链路代码侧已相当完整**：签名+公证发布脚本（`release-mac.ts` + preflight + `verify-mac-release.ts`）、客户端更新检查/下载/托盘交互（`update-checker/update-download/update-lifecycle`）都已写好且带测试。
- **卡住 GA 的是「资质 + 载体」两类缺口**，不是代码：
  - 🔴 Apple Developer Program 会员（¥688/年）+ Developer ID 证书 → 签名/公证硬前置；
  - 🔴 更新服务与下载分发的真实宿主（现在是占位域名 `updates.omnimux.local`）；
  - 🔴 官网/域名（用户第一入口，完全没有）；
  - 🟡 Windows 代码签名证书、Linux 安装格式、真·自动更新（当前是"下载 DMG 打开手动换"）、合规文档。
- **苹果"官方认证"问题的直接答案**：走 **Developer ID 签名 + 公证（notarization）**，不是 App Store 上架。前者是"Gatekeeper 放行"，后者是"商店审核+抽成+沙盒"。Electron 本地网关+插件架构不适合 App Store 沙盒，走 Developer ID 分发是正解。

## 2. 用户视角全链路（7 步）

| # | 用户动作 | 背后链路 | 当前状态 |
|---|---|---|---|
| 1 | 听说产品 → 访问官网 | 域名、官网（产品介绍/下载入口/FAQ） | 🔴 无官网、无域名 |
| 2 | 点击下载 macOS/Windows 安装包 | 下载页 → 分发宿主（GitHub Releases / CDN / OSS） | 🟡 无公开宿主（CI 只传 artifact） |
| 3 | 双击 DMG / 运行 EXE | 签名验证：mac Gatekeeper（Developer ID + 公证票） / win SmartScreen（Authenticode） | 🔴 mac 无证书；🟡 win 无证书 |
| 4 | 拖入 Applications / 走 NSIS 向导 | 安装器签名完整性 + 首次启动 `spctl` 放行 | 🔴 依赖第 3 步证书 |
| 5 | 打开 App 正常使用 | 公证 stapled ticket 生效；App 连 OmniMux gateway | 🟡 运行时无问题，但未签名包在 macOS 15+ 会被拦截 |
| 6 | 收到新版本推送 → 自动更新 | 应用内版本检查（启动 60s / 每 6h）→ 下载 → 替换重启 | 🟡 客户端代码就绪；但更新服务是占位域名，且当前是"打开 DMG 手动换"（半自动） |
| 7 | 遇到问题 → 找支持 | 官网 FAQ / 支持渠道 / 更新日志 | 🔴 无 |

## 3. 现状盘点（代码层）

### 已就绪 ✅

| 能力 | 位置 | 说明 |
|---|---|---|
| 三平台打包 | `dsh-plugin-desktop/package.json` build 段 + `dist:mac` / `dist:win` / `package:dir` | electron-builder 26.15.7；mac universal DMG、win NSIS + portable |
| macOS 签名+公证发布脚本 | `scripts/release-mac.ts` + `release-preflight.ts` | 强制 Developer ID + 公证凭据，缺凭据直接拒绝构建（有意保护）；`verify-mac-release.ts` 挂载 DMG 验 lipo/codesign/spctl/stapler |
| 客户端更新机制 | `src/update-checker.ts` / `update-download.ts` / `update-lifecycle.ts` / `updates.ts` | 完整 Cordis 插件：后台轮询 + 托盘"检查更新" + 确认下载 + 下载器限流校验 + 待装记录；带测试 |
| 许可三件套 | `LICENSE`(MIT) / `THIRD_PARTY_NOTICES.md` / notices 校验脚本 | 已存在 |
| CI 骨架 | `.github/workflows/ci.yml` + `release.yml` | release.yml 已是 mac/win 矩阵（macOS/Windows runner + 插件 staging），但走 artifact 不签名不发布 |
| 发布宿主候选 | git remote `fork` → `laozhong86/omnimux-desktop-fork` | 本身就是 public GitHub 仓，可作 GitHub Releases 宿主 |
| 发布方案文档 | `docs/release-plan.md` | 渠道/签名/CI/落地清单齐全（从旧壳迁移） |

### 缺口 ❌

| 能力 | 现状 | 影响 |
|---|---|---|
| 🔴 Apple Developer Program 会员 + Developer ID 证书 | 本机无 Developer ID（`security find-identity` 无有效身份），无付费会员 | mac 发布硬前置：未签名包被 Gatekeeper 拦截（"无法验证开发者"），公证无从谈起 |
| 🔴 公证凭据 | `release-mac.ts` 强制要求（APPLE_ID 三件套 / App Store Connect API key / keychain profile） | 证书到位后还需提供凭据才能跑通发布 |
| 🔴 更新服务后端 | `DESKTOP_VERSION_ENDPOINT = https://updates.omnimux.local/api/desktop/version`、下载端点 `…/api/downloads/mac|windows`——**占位域名** | 无真实服务 = 第 6 步完全不通 |
| 🔴 官网 + 域名 | 无 | 用户第一入口缺失 |
| 🔴 真·自动更新 | `electron-runtime.ts` 的 `downloadAndOpenUpdate`：下载 DMG → `shell.openPath` 打开 → 弹窗"请拖到 Applications 替换" | 半自动；不符合"检测→下载→替换重启"的 GA 目标 |
| 🟡 Windows 代码签名证书 | `package-win.ts` 明确 **unsigned**（`signExecutable=false`，Authenticode 是"独立发布步骤"但未实现） | SmartScreen 强警告，企业用户流失 |
| 🟡 Linux 安装格式 | 仅 `dir`，无 AppImage/deb | 无法"自由安装" |
| 🟡 CI 未接发布 | release.yml 手动触发、`CSC_IDENTITY_AUTO_DISCOVERY=false`、`notarize=false`、产物传 artifact 不传 GitHub Releases | 不能"打 tag 即发版"，无更新元数据流 |
| 🟡 规范/合同文档 | 无 EULA、无隐私政策、无版本策略文档 | 分发前必须补（尤其隐私：App 有遥测开关 `DSH_TELEMETRY_DISABLED`，需向用户声明） |
| 🟡 版本策略 | 版本跟随 upstream 2.0.2 | 公开发布需独立版本线 + tag 发版约定 |

## 4. 苹果"官方认证"是什么（直接回答）

- macOS 侧对外分发**不叫"官方认证"**（那是 App Store 上架）。真正对应的是两步：
  1. **Developer ID 签名**：付费成为 Apple Developer Program 会员（个人 ¥688/年，Account Holder 才能签发）→ 免费签发 **Developer ID Application 证书**（有效期 5 年）→ electron-builder 用它在构建时签名（hardened runtime 已开）。
  2. **公证（Notarization）**：把签名后的 App 上传 Apple 自动扫描（恶意软件/签名问题）→ 通过后获得 **ticket**，`stapler` 打进包里 → Gatekeeper 首次启动放行、不弹"无法验证开发者"。
- 关键认知：**"会员付费、证书免费"**；公证是会员额度内服务，不再单独收费。证书私钥可导出 p12 走现有 `MAC_CERT_P12_BASE64` 通路，CI 可复用。
- Windows 对称：**Authenticode 代码签名证书**（OV 可 p12 走 CI，EV 需硬件 token）或 Azure Trusted Signing（按次计费、CI 友好）过 SmartScreen。
- 不需要走 Mac App Store：Electron + 本地网关 + 插件体系在 App Store 要过沙盒审核且被抽成，本产品架构不适配。

## 5. 差距 → 落地动作映射（含决策点）

| 决策点 | 选项 | 推荐 | 理由 |
|---|---|---|---|
| D1 发布宿主 | a) GitHub Releases（免费，electron-builder 原生 publish） b) 自建 S3/CDN + 自建更新服务 | a 起步 | release-plan.md 已论证；国内下载慢可后续加 OSS 镜像 |
| D2 更新服务 | a) 复用现有生产 origin（45.58.165.234 VPS）挂 `/api/desktop/version` + `/api/downloads/*` b) 静态 JSON + OSS 直链 | a | 客户端契约已定死这两个端点，实现它即可，无需改代码 |
| D3 自动更新方案 | a) 接入 electron-updater（zip + blockmap + quitAndInstall，需 EDDSA 更新签名密钥） b) 接受半自动（下载 DMG 手动换）作为 GA v1 | a 为终态；b 可过渡 | GA 目标明确要求"真正替换运行中的 App" |
| D4 Windows 签名 | a) OV 证书（年费，p12 进 CI） b) Azure Trusted Signing（按次计费） | b 成本更低更安全 | CI 无需持有私钥 |
| D5 官网托管 | a) 域名 + 静态站（GitHub Pages/Vercel/CloudStudio） b) 域名 + 自建 | a | 上线快、成本低 |
| D6 版本线 | a) 跟随 upstream 2.x b) 独立 1.0.0 起 | b | 公开发布需稳定、可解释的版本语义 |

**推荐执行顺序**（参考 release-plan.md 第 7 节）：先做硬前置 ① 苹果会员+证书（mac GA 唯一不可绕过的付费项）→ ② 域名+官网+更新服务（D1/D2/D5，无证书也能验）→ ③ 接 CI 发布（打 tag 即发版，mac 先跑）→ ④ 自动更新落地（D3）→ ⑤ Windows 证书 + Linux 格式补齐 → ⑥ 合规文档收尾。

## 6. 合规与风险清单（规范/合同层）

| 项 | 内容 | 状态 |
|---|---|---|
| 许可声明 | MIT + THIRD_PARTY_NOTICES（引入 electron-updater 后需补其 notices） | 🟡 基本就绪 |
| EULA | 用户安装即同意的最终用户许可协议 | 🔴 缺 |
| 隐私政策 | 数据收集声明（遥测开关、本地 first 架构、gateway 链路） | 🔴 缺 |
| 网站备案 | 若官网/更新服务部署在国内服务器，域名需 ICP 备案；海外服务器可免 | 🟡 取决于 D2/D5 |
| 证书私钥管理 | 只经 CI secrets / `.env` 传给 electron-builder；沿用 `release-preflight.ts` 的 secret 剥离策略 | ✅ 已有机制 |
| 更新完整性 | electron-updater 场景需 EDDSA（ed25519）更新签名密钥对，公钥进 App | 🔴 未做（D3 时落地） |
| 证书吊销/过期 | Developer ID 证书 5 年；会员到期后无法签发新证书签名新版本（老版本仍可运行） | 🟡 需纳入年度运维日历 |

## 7. 验收口径（对齐 release-plan.md §9）

公开环境新 Mac / Win / Linux 各跑一遍：
1. 官网下载 → 安装（mac 双击 DMG 无 Gatekeeper 硬阻断截图；win SmartScreen 无警告）；
2. 启动 60s 内/手动检查 → 提示新版本 → 下载 → 替换重启 → 版本号变更成功；
3. 回滚通道：保留手动 feed 作为救助（当前 `updates.omnimux.local` 契约不变）。
