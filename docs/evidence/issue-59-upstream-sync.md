# #59 稳定线合并记录

冻结上游：`91b12fcd60fe85a39c6aa21dcd3056d89d0b69a4`。最终 fork base：`2b72c8b13d0a73954286d09dccf14a359d31754f`。

## 冲突决策

共 49 个路径：A 26、B 19、C 4、D 0。C 级融合由用户在本任务的实施计划中明确批准。

| 路径 | 分级 | 解法 |
| --- | --- | --- |
| `PRIVACY.i18n.yaml` | B | 保留 OmniMux 文档与现有市场来源；校验双语 hash。 |
| `README.i18n.yaml` | B | 保留 OmniMux 文档与现有市场来源；校验双语 hash。 |
| `README.md` | B | 保留 OmniMux 文档与现有市场来源；校验双语 hash。 |
| `_deprecated/patches/runtime-0.1.2-alpha.1/dsh-subprocess-local@0.1.2-alpha.1.patch` | A | 保留有效 rc.1/归档补丁；去除旧 rc.2 路径，app-builder 接入 traversal 修复。 |
| `_deprecated/patches/runtime-0.1.2-alpha.1/dsh-web-app@0.1.2-alpha.1.patch` | A | 保留有效 rc.1/归档补丁；去除旧 rc.2 路径，app-builder 接入 traversal 修复。 |
| `deepseek-harness` | B | 固定 a66e470204 / 0.1.2-rc.1；不编辑子模块。 |
| `dsh-community-market/package.json` | B | 保留单稳定线；升级桌面至 2.0.5，排除 Beta workspace/runtime。 |
| `dsh-community-market/src/host/routes.ts` | B | 保留现有 Marketplace adapter 全部路由与网络边界。 |
| `dsh-community-market/tests/contracts.spec.ts` | B | 保留单稳定线；升级桌面至 2.0.5，排除 Beta workspace/runtime。 |
| `dsh-plugin-desktop/README.i18n.yaml` | B | 保留 OmniMux 文档与现有市场来源；校验双语 hash。 |
| `dsh-plugin-desktop/README.md` | B | 保留 OmniMux 文档与现有市场来源；校验双语 hash。 |
| `dsh-plugin-desktop/README.zh.md` | B | 保留 OmniMux 文档与现有市场来源；校验双语 hash。 |
| `dsh-plugin-desktop/THIRD_PARTY_NOTICES.md` | A | 按当前已安装依赖重新生成 notices。 |
| `dsh-plugin-desktop/package.json` | B | 保留品牌、preset、物理路径和 Dev scripts；接入 Fuse 与兼容依赖。 |
| `dsh-plugin-desktop/scripts/package-dir.mjs` | B | 接入无凭证 unsigned build；保留构建来源记录与 development staging。 |
| `dsh-plugin-desktop/scripts/verify-loader-boot.mjs` | A | 融合上游行为与现有回归断言；保留 Connection trust 拒绝边界。 |
| `dsh-plugin-desktop/scripts/verify-packaged-runtime.ts` | B | 保留物理展开 CLI/Worker 合同；接入最终 Electron 子进程 smoke。 |
| `dsh-plugin-desktop/src/client/AdvancedFrame.tsx` | A | 融合布局归属规则；保留窄屏迟滞、拖拽、详情 SessionProvider 和标题栏定制。 |
| `dsh-plugin-desktop/src/client/advanced-shell.ts` | A | 融合布局归属规则；保留窄屏迟滞、拖拽、详情 SessionProvider 和标题栏定制。 |
| `dsh-plugin-desktop/src/client/extended-shell.ts` | A | 融合布局归属规则；保留窄屏迟滞、拖拽、详情 SessionProvider 和标题栏定制。 |
| `dsh-plugin-desktop/src/client/index.ts` | A | 融合布局归属规则；保留窄屏迟滞、拖拽、详情 SessionProvider 和标题栏定制。 |
| `dsh-plugin-desktop/src/client/layout-service.ts` | A | 融合布局归属规则；保留窄屏迟滞、拖拽、详情 SessionProvider 和标题栏定制。 |
| `dsh-plugin-desktop/src/desktop-runtime-environment.ts` | A | 采用上游不可变命令代、POSIX 子进程身份与 Windows RunAsNode；规范测试中的 realpath。 |
| `dsh-plugin-desktop/src/main.ts` | C | 融合上游实现；保留 OmniMux seed、默认 Profile、Dev/Prod 隔离和更新端点。 |
| `dsh-plugin-desktop/src/profile-manager.ts` | C | 融合上游实现；保留 OmniMux seed、默认 Profile、Dev/Prod 隔离和更新端点。 |
| `dsh-plugin-desktop/src/profile.ts` | A | 采用安装/Profile 归属改进；保留物理 anchor 和 Windows 原生目录选择器。 |
| `dsh-plugin-desktop/src/update-checker.ts` | C | 融合上游实现；保留 OmniMux seed、默认 Profile、Dev/Prod 隔离和更新端点。 |
| `dsh-plugin-desktop/src/update-download.ts` | C | 融合上游实现；保留 OmniMux seed、默认 Profile、Dev/Prod 隔离和更新端点。 |
| `dsh-plugin-desktop/src/updates.ts` | A | 融合上游行为与现有回归断言；保留 Connection trust 拒绝边界。 |
| `dsh-plugin-desktop/tests/client-environment.spec.ts` | A | 融合布局归属规则；保留窄屏迟滞、拖拽、详情 SessionProvider 和标题栏定制。 |
| `dsh-plugin-desktop/tests/client-layout-service.spec.ts` | A | 融合布局归属规则；保留窄屏迟滞、拖拽、详情 SessionProvider 和标题栏定制。 |
| `dsh-plugin-desktop/tests/desktop-runtime-environment.spec.ts` | A | 采用上游不可变命令代、POSIX 子进程身份与 Windows RunAsNode；规范测试中的 realpath。 |
| `dsh-plugin-desktop/tests/electron-runtime.spec.ts` | A | 融合上游行为与现有回归断言；保留 Connection trust 拒绝边界。 |
| `dsh-plugin-desktop/tests/package.spec.ts` | B | 保留品牌/端口/物理布局断言，更新版本和启动流程断言。 |
| `dsh-plugin-desktop/tests/plugin.spec.ts` | B | 保留品牌/端口/物理布局断言，更新版本和启动流程断言。 |
| `dsh-plugin-desktop/tests/profile.spec.ts` | A | 采用安装/Profile 归属改进；保留物理 anchor 和 Windows 原生目录选择器。 |
| `dsh-plugin-desktop/tests/setup-wizard-state.spec.ts` | A | 融合上游行为与现有回归断言；保留 Connection trust 拒绝边界。 |
| `dsh-plugin-desktop/tests/updates.spec.ts` | A | 融合上游行为与现有回归断言；保留 Connection trust 拒绝边界。 |
| `dsh-plugin-desktop/tests/verify-packaged-runtime.spec.ts` | B | 保留物理展开 CLI/Worker 合同；接入最终 Electron 子进程 smoke。 |
| `dsh-plugin-desktop/tsconfig.tests.client.json` | A | 融合上游行为与现有回归断言；保留 Connection trust 拒绝边界。 |
| `package.json` | B | 保留单稳定线；升级桌面至 2.0.5，排除 Beta workspace/runtime。 |
| `patches/app-builder-lib@26.15.7.patch` | A | 保留有效 rc.1/归档补丁；去除旧 rc.2 路径，app-builder 接入 traversal 修复。 |
| `patches/dsh-subprocess-local@0.1.1-rc.2.patch` | A | 保留有效 rc.1/归档补丁；去除旧 rc.2 路径，app-builder 接入 traversal 修复。 |
| `patches/dsh-subprocess-local@0.1.2-rc.1.patch` | A | 保留有效 rc.1/归档补丁；去除旧 rc.2 路径，app-builder 接入 traversal 修复。 |
| `patches/dsh-web-app@0.1.1-rc.2.patch` | A | 保留有效 rc.1/归档补丁；去除旧 rc.2 路径，app-builder 接入 traversal 修复。 |
| `patches/dsh-web-app@0.1.2-rc.1.patch` | A | 保留有效 rc.1/归档补丁；去除旧 rc.2 路径，app-builder 接入 traversal 修复。 |
| `scripts/sync-vendored-runtime.mjs` | B | 保留单稳定线；升级桌面至 2.0.5，排除 Beta workspace/runtime。 |
| `upstream.json` | B | 保留单稳定线；升级桌面至 2.0.5，排除 Beta workspace/runtime。 |
| `yarn.lock` | A | 根据单稳定线依赖及有效补丁重建锁文件。 |

