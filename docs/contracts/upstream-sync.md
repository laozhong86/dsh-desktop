# upstream-sync — 与 DSH 官方上游的同步合并合同

> 目的：fork（laozhong86/omnimux-desktop-fork）与上游（anywhere-labs/deepseek-harness-desktop）保持周级同步，同时保住 OmniMux 的品牌、seed 机制与产品特性。本合同是**仓库内的持久制度**，不依赖任何 agent 的会话记忆——任何 agent 执行同步前 MUST 读本合同并遵守分级决策。
> 依据：2026-08-21 两次实测（191 提交大 merge + 11 提交日常 merge，冲突全部集中在预期位置）。

## 触发纪律

| 时机 | 动作 |
|------|------|
| 每周一例行 | 执行完整 SOP（上游月约 936 提交，拖过两周即合并地狱） |
| 上游发 release tag | 24 小时内跟进 |
| 任意会话发现落后 ≥ 20 提交 | 提醒老板安排同步 |

## 合并约束分级

### 🟢 A 级·直接合并（agent 自主执行，无需确认）

- merge 零冲突（git 自动完成）
- 冲突仅在：yarn.lock、上游自身源码演进、上游测试的非品牌部分、上游 docs/CI/注释

### 🟡 B 级·按模板解冲突（agent 自主解决，决策日志留痕）

| 冲突对象 | 固定解法 |
|----------|----------|
| package.json 品牌字段 | `version` 取上游；`description`/`build.appId`/`build.productName`/`win.artifactName`/`nsis.shortcutName` 保 OmniMux 值 |
| 测试品牌断言 | 品牌类断言保我们的值（appId=`ai.omnimux.desktop`、bin=`omnimux`、productName=`OmniMux`、icon hash、preset/** glob）；结构性断言跟随上游 |
| AGENTS.md | 保双方（我们的段落在尾部追加） |
| build 脚本链 / tsdown entry | 保我们的（含 `preset-profile` entry 与 `generate-*-omnimux.mjs` 调用） |

### 🟠 C 级·停等用户确认（agent 必须停下问老板，禁止自作主张）

- **6 个薄改点发生结构性冲突**（上游重构了这些机制本身）：
  - `src/main.ts` 启动流程（我们的 seed 调用点 / PRODUCT_NAME / appUserModelId 被上游重排）
  - `src/profile-manager.ts` DEFAULT_PROFILE_NAME 机制
  - `src/update-download.ts` / `src/update-checker.ts` 端点机制
  - `src/bin.ts` userData 路径约定
- 上游**新增桌面壳强制注入插件**（IMMUTABLE_BUNDLES 扩容——先例：community-market，我们用 profile patch 禁用）
- Electron major 版本 / electron-builder / node-gyp 工具链大版本变化
- 任意依赖 major 升级
- merge 后 typecheck/test 失败且**非机械原因**（非品牌断言、非依赖未装）

### 🔴 D 级·直接拒绝（不做，立即报告老板）

- 上游 license 变更（不再是 MIT）
- 上游闭源化 / 强制遥测
- 必须拆除 seed 机制（preset-profile 结构）才能完成合并的上游变更
- 任何要求把 OmniMux 专有改动回流上游的合并条件

## 标准 SOP（每次同步必走）

**首选执行方式：脚本**（强制分级 + 自动解 B 级 + 生成日志骨架）：

```sh
cd /Users/x/Desktop/Project/omnimux-desktop-fork
bash scripts/sync-upstream.sh          # 退出码 0=完成待收尾 / 2=C 级停等 / 3=验证不绿
# 收尾：补全日志 → git add 日志 && commit → push → CI 确认
```

脚本实现了本合同的分级：D 级（LICENSE 变更）直接拒绝退出；B 级（品牌字段）按模板自动解并留痕；C 级（结构性冲突）自动 `merge --abort` 回滚并停等；A 级自动合并。核心解析器有单测（`scripts/sync-upstream.test.mjs`，`node --test scripts/sync-upstream.test.mjs`）。

**手动执行（脚本不可用时的人工等价流程）**：

```sh
cd /Users/x/Desktop/Project/omnimux-desktop-fork
git fetch origin
git log --oneline omnimux..origin/master   # 预检：提交类型分布，识别 C 级风险
git merge origin/master
# → 冲突逐个按分级处理；C 级停等；D 级拒绝
corepack yarn install                       # 依赖跟进（rc 升级必须）
# 干净环境 build（绕 workbuddy safe-delete shim）：
env -u NODE_OPTIONS PATH="/Users/x/.workbuddy/binaries/node/versions/22.22.2/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  sh -c 'corepack yarn workspace dsh-plugin-desktop build'
corepack yarn workspace dsh-plugin-desktop typecheck
corepack yarn workspace dsh-plugin-desktop test   # 本地 safe-delete 干扰的用例以 CI 为准
# 追加决策日志（upstream-sync-log.md）→ commit → push → CI 全绿才算完成
```

## 决策日志

- 文件：`docs/contracts/upstream-sync-log.md`（追加式，新条目置顶）
- 每条必含：日期、上游范围（`SHA..SHA`，N 提交）、冲突清单与逐项解法、分级记录（A/B/C/D 各几项、C 级谁确认的）、验证证据（typecheck/test/CI 结果）
- **无日志的 merge 不算完成**——push 前必须先写日志

## 三层记忆保障（防止换 agent 遗忘）

1. 本合同（fork 仓库 `docs/contracts/upstream-sync.md`）——规则的唯一事实源
2. AGENTS.md 指针——所有 agent 进仓库的第一入口
3. 本机 agent 记忆（deepseek-harness 仓库 `.workbuddy/memory/MEMORY.md`）——跨仓库提示
