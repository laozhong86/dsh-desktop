# Decision: OmniMux 预安装统一方案（插件套件 + Skill/Agent 基础设施）

Date: 2026-09-13
Status: 已实施（P0–P3 全部落地）
Scope: 发行侧 `dsh-plugin-desktop/`（producer + settler + verifier）；清单源 `dsh-plugin/product/omnimux-dsh/`

## 问题（为什么改）

今天"一个安装包里装了什么、怎么装进用户机器"由三条半独立的路拼出来：

1. **全新安装**：`preset/` 全量 seed 进 profile，完整。✓
2. **覆盖安装 / 升级**：profile 已存在时 `seedOmnimuxProfile` 只做一件事——剔除 alpha 包。
   `docs/contracts/profile-materialization.md` 明写：已有 profile "does not refresh packages…
   even when the packaged seed has the same or a newer version"。
   **结果：新安装包里的新插件、新版本永远进不去。** 本机 `dsh-better-sidebar` 卡在 0.18.0
   就是这个原因，不是同步漏了。
3. **开发态**：`omnimux:dev` / `omnimux:sync` 直接物化到 `~/.omnimux-dev`，走
   `rebuild-managed-profile.ts` + `materializeProfile`，与打包用的 `stage-preset-profile.ts`
   不是同一条代码路径。

由此三个具体伤口（2026-09-13 复核后的准确版本）：

- **发行记录不可验证。** `PRODUCT_PLUGINS`（stage 脚本内）就是声明清单（12 项），内测门禁同样是数据
  驱动（`release-channel.json` + `plugin-lifecycle.json`）：生产通道剔掉 4 个 alpha（`omnimux-accounts`
  / `-publish` / `-analytics` / `-forms`）后，实装正好是 preset 里的 8 个 `omnimux-*` —— 声明与实际是对
  得上的。缺的不是清单，而是**产物侧的发行记录与对等闸**：没有任何机制能回答"这个安装包最终装了什么、
  和开发环境是否一致"。
