# OmniMux Desktop 部署基础设施审计报告

> 审计日期：2026-08-23 · 范围：CI/CD、打包发布、更新分发、上游同步、仓库卫生
> 结论先行：**更新通道是占位域名、macOS 签名靠人工、action 未锁 SHA、发布锁文件可漂移**，四条是当前最大的部署风险。

---

## TL;DR

| 维度 | 现状 | 风险等级 |
| --- | --- | --- |
| CI 分层 gate | ✅ 完善（路径分类 + 全量 headless + 真机打包冒烟） | 良好 |
| 发布流水线 | 🟡 手动 dispatch，产物仅 14 天 artifact | 中 |
| macOS 签名/公证 | 🔴 全靠人工 credentialed 机器，无 CI 签名 | **高** |
| 更新分发通道 | 🔴 端点 `updates.omnimux.local` 为占位域名，无后端 | **高** |
| 依赖可复现性 | 🟠 release 用非 immutable 安装，锁文件已有未提交改动 | 中高 |
| 供应链安全 | 🟠 action 全部浮动 tag（`@v6`/`@v4`）未锁 SHA | 中高 |
| 回滚/灰度 | 🔴 无任何回滚与金丝雀机制 | 高 |
| 可观测性 | 🟡 遥测被禁用，无崩溃监控/启动失败诊断 | 中 |

---

## 一、现状盘点

### 1. 发布链路（现有）

```
push/PR → ci.yml（分层 gate）
              ├─ changes：路径分类，docs-only 跳过产品 gate
              ├─ check：build + typecheck + test + 全量 headless smoke
              ├─ desktop-windows：真 Windows runner，NSIS + portable 打包
              ├─ desktop-macos：真 macOS runner，无签名 universal DMG 冒烟
              └─ upstream-command-windows：上游 portable-shell 冒烟

手动 workflow_dispatch → release.yml
              ├─ 从 fork 的 plugins-source 分支 checkout 插件源（omni-source/）
              ├─ stage:preset → build → electron-builder（--publish never）
              └─ upload-artifact（14 天保留）→ 人工下载分发
```

### 2. 打包配置要点（`dsh-plugin-desktop/package.json`）

- electron-builder `26.15.7`，`mac.notarize: true`、`hardenedRuntime: true`、`asar: true`。
- `build.mac.target: ["dir"]`，DMG 通过 `release-mac.ts` 脚本单独出。
- 产物命名：`OmniMux-${version}-${arch}-Setup.exe` / `-Portable.zip`。

### 3. 更新通道（`src/update-*.ts`）

更新检查、下载、生命周期三段代码完整（`update-checker.ts` / `update-download.ts` / `update-lifecycle.ts`），但端点全部指向：

- 版本检查：`https://updates.omnimux.local/api/desktop/version`
- 安装包下载：`https://updates.omnimux.local/api/downloads/mac` / `.../windows`

**`updates.omnimux.local` 是 mDNS 保留域名，公网不可解析** —— 更新后端实际不存在。用户点「检查更新」必然失败；若启动时默认检查，会产生无谓的失败请求。

---

## 二、风险清单（按严重度）

### 🔴 P0 —— 阻断级，应立即处理

| # | 风险 | 证据 | 影响 |
| --- | --- | --- | --- |
| 1 | **更新分发通道未上线** | `update-checker.ts:4`、`update-download.ts:13-16` 硬编码 `updates.omnimux.local` | 用户无法收到任何更新，检查更新/下载必失败 |
| 2 | **macOS 签名/公证无自动化** | `ci.yml:124-127` 注释明言「签名在 credentialed 机器手动做」；`release.yml:52/96` `CSC_IDENTITY_AUTO_DISCOVERY:false`、`--config.mac.notarize=false` | 发布依赖单点人工；证书无轮换；无法审计签名链路 |
| 3 | **无回滚 / 灰度机制** | 无任何金丝雀/版本回滚设计，无 update 后端 | 一旦发坏包，用户只能手动重装 |

### 🟠 P1 —— 高风险，应尽快处理

| # | 风险 | 证据 | 建议 |
| --- | --- | --- | --- |
| 4 | **action 未锁 SHA** | `checkout@v6` / `setup-node@v6` / `cache@v6` / `upload-artifact@v4` 全是浮动 tag | 供应链投毒面，锁到具体 commit SHA |
| 5 | **release 安装非 immutable** | `release.yml:44` `corepack yarn install`（无 `--immutable`）；CI 用 `yarn install --immutable` | 发布锁文件可漂移，与 CI 验证不一致 |
| 6 | **release 依赖 fork 特殊分支** | `release.yml:32-37` checkout `ref: plugins-source` 到 `omni-source/`；真源在 sibling `dsh-plugin/product/omnimux-dsh` | 快照分支与真源漂移，缺一致性校验 |
| 7 | **根 `dist/` 未 gitignore** | `.gitignore` 只忽略 `dsh-plugin-desktop/dist/`；`git status` 显示 `?? dist/`（含 `.app-bak`、`release-download`） | 构建/下载产物污染工作区，有误提交风险 |
| 8 | **版本号硬编码、无 tag 驱动** | `version: 2.0.2` 同时出现在根与 `dsh-plugin-desktop/package.json`；release 不校验 tag 与 version 一致 | 易发错版本号 |

### 🟡 P2 —— 中风险，纳入迭代

