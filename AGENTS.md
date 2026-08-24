# DSH Desktop repository rules

This repository owns the desktop product around an unmodified DeepSeek Harness checkout. **It is the shipping OmniMux desktop line**: `/Applications/OmniMux.app` and released builds come from here, not from the sibling `omnimux-desktop` tree.

## Prerequisites and setup

- Use Node.js `^22.19.0` or `>=24.0.0` and the root Yarn `4.18.0` release through Corepack.
- Initialize the pinned upstream checkout with `git submodule update --init --recursive`.
- Install root dependencies with `corepack yarn install --immutable`.

## Build, run, and verify

- Start the desktop development workflow with `corepack yarn dev`.
- Build the desktop package with `corepack yarn build`.
- Run unit tests with `corepack yarn test`.
- Run type checking with `corepack yarn typecheck`.
- Run the complete headless gate with `corepack yarn check`.
- Run upstream operations through the root scripts, such as `corepack yarn upstream:build`.


## OmniMux plugin ops (this repo is the day-to-day entry)

This fork is the **main ops entry** for OmniMux plugin develop / browser QA / sync-to-app / release. Plugin source lives in the sibling `~/Desktop/Project/dsh-plugin/product/omnimux-dsh`. Contracts: that tree's `docs/contracts/dev-pipeline.md` + `docs/contracts/ops-entry.md` (single ops entry; no per-plugin deploy lanes).

| Command | Purpose |
| --- | --- |
| `yarn omnimux:dev start <task> <plugin>` | L2: isolated Host + link one in-progress plugin + unified watch (official HMR) |
| `yarn omnimux:dev watch <task> <plugin>` | Switch which plugin the watch targets (Host stays up) |
| `yarn omnimux:sync [plugin…]` | Build then materialize into `~/.dsh/profiles/omnimux` (**does not restart App**) |
| `yarn omnimux:restart` | Manually restart `/Applications/OmniMux.app` after sync |
| `yarn omnimux:doctor` | Compliance check (prod must not link, etc.) |
| `yarn omnimux:stage` | Materialize into `preset/plugins/` before packaging |
| `yarn omnimux:path` | Print resolved product/plugin paths |

MUST NOT hand-`rsync`/`cp` into any profile. Daily iteration uses `omnimux:sync` + `omnimux:restart`; packaging uses `omnimux:stage` then `package:dir` / `dist:*`.
**Packaging Pre-requisite Rule**: Direct packaging or running `package-dir.mjs` without staging will cause startup crash (`missing dsh-better-sidebar` recovery window). When rebuilding `/Applications/OmniMux.app` or packaging distribution bundles, ALWAYS ensure `OMNIMUX_PLUGINS_DIR` is set and run `stage-preset-profile` (`node ./dsh-plugin-desktop/scripts/stage-preset-profile.ts` or `yarn omnimux:stage`) before packaging.

- `deepseek-harness/` is a pinned upstream Git submodule. Never edit files inside it from a desktop feature branch.
- `dsh-plugin-desktop/` owns the Cordis Host and Client faces, Electron bootstrap, packaging, and release tests.
- `dsh-community-fabric/` owns the community interoperability RFC. Until schemas and a reviewed reference adapter exist, it remains a private documentation scaffold and must not declare loadable DSH or package entry points.
- `dsh-community-market/` owns the community-market shell. Until its runtime is implemented, it remains a private documentation scaffold and must not declare loadable DSH or package entry points.
- The outer repository and all owned packages use the root Yarn release with `nodeLinker: node-modules`.
- The upstream submodule keeps its own pnpm workspace. Run upstream commands through the root `upstream:*` scripts, whose Yarn portable-shell commands enter the submodule before invoking Corepack.
- Compatibility mode must run the upstream default client without overrides. Advanced presentation belongs to desktop-owned client plugins and may replace documented slots or services through profile composition.
- Keep graphical application launch explicit. Builds, typechecks, unit tests, and Loader smokes must remain headless-safe.
- Commit before major changes of direction and keep the submodule pin update separate from desktop behavior changes.
- Keep the repository topology and package-manager split consistent with the [owning Agent Note](.agents/notes/implemented/process/2026-08-15-pinned-upstream-and-isolated-yarn-workspace.md).

## Repository ecosystem

This desktop product is one layer of a wider OmniMux project ecosystem: it forks an unmodified official DeepSeek Harness checkout, ships preset OmniMux plugins from the sibling `dsh-plugin` development workspace, and talks to the OmniMux Go gateway over `OMNIMUX_BASE_URL`. Sibling repositories live under `~/Desktop/Project/` (`dsh-plugin`, `OmniMux`, `Github/deepseek-harness`, and the parallel slim shell `omnimux-desktop` — an alternative product direction, NOT the shipping line). Read the [ecosystem Agent Note](.agents/notes/implemented/architecture/2026-08-21-omnimux-ecosystem-map.md) before touching plugin sync, upstream pins, or gateway-facing behavior. Cross-repo agent memory: `/Users/x/Desktop/Project/Github/deepseek-harness/.workbuddy/memory/MEMORY.md`.

## Upstream sync contract

This fork syncs with upstream weekly. Before any merge from `origin/master`, read and follow [docs/contracts/upstream-sync.md](docs/contracts/upstream-sync.md) — it defines the four-tier merge decision ladder (auto-merge / template-resolve / user-confirm / reject), the standard SOP, and the mandatory decision log at [docs/contracts/upstream-sync-log.md](docs/contracts/upstream-sync-log.md). A merge without a log entry is not done.

## Parallel development & PR contract

Multi-session feature work MUST follow [docs/contracts/parallel-dev-pr.md](docs/contracts/parallel-dev-pr.md): one task → one path lease → one worktree → one branch → one PR to `fork`/`omnimux`; main checkout is read-only for day-to-day coding; only the boss merges. Local board/leases live under `.workbuddy/` (not committed). After a PR is open, follow-up uses skill `omnimux-pr-handoff` (wraps marketplace github-pr-manager): update `.workbuddy/pr-board.md`, never auto-merge. Plugin-tree Git/PR lives in sibling `omnimux-dsh` contract `docs/contracts/plugin-git-pr.md` + skills `omnimux-plugin-pr` / `omnimux-pr-handoff` — do not reuse this fork's `fork`/`omnimux` topology there.
