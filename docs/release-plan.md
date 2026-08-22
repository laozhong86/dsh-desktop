> [!NOTE] 本文档 2026-08-22 自已归档的平行 slim 壳（omnimux-desktop）迁移。
> 决策参考仍适用：签名证书、发布渠道（GitHub Releases + electron-updater）、CI 矩阵、版本策略。
> 与 fork 线现状对照：mac/win 签名与公证 preflight 已在 `scripts/release-mac.ts`/`release-win.ts`；
> 本仓库「shell 不替换运行中 App」的描述对该 fork 线不完全适用，GA 落地时以本仓实际行为为准。

# OmniMux Desktop 公开发布方案

本文档回答：如何让外部用户自由安装、下载、自动更新 OmniMux 桌面应用。基线是对当前仓代码的直接盘点（2026-08 状态），结论优先级从"改动最小可上线"到"体验完整"排列。

## 1. 目标

公开发布（GA）要求同时满足三条：

1. **自由安装**：用户从公开渠道下载并 Open/安装，无需内网、无需 git；
2. **强制签名信任**：macOS 过 Gatekeeper、Windows 过 SmartScreen，用户不被"未知开发者/危险程序"文案劝退；
3. **自动更新**：应用内检测新版本并真正替换运行中的 App，而不是丢一个 DMG 让用户手动挂载。

## 2. 现状盘点（哪个现状对得上文档，就以代码为准）

### 已就绪

| 能力 | 入口 | 结论 |
|---|---|---|
| 完整打包 | `pnpm run package` / `dist` | electron-builder 26，`dist/mac-*/OmniMux.app` 已产出 |
| macOS 签名 + 公证 | `scripts/release-mac.ts` + `scripts/release-preflight.ts` | 脚本与校验链路就绪；**但本机无 Developer ID 证书，preflight 现在会失败**，见 §4 |
| macOS 安装验证 | README `mount + codesign + spctl + stapler` | 已文档化 |
| macOS 静默更新检查 | `src/auto-update.ts`，`OMNIMUX_UPDATE_FEED` JSON | 托盘"检查更新" + 启动后 60s 静默检查 |
| 许可三件套 | `LICENSE`(MIT) / `NOTICE` / `THIRD_PARTY_NOTICES.md` | 已存在 |

### 缺口

| 能力 | 现状 | 影响 |
|---|---|---|
| **发布渠道** | electron-builder 无 `publish` 段；desktop 仓无 git 远端（仅 upstream 研究 remote） | 无下载宿主、无更新元数据流 |
| **macOS 签名证书** | 本机仅一张 `Apple Development` 证书，**无 Developer ID Application**；需先成为 Apple Developer Program 付费会员才能签发 | GA 前置，否则 Gatekeeper 拦 |
| **真·自动更新** | 现有 `auto-update.ts` 下载整个 DMG→`shell.openPath` 打开，**不替换运行中的应用** | 用户仍要走"挂载→拖入→替换"手动流程，不满足第 3 条 |
| **Windows 签名** | `release-win.ts` 有签名变量位但无证书坐标系 | SmartScreen 强警告，企业场景流失 |
| **Linux 安装格式** | 仅 `dir`，无 .AppImage/.deb/.rpm | 无法"自由安装" |
| **CI** | 无 `.github` | mac 公证只能在 macOS 做、NSIS 最好在 Windows 做——单机无法全平台产出 |
| **元数据** | `private:true`、`version 0.1.0` | 非阻断，但发布需改公开 + 定版本 |

## 3. 发布渠道决策

**推荐：GitHub Releases**（当前 appId `ai.omnimux.desktop`，无资产管理依赖）。

理由：
- 免费，天然承载三个平台的二进制 + 下载统计 + 原子 draft→publish；
- electron-builder 原生 `publish: github` + `electron-updater` 自动读 `latest.yml`/`latest-mac.yml`/`latest-linux.yml` 元数据，反馈最平滑；
- 桌面仓目前无远端，正好补一个 public repo 作为 Release 宿主（可作为独立仓，也可并入发布的 monorepo）。

备选（不拦，仅记录）：S3 + CloudFront、自建静态站点。GitHub 够了，先不引入运维成本。

**更新 feed 兼容**：即使后续切到 electron-updater，仍保留 `OMNIMUX_UPDATE_FEED` 指向一个 HTTPS JSON `{version,url}` 作为显式干净退回 / 供未打包调试用。README 中"shell 不下载不替换、直接开浏览器"的描述已与现在代码不符（代码实际下载后开 DMG），改版时同步校正。