- **暂存产物不是自包含的。** 暂存包原样保留构建期的相对路径：`devDependencies` 里的 `file:` 边
  （如 `omnimux-forms` → `file:../../packages/form-contract`、`file:../../../../personal/dsh-ui-kit`），
  以及曾经的 `workspace:*` 协议（该实例已由产品仓 `810d61d36` / #1410 修掉）。实测确认：`pnpm install
  --prod` 会跳过 `devDependencies`，所以今天不炸；但 `dependencies` 里一旦出现 `workspace:` 或越界的
  `file:`，就会在用户机器上以 `ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL` 之类的中止收场，而**没有
  任何门禁拦住它** —— 这正是"开发看着正常、发布另一种结果"的形态。
- **Skill / Agent 没有产品级通道。** Agent preset 可以自带 `skills/`（`cordis`、`tiktok-agent`
  就是这样），但"全局技能"只能靠用户自己装进 `<harness-home>/skills`，不在发行范围内。

## 决策（目标形态）

"装什么 / 怎么装 / 装完怎么验"收敛成三件东西。

### ① 一份清单 —— `preset/distribution.json`

构建时由产品插件树 + agent preset 树 + skill 源生成，随包签名发布。

```json
{
  "schema": 1,
  "channel": "production",
  "items": [
    { "kind": "plugin", "id": "omnimux",       "tier": "core",    "version": "2.1.0", "digest": "sha256-…" },
    { "kind": "plugin", "id": "omnimux-forms", "tier": "product", "version": "0.1.0", "digest": "sha256-…" },
    { "kind": "agent",  "id": "standard",      "tier": "product", "digest": "sha256-…" },
    { "kind": "skill",  "id": "omnimux-plugin-guide", "tier": "product", "digest": "sha256-…" },
    { "kind": "plugin", "id": "omnimux-beta-x", "tier": "beta", "channel": "development" }
  ]
}
```

- 唯一的"装什么"真源。加 / 减一项 = 改一处，stage 自动生成，diff 可 review。
- `kind` 把 plugin / skill / agent 收进同一张表 —— "skill 预装"不再是特例。
- `tier`：`core`（Host 必需，不可关）｜`product`（产品套件，可裁剪）｜`beta`（内测）。
- **内测禁安装 = 清单里 `tier: beta` 的条目在 `channel: production` 下被同一段代码过滤。**
  语义与今天 `release-channel.json` + `plugin-lifecycle.json` 一致，只是从"剔除 alpha 包"
  升级为"清单过滤"，并且是数据驱动，不写 `if (isDev)`。

### ② 一个执行器 —— `provision(manifest, { home, channel, source })`

- `source` 只有两个取值：`packaged`（从 app preset 拷贝，离线实体目录）｜`linked`（开发态指向
  源码树，快）。
- **dev 与 prod 调同一个函数、产出同一个结构**，允许的差异只有 `channel` 和 `source`。
- 首次安装与升级走同一条逻辑：全新 → 全量写；已有 → 按 digest 做三向协调：
  - 清单里的 digest 变了 → 更新（app 拥有）；
  - 用户手改过（现盘 digest ≠ 清单且 ≠ 上次装的值）→ 保留并提示；
  - 清单里删掉的 → 删除。
  今天的"已有 profile 一律不刷新"规则废弃。
- **产物必须自包含**：进入 preset 的包不允许出现 `workspace:*`，在 stage 阶段就转成实体目录或
  固定版本。这样 `omnimux:profile rebuild` 与打包读的是同一份可搬运产物。

### ③ 一道验收闸 —— `yarn omnimux:verify --manifest <distribution.json> --profile <dir>`

断言：清单 ↔ 实装集合逐条相等；profile 内无软链；无 `workspace:` / 越界 `file:` 依赖；
每个 digest 匹配；skill / agent 数量与清单一致；Host 能 boot 起来。

- CI 对**打包产物**跑一次（干净 HOME，模拟全新安装）。
- 本地对 **dev profile** 跑同一个命令。
- 两边输出做 diff，只允许 channel 差异 —— "开发正常、发布不同"从事故变成红灯。

## P0 实施记录（2026-09-13）

落地在 `agent/preset-self-contained`：

- `scripts/stage-preset-profile.ts` 新增 `normalizeStagedManifest()`：暂存包在进入 pnpm 之前统一去掉
  `devDependencies`，并对 `dependencies` / `optionalDependencies` 里所有 `file:` 边做"必须落在暂存根内"的
  断言；`workspace:` 与 `link:` 协议在 stage 阶段直接失败，报出具体产品插件 / 依赖 / spec。被
  `optionalDependencies` 遮盖的同名 `dependencies` 边按 pnpm 语义跳过（非生效边）。
- 同文件新增 `assertStagedSelfContained()`：发布前遍历最终 preset，任何越界 `file:`、`workspace:` /
  `link:` 协议，或缺失的必需本地源一律拒绝发布。生效的 optional 边允许目标缺席（平台排除）。
- `src/managed-profile.ts` 的 `assertManagedSourceGraph()` 增加同义检查：损坏的 preset 在 seed 时失败关闭，
  而不是把 pnpm 的解析错误留给用户机器。
- 测试：`tests/stage-preset-profile.spec.ts` +7、`tests/managed-profile.spec.ts` +1。

实测（真实产品树 + 本机 dev 环境）：

- `yarn omnimux:stage` → `staged 296 preset packages`，新门禁未触发。
- 产物复核：171 个顶层条目 / 296 个 owned 包；全量扫描 **0** 条 `workspace:` 或 `link:`，产品插件
  `devDependencies` 已清零，所有 `file:` 边都落在 preset 之内。
- `yarn omnimux:profile rebuild --target dev --app "/Applications/OmniMux Dev.app"` → 成功，
  `packageCount: 304`、`droppedLegacySources: []`。
- `/Applications/OmniMux Dev.app` 启动正常：main 进程 + DSH Host（`node.mojom.NodeService`）+ renderer 均存活。

## P1 实施记录（2026-09-13）

落地在 `agent/preset-distribution`（叠在 P0 之上）：

- `scripts/stage-preset-profile.ts` 产出 `preset/distribution.json`：
  `{schema, channel, generatedFrom:{appVersion, desktopCommit}, items:[{kind, id, tier, version, digest}]}`。
  `tier` 把发布决策写成数据 —— `core` = 必需 bundle、`beta` = lifecycle Alpha、其余 `product`；
  `digest` 复用 `managed-profile.ts` 的 `hashDirectory`（本身对软链失败关闭，且排序确定）。
  `publishCandidate` 收录该文件，并改为跳过候选里不存在的条目（此前对缺失条目做硬 rename 会抛错）。
- 新增 `scripts/verify-distribution.ts`，并接上 `verify:distribution` / `yarn omnimux:verify`：
  - `--preset <dir>`：清单 ↔ 实装集合双向相等、逐包版本与 digest、无软链、无 `workspace:`/越界 `file:`、
    与 `owned-packages.json` 一致；
  - `--profile <dir> --expect <record>`：校验已安装环境；默认容忍开发态多出的包并列出，`--strict` 升级为错误。
- `src/preset-profile.ts`：seed 时交叉校验 `distribution.json` 与 `owned-packages.json` —— 记录点名了 preset
  不拥有的包、或数量不符，都失败关闭并指向重新 stage。没有记录的旧 preset 不受影响（打包期的 verify 才是
  强制点）。
- 打包清单：`REQUIRED_PRESET_RUNTIME_ENTRIES` 增加 `preset/distribution.json`。
- 发布流水线：`.github/workflows/release.yml` 的 mac / win 两个 job 在 stage 之后、build 之前各加一步校验。
  普通 CI 不需要改动 —— `tests/verify-distribution.spec.ts` 随既有 `yarn test` 一起跑。

实测：

- `yarn omnimux:stage` → 296 包；`verify --preset` → `verified 296 preset package(s) against production`。
- 验收（用户口径）：删掉 preset 里一个包 → 退出码 1 并点名 `omnimux-market`；改动包内字节 → digest 不匹配、
  退出码 1。
- 对开发环境跑同一份记录 → 退出码 1，并指出与发行记录不一致的包 —— 这正是 P3 要消除的漂移现场。

## P2 实施记录（2026-09-13）

落地在 `agent/preset-skills`（叠在 P1 之上）：

- **技能来源＝产品插件自己声明的技能。** 插件在 `dsh.manifest.json` 里用 `skills: ["skills/<id>/SKILL.md"]`
  声明技能；`omnimux-clip` 已经这么声明了 `clip-craft`，但**没有任何东西把插件包注册成技能根**，所以文件在磁盘上、
  模型看不见。stage 阶段新增 `stageSkills()`：按声明把技能复制到 `preset/skills/<id>/`，并写入
  `omnimux-skill.json` 记录 `{id, origin}`；声明了却不存在的技能、两个插件抢同一个技能 id，都在 stage 阶段失败。
- **清单新增 `kind: "skill"` 条目**（`{id, tier: 'product', version: null, origin, digest}`），
  `publishCandidate` 收录 `preset/skills`，`verify-distribution` 对 preset 校验技能集合双向相等、
  逐技能 digest、`SKILL.md` 与来源标记一致。
- **seed 侧新增 `seedPresetSkills()`**：把 `preset/skills/<id>` 装进 `<harness-home>/skills/<id>`
  —— 那才是技能提供方真正会发现的根。带本产品标记的同名目录会被刷新；**用户自己写的同名技能一律不动**。
  profile 模式下 `verify-distribution` 也校验 Home 里的技能集合。
- 技能条目与包条目共用同一份记录，因此 P3 的升级协调天然覆盖技能。

实测（真实产品树 + 干净 HOME）：

| 项 | 结果 |
| --- | --- |
| `yarn omnimux:stage` | 296 包 + **1 个技能**（`clip-craft`，`origin: plugin:omnimux-clip`） |
| `verify --preset` | `verified 297 preset package(s) against production` |
| 干净 HOME 执行 seed | 记录 `["clip-craft"]` == Home 实际技能 `["clip-craft"]`，`SKILL.md` 就位 |
| 再次 seed（模拟升级） | 带标记的副本被刷新，用户自建技能不受影响 |
| 单元测试 | stage 侧 +3、seed 侧 +1、verifier 侧 +8 |

## P3 实施记录（2026-09-13）

落地在 `agent/preset-upgrade-reconcile`（叠在 P2 之上）：

- **`reconcileManagedProfile()` 取代「已有 profile 不刷新」。** Profile 里新增账本
  `.omnimux-managed.json`：记录本机上次安装的每个受管源与每个技能的内容指纹，外加**发行记录自身的指纹**。
  - 现盘指纹 == 账本 → 这是本产品装的副本；与发行包不同就替换（同盘候选 + 原子 rename + 失败回滚），账本记新值。
  - 现盘指纹 ≠ 账本 → 用户改过；**原样保留**，账本保留旧值，让下一次升级仍然认得这个改动，而不是把它当成新基线。
  - 账本里没有的源（升级前就存在的 Profile）→ 只登记基线，不改写任何东西。
  - Home 里缺失的技能 → 安装 —— 这就是新技能到达老 Profile 的路径。
- **稳态开销是「读一个文件」。** 发行记录没变时直接返回，不做任何树哈希；只有记录变了才做全量比对。
- 契约同步：`docs/contracts/profile-materialization.md` 的 Startup 段改写，并新增 `## Reconciliation` 一节说明三条规则与
  失败关闭语义；顺带修正两处文档漂移（rebuild 实际接受 `dev|prod`；`AGENTS.md` 里 sync 的目标应为 `~/.omnimux-dev`）。

