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