## 4. 各平台构建与签名矩阵

| 平台 | 目标产物 | 签名 | 需要的 runner | 状态 |
|---|---|---|---|---|
| macOS | `.dmg` + `.zip`（updater 用 zip） | Developer ID + 公证 | macOS | 🟡 签名链路就绪、凭据路径齐全，但**本机无 Developer ID 证书**，需先购开发者会员并签发 |

### macOS 代码签名（GA 前置）

> [!IMPORTANT]
> **证书不额外付费，但需要付费会员。** Developer ID Application 证书本身由 Apple 免费签发，前提是你已是 **Apple Developer Program 会员（个人 ¥688/年）**。公证（notarize）是会员额度内的一项服务，不再单独收费。本机现有 `Apple Development` 证书只能本地调试，不能对外分发受信任。

- 申请路径：加入 Apple Developer Program → Xcode → Settings → Accounts 生成 **Developer ID Application** 并导入 Keychain（或导出 p12 走 `MAC_CERT_P12_BASE64` 通路）。
- 付费之外的成本是**年度会员续费**（¥688/年）；证书签发免费，二者是"会员付费、签发免费"的关系。
- 取得 Developer ID 后，本仓 `release-mac.ts` 的 preflight 才会通过；否则现在 `security find-identity` 会失败并**拒绝构建**（这是有意的安全保护）。
| Windows | `.exe` (NSIS) + `.dmg` 不要，`latest.yml` blockmap | Windows 代码签名证书 | Windows | 🟡 缺签名证书 |
| Linux | `.AppImage` + `.deb` | 无 | Linux | 🔴 缺配置 |

### Windows 代码签名（关键前置）

> [!IMPORTANT]
> Windows 开发者签名直接决定公开发布是否可行：无签名证书时文档引导用户手动绕过，行为不达第 2 条。优先路线：

- **首选：Windows 代码签名证书（OV 或 EV）**。EV 在 CI 上需硬件 token 入 minter，OV 可 p12 + `CSC_LINK`/`CSC_KEY_PASSWORD` 与现有 mac P12 机制一致，显然好接。证书按年订购，约年百元级。
- **低成本替代：Azure Trusted Signing**。证书托管在 Azure，通过 OIDC/API 签名，CI 无需持有私钥，安全性更好、单价低。适合企业/团队签发。
- **过渡（不推荐公开）**：`pnpm run dist:win` 可出未签名 NSIS，仅供内部/私人渠道分发；不满足公开发布门槛。

把证书取证书名后，写入与 mac P12 相同的 `.env` 提供：`WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` + `CSC_NAME`（`release-win.ts` 已预留变量名）。

### Linux 格式决策

- 最省事：`.AppImage`（单一可执行文件，自由安装/拷贝即用，无需 root）。加 `target: ["AppImage","deb"]` 即可；
- 需要包管理器：配 `.deb` / `.rpm`，electron-builder 用 fpm 生成。
- 无签名负担，无强信任障碍。推荐先 `.AppImage`。

## 5. 自动更新架构（关键改造）

### 目标

从"下载 DMG → 打开 → 手动换"升级为"检测 → 增量/整包下载 → 提示 → `quitAndInstall` 自动替换重启"。

### 方案：接入 `electron-updater`

- 新增依赖 `electron-updater`（开发依赖），版本对齐 electron-builder 26 主版本。
- electron-builder `build.publish` 增加：
  ```jsonc
  "publish": [{ "provider": "github", "owner": "<owner>", "repo": "<repo>" }]
  ```
- 这样每次 `electron-builder --publish always` 会生成并上传：
  - `latest-mac.yml`（指向 zip）、`latest.yml`（windows）、`latest-linux.yml`；
  - Windows `blockmap` 差分更新，mac `zip` 全量替换。
- main 进程在启动后调用 `autoUpdater.checkForUpdatesAndNotify()`；给托盘配合：
  ```ts
  autoUpdater.on('update-available', ...)
  autoUpdater.on('update-downloaded', () => quitAndInstall())
  ```

### 5.1 与现有 `auto-update.ts` 的关系

- `auto-update.ts` 的 `checkForUpdate`/`downloadUpdate` 是完整且测试过的模块，可保留作：

  - **feed 无 GitHub / 网络受限** 时的干净回落（`OMNIMUX_UPDATE_FEED` 分支）；
  - 在接入 electron-updater 前，两条路径都能独立工作的过渡手段。