实测（单元测试，端到端）：

| 场景 | 结果 |
| --- | --- |
| 装 v1（写入账本基线） | 新建 Profile 后账本存在 |
| 手改一个受管源 + 换装 v2（记录变化） | **被改的那个原样保留**，其余更新到 v2 的字节 |
| 再启动一次（记录未变） | 直接返回，手改仍在、已更新内容不回滚 |
| v2 里新增一个技能 | 老 Profile 的 Home 里出现该技能（含来源标记） |

## 落地顺序

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| P0 止血（已落地） | preset 产物自包含，消灭 `workspace:*`；`omnimux:profile rebuild` 可用 | dev 上 rebuild 成功且 app 正常启动 ✓ |
| P1 清单化 | 生成 `distribution.json`；`omnimux:verify` 接入 CI | 故意删 preset 里一个包，verify 必须报错 |
| P2 Skill/Agent 进清单（已落地） | skill 有产品级预装与协调通道 | 干净机器上的技能列表 == 清单 ✓ |
| P3 升级协调（已落地） | 替换"已有 profile 不刷新" | 装 v1 → 手改一个插件 → 装 v2 → 只有该插件保留旧值 ✓ |

## 防回滚红线

- 唯一真源是 `distribution.json`；禁止任何"临时 `rsync` / `cp` 进 profile"的操作。
- dev 的快捷路径只能替换 `source`，不得绕开 provisioner 与 verify。
- 内测门禁只认清单的 `channel` 字段，禁止散落的 `isDev` 判断。
- 升级协调必须保留用户手改，不得用"全量覆盖"图省事。