| # | 风险 | 证据 | 建议 |
| --- | --- | --- | --- |
| 9 | **遥测禁用但无替代可观测** | `ci.yml:18` `DSH_TELEMETRY_DISABLED:'1'`；宿主缺启动失败诊断能力 | 补 OmniMux 自有崩溃上报 + 启动失败诊断 |
| 10 | **Electron 二进制无缓存** | 各 job 无 electron 下载缓存 | CI 变慢，加 `~/.cache/electron` 缓存 |
| 11 | **concurrency 对主分支 push 也取消** | `ci.yml:13-15` `cancel-in-progress:true` 且 push 到 `master/omnimux` 触发 | 关键构建可能被后续 push 取消 |
| 12 | **Node 版本矩阵散** | CI `22.23.2` / engines `^22.19||>=24` / 本地 sync 脚本 `22.22.2` | 「本地绿 CI 红」隐患，统一到单一矩阵 |
| 13 | **产物仅 14 天 artifact** | `upload-artifact@v4` `retention-days:14`，无 GitHub Release、无更新服务器上传 | 分发靠人工，无法追溯 |

---

## 三、改进方案

### 阶段一：止血（本迭代，不改架构）

**1. 仓库卫生 —— 忽略根 `dist/`**

`.gitignore` 追加：

```gitignore
# 构建与本地分发产物（勿提交）
/dist/
```

并清理现有未跟踪的 `dist/` 内容（保留本地文件，仅从 git 视角忽略）。

**2. release 安装固化**

`release.yml` 两处 `Install dependencies`（`build-mac`、`build-win`）：

```diff
- run: corepack yarn install
+ run: corepack yarn install --immutable
```

同时把当前未提交的 `package.json` / `yarn.lock` 改动先提交，消除漂移隐患。

**3. action 锁 SHA（示例）**

```diff
- uses: actions/checkout@v6
+ uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v6.0.0
```

> 逐个 pin 当前 v6/v4 对应的最新 SHA，并在 `.github/dependabot.yml` 里开 action 版本更新提醒。

**4. 版本一致性门禁（CI 里加一步）**

在 `check` job 加校验：`git tag` 最新稳定版 == `package.json#version` == `dsh-plugin-desktop/package.json#version`，不一致直接 fail。可在 `scripts/` 加一个 `verify-version.mjs` 复用 `classify-ci-changes.mjs` 的模式。

### 阶段二：补签名与更新后端（需老板拍板）

**5. macOS 签名/公证进 CI（P0#2 的解法）**

- 用 `APPLE_CERTIFICATE`（base64 p12）+ `APPLE_CERTIFICATE_PASSWORD` + `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` 三个 GitHub Secrets。
- 公证用 `notarytool`（替代已弃用的 `altool`），密钥走 `APPLE_API_KEY`（App Store Connect API Key）。
- 证书定期轮换，每环境独立凭据，签名日志留痕。

**6. 更新后端选型（P0#1 的解法，最重的架构决策）**

更新端点从占位改为真实服务。三选一：

| 方案 | 说明 | 成本 | 回滚/灰度 |
| --- | --- | --- | --- |
| A. 自建更新服务 | 复用 `update-*.ts` 现有契约，自部署 `updates.omnimux.*` | 中 | 可控灰度、可按版本回滚 |
| B. electron-updater + GitHub Releases | 走 GitHub Release 分发，`feedURL` 指向 release | 低 | 依赖 GitHub，回滚=撤 release |
| C. 第三方更新服务 | 如 Hazel / Nuts 等 | 低-中 | 视服务而定 |

> 建议：**先 B 后 A**。先用 GitHub Releases 把「有更新可用」这条路跑通，同时保留 `update-*.ts` 契约，后续平滑切自建。

**7. 回滚与灰度（P0#3 的解法）**

- 至少保证每个正式发布对应一个不可变 tag + GitHub Release（build once, promote）。
- 灰度：更新服务按 `version` 返回「最新稳定 / 最新可用」，支持把某个坏版本标记为不可用，实现服务端降级。
- runbook：`docs/contracts/release-runbook.md`，明确「发坏了怎么撤」。

### 阶段三：可观测与加固（后续迭代）

**8. 崩溃/启动失败诊断**

- 宿主补启动失败诊断能力（记忆里已知短板）：启动失败落盘 `$DSH_HOME` 诊断包，配合 `diagnostic-export.ts` 已有的 zip 能力。
- 接入崩溃上报（Electron `crashReporter` + 自有端点），禁遥测不等于不可观测。

**9. 可观测性（四大黄金信号）**

- 延迟/流量/错误/饱和度：更新服务 + 网关（`OMNIMUX_BASE_URL`）加指标与告警，面向症状告警，每个告警可操作。

**10. CI 提速与并发收敛**

- 缓存 `~/.cache/electron` 与 `electron-builder` 缓存。
- `concurrency` 对 `push` 到主分支改为不取消（或仅 PR 取消），保证关键构建跑完。

---

## 四、待老板拍板项

1. **更新后端选型**：A（自建）/ B（GitHub Releases 先跑通）/ C（第三方）——建议先 B 后 A。
2. **签名是否进 CI**：需老板提供 Apple Developer 凭据，并确认证书托管方式（GitHub Secrets vs 独立密钥管理）。
3. **`plugins-source` 分支契约**：release 的插件快照来源是否要改为直接从 sibling `dsh-plugin` 真源取，还是维持快照分支 + 加同步校验脚本。
4. **Node 版本统一到哪个**：建议全链路统一 `22.23.x`。

---

## 五、附录：文件清单

| 文件 | 状态 |
| --- | --- |
| `.github/workflows/ci.yml` | 分层 gate 良好，需锁 SHA、加版本门禁 |
| `.github/workflows/release.yml` | 需 immutable、签名/公证、更新上传 |
| `dsh-plugin-desktop/package.json` | electron-builder 配置齐全，version 硬编码 |
| `src/update-checker.ts` / `update-download.ts` | 契约完整，端点占位 |
| `.gitignore` | 缺根 `dist/` |
| `scripts/omnimux.mjs` / `sync-upstream.sh` | 运维入口健康 |