## 当前验证

- `corepack yarn check` 已通过：桌面 1,236 passed / 8 skipped；市场 268 passed；运行时闭包、CLI、Loader、Profile、许可证及操作可靠性校验通过。
- 许可证扫描：619 个生产包，2 个 LGPL notice 项；已重新生成 notices。
- `corepack yarn install --immutable` 已通过。
- PR #71 已建立；候选代码 `7ca3a7331b`。远端 macOS/Windows CI 与交互验收仍待完成；本机共享 Dev 尚未替换，本文件不声明交付完成。

## 稳定线差异

- 排除 605 个 Beta 专属 workspace、vendor、patch 与 variant 检查文件；保持 rc.1 gitlink 和单通道 CI。
- `app.asar.unpacked` 保留完整物理 CLI/Worker/preset 依赖树，不采用上游 1,500 文件 / 128 MiB 限额。最终 Fuse hook 仍运行真实 Electron 子进程检查。
- 新版 dshmarket 原生的 `exactNpmArgs` / `runExternalMarketPluginInstall` 已覆盖旧精确安装补丁；`readProfileManifestSnapshot` / `restoreProfileManifest` 原生回滚 dependencies 与完整 bundles 字段。保留新版本有效自更新补丁。
- Windows NSIS A/B 反向 patch 使用包相对 include 路径，移除多余的 `--directory=.`。macOS 与 CI 的 Git 对 `./` 归一化行为不同，原组合会静默跳过目标；使用 `-C` 与 `GIT_CEILING_DIRECTORIES` 确定隔离目录。