## 顺带发现（不阻塞）

- **升级路径无效的现场证据（P3 的直接依据）。** 上述 rebuild 成功后，dev profile 里 `dsh-better-sidebar` 仍是
  **0.18.0**（`.materialize-snapshots/plugins/` 与 `node_modules/` 两处都是），而冻结候选 App 的 preset 里是
  0.19.1 —— 正是"prefers every valid existing managed source, so a later synchronized copy is never silently
  downgraded"这条规则的结果。即：**换新安装包不会更新已有用户的插件**，用户看不到 0.19.1 侧栏增强。
- **rebuild 的失败关闭扫描过宽（本机实测）。** `~/.omnimux-dev/profiles/omnimux/` 下留着一次中断操作产生的
  `.pnpm-file-refresh.<rand>`（451 MB，2026-09-12 19:15），其 `node_modules/.bin/*` 含软链；
  `assertPhysicalTree` 把任何软链视为致命，于是 `copyRebuildCandidate` 阶段直接中止，错误信息指向一个与本次
  重建无关的隐藏目录，且**每一次**后续 rebuild 都会同样中止。建议：候选复制跳过 profile 根下的隐藏工作目录
  （或让中断的操作自清理），把"失败关闭"限定在被管理的 source 树上。本次**未**改动这段扫描逻辑；遗留目录已
  移到 `~/.omnimux-dev/.stale-profile-artifacts/`（保留，未删除）。
- `AGENTS.md` 的 OmniMux ops 表把 `omnimux:sync` 的目标写成 `~/.dsh/profiles/omnimux`；
  实际 dev home 是 `~/.omnimux-dev`、prod home 是 `~/.omnimux`（见 `rebuild-managed-profile.ts`
  的 `PROFILE_TARGETS`）。文档需同步。
- `docs/contracts/profile-materialization.md` 写 rebuild "accepts only the Dev target"，
  但 `rebuild-managed-profile.ts` 与 `omnimux.mjs` 接受 `--target dev|prod`。契约与实现需对齐。
