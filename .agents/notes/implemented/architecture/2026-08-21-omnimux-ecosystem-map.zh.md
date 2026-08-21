# Agent Note：OmniMux 桌面端生态地图

Status: implemented

[English](2026-08-21-omnimux-ecosystem-map.md) | 中文

## 本文档是什么

本文档是"本仓库（OmniMux 桌面端，`omnimux-desktop-fork`）在更大 OmniMux 项目生态中的位置"的权威地图。存在的意义是：任何在本工作区工作的 agent 都能直接发现兄弟仓库、各自的所有权边界、以及它们之间的数据流向，而无需从头推导拓扑。在动插件打包、上游 pin、面向网关的行为，或任何跨越仓库边界的事情之前，先读本文档。

## 生态一览

| 层 | 仓库 | 位置 | 角色 |
| --- | --- | --- | --- |
| 官方核心 | `deepseek-ai/deepseek-harness` | `~/Desktop/Project/Github/deepseek-harness`（干净克隆，跟踪上游，当前 `0.1.0-rc.8`） | 官方 DeepSeek Harness 源码，用于跟踪与对比 |
| 官方桌面 | `anywhere-labs/deepseek-harness-desktop` | 本仓库的 `origin` 远程 | 本 fork 所基于的上游桌面项目 |
| 桌面 fork | `laozhong86/omnimux-desktop-fork` | 本仓库（当前工作区，v2.0.1） | OmniMux 品牌化的桌面产品 |
| 插件开发 | 本地 `dsh-plugin` 工作区 | `~/Desktop/Project/dsh-plugin` | OmniMux DSH 插件的开发地，开发完成后同步进桌面 preset |
| 网关 | `laozhong86/OmniMux`（`QuantumNous/new-api` 的 fork） | `~/Desktop/Project/OmniMux` | Go 网关（Gin + GORM），在 VPS 上蓝绿部署跑生产（`omnimux.ai`） |

## 仓库解剖

本仓库拥有三个工作区成员 + 一个固定上游：

- `deepseek-harness/` — 固定版本的 Git 子模块，锁定 commit `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca`（源码 `0.1.0-rc.7`），记录在 [`upstream.json`](../../../../upstream.json)。视为只读；上游更新应是一个只改动 gitlink 与元数据的独立提交。
- `dsh-plugin-desktop/` — 桌面产品本体：Cordis Host 与 Client 两面、Electron 启动、打包与发布测试。其 `preset/plugins/` 目录随产品附带 OmniMux 插件家族（`omnimux`、`omnimux-accounts`、`omnimux-assets`、`omnimux-gallery`、`omnimux-workflow`，以及 `dsh-better-sidebar`）。
- `dsh-community-fabric/` — 社区互操作 RFC 脚手架。纯文档；不得声明可加载的 DSH 或包入口。
- `dsh-community-market/` — 社区插件市场壳。已完成并内置到桌面端"设置-插件"（Plugin market 标签页）。

## 数据流

```
OmniMux Go 网关（VPS，业务逻辑：账号、计费、视频）
   ^ 经 OMNIMUX_BASE_URL 发起 API 调用
OmniMux 桌面端（本仓库：固定 rc.7 运行时 + 预置 omnimux 插件 + 内置市场）
   ^ 插件同步（当前 0.1.1）
dsh-plugin/product/omnimux-dsh（插件 monorepo：omnimux 中枢 + dsh-drama 等垂直包）
```

- 桌面 omnimux 插件通过 `OMNIMUX_BASE_URL` 与网关通信。只有云端网关封装了付费业务逻辑；live 路径需要官方密钥并上报 `needs-omnimux`。
- 插件的事实来源是 `dsh-plugin/product/omnimux-dsh`（pnpm monorepo，其明确原则是 consume-not-fork——只消费官方 Harness 插件生态，绝不 fork）。`omnimux` 插件（0.1.1）与桌面 preset 副本（0.1.1）一致。`dsh-drama`（短剧垂直方案）与 `omnimux-market` 存在于插件仓库，但尚未进入桌面 preset，因此未随打包版桌面发布。

## 版本与新鲜度事实

- 子模块 pin 在 `0.1.0-rc.7`；官方上游已推进到 `0.1.0-rc.8`（可见于 `~/Desktop/Project/Github/deepseek-harness` 的干净克隆）。上游 pin 更新是一项待办的独立任务，必须与桌面行为改动分开提交。
- 网关仓库里的 `OmniMux/electron/` 是旧一代桌面壳（包装 Go 二进制），与本 DSH 桌面端无关，勿混淆。

## 给 agent 的指引

- 要改桌面随附的 OmniMux 内容：在 `dsh-plugin/product/omnimux-dsh` 改插件，然后把对应版本同步进 `dsh-plugin-desktop/preset/plugins/`。
- 要对标或采纳更新的上游行为：先查干净克隆 `~/Desktop/Project/Github/deepseek-harness`，再提出一个独立的子模块 pin 更新。
- 要动面向网关的行为（计费、视频生成、账号流程）：契约在网关仓库与 `dsh-plugin` 文档中（`docs/contracts/hub.md`、`docs/decisions/2026-08-16-harness-consume-not-fork.md`）。
- 本地图记录的是本地绝对路径；换机器时请按仓库身份定位兄弟仓库，而非路径。

## 备选方案

**让每个仓库只在各自的 AGENTS.md 里描述自身拓扑。** 这样每个仓库只描述自己内部，没有任何单一位置能解释桌面、插件与网关三者如何关联，agent 每次都要重新推导。专门的生态笔记提供单一、可发现、被本仓库 AGENTS.md 引用的权威入口。
