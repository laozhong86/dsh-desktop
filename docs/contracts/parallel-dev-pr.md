# parallel-dev-pr — 多会话并行开发与 PR 闭环合同

> 目的：让多个 WorkBuddy 会话能同时改本仓，且每条改动走完整 PR，直到老板合入。  
> 本合同是**仓库内的持久制度**，不依赖会话记忆。任何 agent 在本仓开特性分支 / 开 PR 前 MUST 读本合同。  
> 对照：GitHub PR Manager skill（跟 PR 层）+ `docs/contracts/upstream-sync.md`（上游同步层）。  
> 拍板（2026-08-23）：base=`omnimux`；合入永远由老板点；主仓脏改动先分组整理；P0 先制度，再 skill/巡检。

## 一句话拓扑

```
一任务 → 一路径租约 → 一 worktree → 一分支 → 一 PR → board 跟踪 → 老板合入 → 回收
```

## 硬规则

1. **主 checkout 只读**（日常开发）：主路径 `/Users/x/Desktop/Project/omnimux-desktop-fork` 只做 upstream sync、发版、board/lease 汇总。禁止在主仓并行写特性。
2. **一会话 = 一 worktree = 一分支 = 一 PR**。禁止多会话共用同一 cwd。
3. **写文件前必须有路径租约**。无租约或租约冲突 → 停手问老板。
4. **产品 PR 只打 fork**：`laozhong86/omnimux-desktop-fork`，base = `omnimux`。禁止对 `anywhere-labs/deepseek-harness-desktop` 开产品特性 PR。
5. **禁止直接推 `omnimux` / `master`**。必须走 PR。
6. **合入权永远属于老板**。agent 不得 `gh pr merge`，除非老板当轮明文授权。
7. **禁止改 `deepseek-harness/` submodule 内容**。pin 变更走独立提交 + upstream-sync 纪律。
8. **触及薄改点**（`main.ts` / `profile-manager.ts` / `update-*.ts` / `bin.ts` 等）按 `upstream-sync.md` C 级：**停等老板**，不得假装普通特性。
9. **未验收不得标完成**。CI 绿 ≠ 合入；窗口/人眼证据缺失要写明「未验收」。

## 分支与 worktree

| 项 | 约定 |
|---|---|
| 分支名 | `agent/<topic>-<short>`（例：`agent/parallel-dev-pr`） |
| worktree 根 | `<repo>/.worktrees/<dir>`（已 gitignore） |
| 建法 | `git fetch fork && git worktree add .worktrees/<dir> -b agent/<topic> fork/omnimux` |
| 推送远端 | `fork`（不是 `origin`） |
| PR base | `omnimux` |
| 回收 | PR 合入或放弃后：`git worktree remove …`；删远程支；释放租约；更新 board |

每个 worktree 需要自己的依赖/子模块初始化（按需）：

```sh
git submodule update --init --recursive
corepack yarn install --immutable
```

## 路径租约（local）

真源文件（不进 git，本机共享）：

`.workbuddy/dev-leases.json`

规则：

- claim 成功才能改列出的路径前缀
- `exclusive: true` 的路径前缀冲突 → 禁止开写
- 默认建议排他：`dsh-plugin-desktop/src/main.ts`、`profile-manager.ts`、`update-*.ts`、`package.json`、`yarn.lock`、`.github/workflows/**`、`docs/contracts/upstream-sync.md`
- 释放时机：PR 合入 / 放弃 / 过期

空模板见同目录旁注；agent 开写前 MUST 更新该文件。

## PR board（local）

真源文件（不进 git，本机共享）：

`.workbuddy/pr-board.md`

每个 open PR 一行，至少含：PR 号、分支、worktree、状态、CI、Review、下次动作、会话 id、是否允许 force-with-lease。

**禁止**用单文件 `memory/pr-tracking.md` 覆盖多 PR 状态。GitHub PR Manager 的跟踪输出应合并进本 board。

## Agent 最短 SOP

```sh
# 0. 读本合同 + AGENTS.md 指针
# 1. claim 租约（写 .workbuddy/dev-leases.json）
# 2. 建 worktree / 分支（cwd 切到 worktree）
# 3. 实现（仅 lease 内路径）+ 本地验证
# 4. commit（需要 DCO 则 --signoff）
# 5. git push -u fork HEAD
# 6. gh -R laozhong86/omnimux-desktop-fork pr create --base omnimux --fill
# 7. 登记 .workbuddy/pr-board.md
# 8. 跟 CI / review（可交棒 github-pr-manager）；大改先问老板
# 9. 老板合入后回收 worktree + 释放租约 + 更新 board
```

## 与既有合同交棒

| 合同 / 技能 | 关系 |
|---|---|
| `upstream-sync.md` | 周同步仍走脚本；同步窗内新特性 PR 应 rebase 到最新 `omnimux`；C/D 级不绕开 |
| GitHub PR Manager | 只负责「开 PR 之后」的 CI/review/跟进；开写前的隔离与租约由本合同管 |
| `omnimux-plugin-ops` | 插件进 App 仍走 `yarn omnimux:*`；本仓壳层 PR 不代替插件 sync 纪律 |

## 明确不做

- 多会话共用主仓切分支
- stash 掉脏主仓后假装干净就开并行（应先分组整理）
- agent 擅自 merge
- 产品改动 PR 打向上游 `origin`
- 把 upstream-sync 与并行开发揉成一个巨无霸 skill（P1 再做调度 skill，仍保持交棒）