- 移除仅服务跨通道提示、已无调用方的独立 Profile selector 与相关文案；Profile 创建/切换仍由现有恢复与设置流程提供。

## 候选包与隔离运行验收（2026-09-07）

- macOS arm64 development preset 成功暂存 286 个包；unsigned package-dir 和 Dev identity stamp 成功。候选包 build-info：Desktop 2.0.5、DSH 0.1.2-rc.1、上游 91b12fcd60、候选 7ca3a7331b。
- 最终 Fuse hook 实际验证 RunAsNode、ASAR integrity、OnlyLoadAppFromAsar，并执行打包 Electron 的 DSH CLI、pnpm CLI、Profile/CJS/ripgrep、Desktop CLI composition 和 Loader boot 五项检查，全部通过。
- 首轮 macOS 目录构建暴露空目标表：electron-builder 26.15.7 的 MacPackager 对 dir 不调用 mapper。已支持此结果，相关 21 项回归和 typecheck 通过。CI 的两个尾部空行同时清理，changes gate 已通过。
- 隔离任务 `issue59-upstream-qa` 使用独立 home / Electron userData；正常启动、Safe Mode、恢复正常分别报告 renderer healthy（24.282 s / 1.619 s / 3.191 s）。正常运行 ID `d0c041cc-937f-4243-8c20-a0f64ba2408e`，Safe Mode `b6e74eb0-3cfd-443c-bb9b-96f727018c27`，恢复正常 `4c19d6f4-bca3-4cd5-b281-0e6ea563bc28`。
- Safe Mode 只有 dsh-base / dsh-web-app，没有 OmniMux preset。正常 settings、Profile manifest 和 Hub snapshot manifest 哈希未变；退出后 safe-mode 目录被删除。
- Codex 内置浏览器打开本地 45959 返回 `net::ERR_BLOCKED_BY_CLIENT`。仅健康信号与运行时检查不能替代交互验收；尚无浏览器验收通过证据。

- 后续 Linux CI 发现 NSIS A/B 路径匹配差异，已去掉 `--directory=.` 并恢复规范 include 路径；本地真实 reverse-apply 回归通过（17 passed / 1 skipped），等待远端复验。

## 交互验收与最终基线

- 先前浏览器错误已解决，无需豁免：高级模式不开放普通浏览器；兼容模式还需要使用桌面设置展示的官方认证 URL。认证后 Codex IAB 可正常进入隔离 45959 页面，裸 URL 的拒绝不能作为工具故障的证据。
- IAB 完成通用设置/插件配置页切换、创建本地项目 `QA-59-稳定线验收`、自动进入新会话、输入未发送草稿、手动侧栏收放，以及 1440→760→1440 视口切换；草稿和项目上下文保留。没有发送模型请求。
- 原生 Electron 通过桌面设置切换增强模式并实际重启；2.0.5 advanced 页面恢复同一项目和会话，详情面板、右侧栏及创作画布重新打开并加载完成。
- 最终获取 fork/omnimux 时发现新增 `947a5b2c579eb3ee68794ebd47bb86a772d1a242`（sidebar 默认设置）。已以 merge commit 纳入，保持主线修复；26 项 preset 回归通过，最终 head 的平台 CI 与候选包重新验证后才能交付。
- 交互验收不覆盖原生 OS 文件选择器完整流程或真实模型生成；这些不作为本次已验证结论。现有 native-picker 回归和源码行为保留。