- **不删除** `auto-update.ts` 的公共 API（其 `downloadUpdate`/`checkForUpdate` 已有预写测试）。改造施工项是：把 main.ts 的 `runUpdateCheck` 改为先查 electron-updater，feed 分支保留。
- **受限网络用户**：electron-updater 支持下载失败重试与取消，体验优于手写。

> ⚠️ electron-updater 每次发布必须含 zip（及 Windows blockmap）更新包；若切换代码签名身份，需同步改 `appId` 或版本号，否则旧版无法识别新包的升级路径。

## 6. CI 自动发布（GitHub Actions）

中间件聚焦解决："mac 公证只能在 mac、NSIS 只在 win"，单机做不到全平台。

推荐 workflow（`.github/workflows/release.yml`，draft Release）：

```yaml
name: release
on:
  push:
    tags: ['v*']
jobs:
  release:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install
      - run: pnpm run build
      # 按平台注入 secrets：mac 用 APPLE_*，win 用 WIN_CSC*，linux 无需签名
      - run: pnpm exec electron-builder --publish always
        env:
          # mac 用 APPLE*，win 用 WIN_CSC*
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- `GH_TOKEN`（GITHUB_TOKEN）让 builder 上传 Release + 元数据到 draft；
- 推 tag `vX.Y.Z` 触发构建；完成后在 Releases 页面把 draft 标为正式发布。
- 版本号：设为跟随 tag（或 git tag 与 package.json 同步），在 README 发布段说明"打 tag 即发版"。

**备选（暂不做）**：electron-builder 依赖 `electron-updater` 与证书环境在 CI 就绪性 → 先跑 mac（已有完整开箱签名公证），win 证书到位后再开 CI 开关。

## 7. 落地改动清单

按依赖顺序（可局部/部分执行）：

| 序号 | 改动 | 文件 | 依赖 |
|---|---|---|---|
| 0 | **购 macOS 开发者会员（¥688/年）并签发 Developer ID，导入本机/导出 p12** | Apple Developer Program | 付费会员 |
| 1 | 补 Windows 签名证书（p12 交付变量） | `release-win.ts`（仅接变量） | 购买证书 |
| 2 | Linux 加 `.AppImage`/`.deb` 目标 | `package.json` `build.linux` | 无 |
| 3 | 加 `publish: github` 段 | `package.json` `build` | 建 repo |
| 4 | 装 `electron-updater`，main 挂 autoUpdater | `package.json` / `src/main.ts` | 3 |
| 5 | 为 desktop 仓建立 public remote（GitHub） | git remote | 3 |
| 6 | 配 GitHub Actions release | `.github/workflows/release.yml` | 0,1,2,5 |
| 7 | 定 `version` 策略（跟随 tag），放开 hosted release draft 发布 | package.json / README | 5,6 |
| 8 | 校正 README 更新描述（"不自动替换"改为准确定义） | `README.md` / `README.zh.md` | 4 |

**建议执行顺序**：先做 0（macOS 会员+证书，因为它是 mac 发布唯一硬前置），然后 2→3（本地先把 Linux + publish 段打通，无需证书即可验）；等 mac cert 与 win cert 都到位后再 4→5→6 上 CI，7/8 收尾。

## 8. 合规与风险

- **许可**：MIT + THIRD_PARTY_NOTICES 已存在；若引入 electron-updater 需它包含其 license 部分（均 MIT/Apache，无需额外动作，但要进 notices）。
- **签名证书私钥**：只经 `.env`/CI secrets 传给 `electron-builder`，传递策略沿用现有 `release-preflight.ts`（删除 sanitized env 里的 secret、build 子进程不接 secret）。
- **CI 凭据**：`GITHUB_TOKEN`/`CSC_LINK`/`CSC_KEY_PASSWORD` 以 secrets 存，构建日志与 artifact 不落库。
- **日志泄漏**：构建日志可能包含签名字段；在 workflow output 屏蔽 `CSC_LINK`/`MAC_CERT_*` 等。

## 9. 验收

公开环境新 Mac / Win / Linux 各跑一遍：

1. 从 Release 页下载安装（mac 双击 DMG，win 运行 NSIS，linux 运行 AppImage）；
2. 截图：首次打开无 Gatekeeper/SmartScreen 硬阻断；
3. 发一个 `v0.2.0` 假版本 → 启动 60s 内提示更新 → 下载 → `quitAndInstall` → 版本号变更成功。

**失败回滚**：保留 `OMNIMUX_UPDATE_FEED` 手动 feed 作为用户侧救助通道；electron-updater 与手写 `auto-update.ts` 双通道并存，问题可退回。