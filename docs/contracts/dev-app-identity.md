---
title: "dev-app-identity — OmniMux Dev / Prod 桌面壳物理隔离与端口标准"
id: "contract-dev-app-identity"
type: "contract"
status: "living"
authority: "L1"
date: "2026-09-02"
authors: ["Qi (Delivery Director)", "Gao (Architect)", "Kou (Engineer)"]
subsystem: "dsh-plugin-desktop"
---

# dev-app-identity — OmniMux Dev / Prod 桌面壳物理隔离与端口标准

> 解决问题：安装版 `OmniMux Dev.app` 曾因 Info.plist 内写死 `LSEnvironment.OMNIMUX_CHANNEL=prod` 导致加载正式版 `~/.omnimux`；且 Dev 与 Prod 曾共享 44120 端口导致无法双开。
> 关联 Issue：`omnimux-ai/omnimux-dsh#350`。

## 物理隔离规范

| 维度 | OmniMux 正式版（Prod） | OmniMux 开发版（Dev） |
|---|---|---|
| **应用包名** | `/Applications/OmniMux.app` | `/Applications/OmniMux Dev.app` |
| **可执行路径** | `.../OmniMux.app/Contents/MacOS/OmniMux` | `.../OmniMux Dev.app/Contents/MacOS/OmniMux` |
| **Electron UserData** | `~/Library/Application Support/OmniMux` | `~/Library/Application Support/OmniMux-Dev` |
| **Harness Profile 根** | `~/.omnimux` | `~/.omnimux-dev` |
| **环境变量标识** | `OMNIMUX_CHANNEL=prod` | `OMNIMUX_CHANNEL=dev`, `OMNIMUX_DEV=1` |
| **默认 WebCarrier 端口** | **44120** (`DESKTOP_PROD_WEB_PORT`) | **45120** (`DESKTOP_DEV_WEB_PORT`) |
| **物化目标** | `yarn omnimux:sync --prod` | `yarn omnimux:sync`（默认） |

## 识别防线优先级（Dev 永远优先）

1. **显式环境标识**：`OMNIMUX_CHANNEL === 'dev'` 或 `OMNIMUX_DEV === '1'`
2. **包路径识别**：`process.execPath.includes('OmniMux Dev')`（即使环境被错误写成 prod，可执行路径仍必定判定为 Dev）
3. **应用名称与 UserData 判定**：`appName.includes('Dev')` 或 `userData.includes('OmniMux-Dev')`
4. **兜底回退**：仅当以上全部不满足且命中 `OmniMux` 时，判定为 Prod（`~/.omnimux` / 44120）。

## 开发版打包

在仓库根设置 `OMNIMUX_PLUGINS_DIR` 为插件源码仓的 `plugins/` 绝对路径，然后运行 `corepack yarn package:dev`。该入口依次构建、以 `--channel development` 暂存 preset、复用 `package-dir.mjs` 打包，并校验包内 channel 后写入 Dev 身份。产物位于 `dsh-plugin-desktop/dist/mac-arm64/OmniMux.app`（Intel 为 `dist/mac/OmniMux.app`）；安装时使用上表的 `OmniMux Dev.app` 路径。此命令不安装或启动 App。

`package:dir` 和正式发行入口仍默认使用 production preset。不得把正式版产物改名或只修改 Info.plist 后用作 Dev；`stamp-dev-app.mjs` 在首次写入前拒绝 production、缺失或不可读的包内 channel。重新构建请使用 `package:dev`，避免再次执行默认 production staging。

Dev 的身份与包内 `preset/plugins/omnimux/src/release-channel.json` 必须同时正确。`Contents/Resources/build-info.json` 根据包内 marker 将开发版构建标记为 `package-dev`。development preset 启动保留已有的有效 managed Profile 与更新的同步快照；production preset 仍执行正式发行的 Alpha 排除和 Hub 策略更新。Dev 验收应记录包内 channel、同步后的 Hub 内容，并确认连续重启没有覆盖 `.materialize-snapshots/plugins/omnimux` 或已安装 Hub。
