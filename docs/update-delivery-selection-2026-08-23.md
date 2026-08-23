# OmniMux 更新分发选型与迁移路线

> 日期：2026-08-23 · 决策：更新后端采用第三方成熟链路 **electron-updater + GitHub Releases**，不自建更新服务。
> 状态：分发地基已落地（release.yml 增加 GitHub Release 发布），客户端切换与签名待官方 Apple 认证完成后执行。

---

## 一、选型结论

| 维度 | 决策 |
| --- | --- |
| 更新客户端 | **electron-updater**（electron-builder 官方配套，社区最主流） |
| 分发后端 | **GitHub Releases**（免费、零自建、可追溯、支持资产回滚） |
| 淘汰方案 | 自建 `updates.omnimux.*` 服务（成本高、需维护、无回滚） |

**为什么是这条链路**：electron-updater 是 electron-builder 团队维护的官方更新库，与现有打包工具链同源，天然支持 NSIS / DMG 差分更新、签名校验、`latest*.yml` feed。GitHub Releases 提供持久、可追溯、可撤下的分发资产，配合 electron-updater 构成 Electron 生态最成熟的免费自动更新方案，无需自建任何服务。

---

## 二、现状 vs 目标

### 现状（已盘点）

- 自研更新三段逻辑完整：`src/update-checker.ts`（版本检查）、`src/update-download.ts`（安装包下载）、`src/update-lifecycle.ts`（托盘/轮询/确认下载）。
- 但端点全部指向占位域名 `updates.omnimux.local`（mDNS 保留，公网不可解析）——**更新后端实际不存在**，用户「检查更新」必失败。
- 引用点仅 3 处：`update-checker.ts:4`、`update-download.ts:14-15`。
- release 产物仅 `upload-artifact`（14 天保留），无持久分发。

### 目标

- 客户端用 electron-updater 读 `latest*.yml` feed，实现「检查更新 → 下载 → 安装 → 重启」全自动。
- 构建侧用 electron-builder 原生 publish 生成 `latest.yml` / `latest-mac.yml` 并发布到 GitHub Releases。
- macOS 侧签名 + 公证（electron-updater 强校验签名），Windows 侧 NSIS 差分更新。

---

## 三、迁移路线（分阶段）

### 阶段 A —— 分发地基（✅ 本轮已落地）

`release.yml` 新增 `publish` job，用 `softprops/action-gh-release` 把 mac/win 构建产物发布为 GitHub Release（tag 取 `v{version}`），替换原来 14 天临时 artifact 的手工分发。

- 收益：产物持久化、可追溯、有固定下载地址。
- 限制：仍发 unsigned 产物；暂不生成 `latest*.yml`（需签名后）。

### 阶段 B —— 客户端切 electron-updater（待签名认证完成）

1. 新增依赖 `electron-updater`（electron-builder 生态）。
2. 用 `autoUpdater` 替换 `update-checker.ts` / `update-download.ts` / `update-lifecycle.ts` 的自研实现，保留托盘文案与交互契约（`DesktopUpdateAdapter`）。
3. 重写相关测试（`update-checker.spec.ts` / `update-download.spec.ts` 等）。
4. `DESKTOP_VERSION_ENDPOINT` / `DESKTOP_DOWNLOAD_URLS` 两个 `.local` 占位常量随自研逻辑一并移除。

### 阶段 C —— 构建侧原生发布（待签名认证完成）

1. `release.yml` 的构建命令从 `--publish never` 改为 `--publish always`，注入 `GH_TOKEN`。
2. electron-builder 自动生成并上传 `latest.yml` / `latest-mac.yml` 到 GitHub Release。
3. macOS 用 `notarytool` 公证、`APPLE_API_KEY` 走 App Store Connect API；证书凭据走 GitHub Secrets，定期轮换。

### 阶段 D —— 回滚与灰度 + runbook

- **回滚**：GitHub Release 可删除坏版本、`latest*.yml` 可指回上一稳定版，客户端自动降级（`allowDowngrade`）。
- **灰度**：electron-updater `channel`（`latest` / `beta`）做分批发布。
- **runbook**：`docs/contracts/release-runbook.md`，明确「发坏包怎么撤」「签名怎么轮换」。

---

## 四、签名依赖（阻塞项，老板侧处理中）

macOS 自动更新的完整链路强依赖签名 + 公证：

- electron-updater 在 macOS 用 Squirrel.Mac，**未签名的包无法完成更新校验**。
- 官方付费 Apple Developer 认证流程正在走，认证完成前 macOS 更新只能停留在「unsigned 产物进 GitHub Release」阶段。
- Windows 侧不受此阻塞，NSIS 签名 + 差分更新可在签名就绪后先行上线。

---

## 五、本轮已落地清单

| 项 | 状态 |
| --- | --- |
| `.gitignore` 补根 `/dist/` | ✅ |
| `release.yml` 安装改 `--immutable` | ✅ |
| action 锁 SHA（checkout/setup-node/cache/upload-artifact/download-artifact/gh-release）+ `dependabot.yml` | ✅ |
| `scripts/verify-version.mjs` 版本一致性门禁，挂 ci.yml + release.yml | ✅ |
| `release.yml` 新增 `publish` job（GitHub Release 分发地基） | ✅ |
| 客户端切 electron-updater + `latest*.yml` | ⏸ 待签名 |
| 回滚/灰度 + runbook | ⏸ 待签名后 |

---

## 六、待老板拍板 / 跟进

1. Apple 认证完成后，通知启动阶段 B/C（客户端切换 + 原生发布）。
2. `GH_TOKEN` 用默认 `GITHUB_TOKEN`（当前 publish job 已用），如需跨仓发布（fork → 官方仓）再评估 PAT。
3. 是否维持 `plugins-source` 快照分支（release 插件源）——独立议题，见部署审计报告。
