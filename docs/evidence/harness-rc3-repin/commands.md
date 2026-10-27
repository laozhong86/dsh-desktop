# harness-rc3-repin — command ledger (real exit codes)

Every command was run as `cmd > log 2>&1; echo "REAL_EXIT=$?"` (or with the exit code appended to
the log). No piped exit code is reported. Worktree commands always carried an explicit `workdir`
and `git -C <path>`.

Worktree: `.worktrees/harness-rc3-repin`
Branch: `agent/harness-rc3-repin` (base `fork/omnimux` = `f245033bc2`)
Pin commit: `9dda0eeba3084e1e92fe15f8fcda956d656c9136`

| # | Command | REAL_EXIT | Note |
| --- | --- | --- | --- |
| 1 | `git -C <shell>/deepseek-harness fetch --tags origin` | 0 | read-only ref fetch in the primary checkout's submodule (task-mandated step) |
| 2 | `git -C <shell>/deepseek-harness rev-parse 'dsh-v0.1.5-rc.3^{commit}'` | 0 | `a4c74a91e06b00fe0b0937bde982170c526cc842` — matches the required SHA |
| 3 | `bash scripts/worktree.sh new harness-rc3-repin --type agent` | 0 | `.worktrees/harness-rc3-repin`, branch `agent/harness-rc3-repin` from `fork/omnimux` |
| 4 | `git submodule update --init deepseek-harness` (in the worktree) | 0 | clone took 30 s; git created an **isolated** module dir `.git/worktrees/harness-rc3-repin/modules/deepseek-harness` |
| 5 | `git -C deepseek-harness checkout -q a4c74a91e0…` (worktree) | 0 | `dsh-v0.1.5-rc.3` |
| 6 | `node verify-patches.mjs <wt> 0.1.5-rc.1 0.1.5-rc.1` (control) | 0 | 13/13 patches, 40/40 hunks — validates the oracle against the shipped rc.1 tarballs |
| 7 | `corepack yarn upstream:prepare-runtime` (ambient PATH) | **1** | failed at `build:lib` — the DSH Desktop runtime shim on PATH supplied pnpm 11.8.0 while the harness pins 11.7.0 |
| 8 | `env -u NODE_OPTIONS PATH=$(dirname "$(command -v node)"):/usr/bin:/bin:/usr/sbin:/sbin corepack yarn upstream:prepare-runtime` | 0 | `release pack: family dsh, 265 tarball(s) in dist/npm` |
| 9 | `node verify-patches.mjs <wt> 0.1.5-rc.1 0.1.5-rc.3` (target) | 0 | 13/13 patches, 40/40 hunks transplant; 0 repairs, 0 failures |
| 10 | `git mv patches/*@0.1.5-rc.1.patch …@0.1.5-rc.3.patch` (13 files) | 0 | tracked renames |
| 11 | `node scripts/sync-vendored-runtime.mjs --write` | 0 | `stable 265 packages from a4c74a91e0 are verified` |
| 12 | `corepack yarn check:vendored-runtime` | 0 | same verification, read-only |
| 13 | `corepack yarn install` (clean PATH) | 0 | `Done with warnings in 10s 659ms`; yarn resolved every `patch:` entry to `patches/*@0.1.5-rc.3.patch` |
| 14 | `git rm -r vendor/dsh-runtime/0.1.5-rc.1` | 0 | superseded runtime removed (266 files) |
| 15 | `corepack yarn workspace dsh-plugin-desktop verify:notices` | 0 | `561 production packages checked`; notices regenerated to rc.3 |
| 16 | `corepack yarn check:layout` (first run) | **1** | bilingual gate: `dsh-plugin-desktop/README.i18n.yaml` stale after the README edit |
| 17 | `corepack yarn check:layout` (second run) | **1** | `verify-layout: submodule index is 183f08e9c6…, expected a4c74a91e0…` (gitlink not staged yet) |
| 18 | `git add deepseek-harness` | 0 | gitlink recorded as `160000 a4c74a91e0…` |
| 19 | `corepack yarn check:layout` (third run) | 0 | bilingual 50 records/100 docs, market direction, vendored runtime, layout all green |
| 20 | `corepack yarn check` | **1** | see #21 — `tests/dshmarket-compat.spec.ts` 2 failures; 147/148 files, 1538 passed, 9 skipped |
| 21 | base-revision oracle: `corepack yarn workspace dsh-plugin-desktop test tests/dshmarket-compat.spec.ts` in the untouched primary checkout (`f245033bc2`, submodule rc.1) | **1** | **the same 2 tests fail identically on the pre-change base** → pre-existing/environmental, not caused by the re-pin |
| 22 | `corepack yarn workspace dsh-plugin-desktop verify:closure` | 0 | |
| 23 | `corepack yarn workspace dsh-plugin-desktop verify:cli` | 0 | |
| 24 | `corepack yarn workspace dsh-plugin-desktop verify:loader` | 0 | Loader boot on the rc.3 runtime |
| 25 | `corepack yarn workspace dsh-plugin-desktop verify:profile` | 0 | Host profile boot on the rc.3 runtime |
| 26 | `corepack yarn workspace dsh-plugin-desktop verify:aa` | 0 | `DSH_VERIFY_AA=1` |
| 27 | `corepack yarn workspace dsh-plugin-desktop verify:licenses` | 0 | |
| 28 | `corepack yarn workspace dsh-plugin-desktop verify:operations` | 0 | |
| 29 | `corepack yarn workspace dsh-plugin-desktop prepare:electron-native` | 0 | `Prepared fs-ext 2.1.1 for Electron 43.3.0 (darwin-arm64, ABI 148)` |
| 30 | `corepack yarn omnimux:stage` (`OMNIMUX_PLUGINS_DIR` set) | 0 | staging prerequisite for packaging |
| 31 | `corepack yarn package:dev` (`OMNIMUX_PLUGINS_DIR` set) | 0 | artifact `dsh-plugin-desktop/dist/mac-arm64/OmniMux.app` |
| 32 | `codesign --verify --deep --strict OmniMux.app` | 0 | ad-hoc signature valid after `stamp-dev-app` |

## Failures and how they were repaired

1. **#7 → #8** `upstream:prepare-runtime` aborted with
   `[ERROR] This project is configured to use 11.7.0 of pnpm. Your current pnpm is v11.8.0`.
   The harness `build:lib` script shells out to bare `pnpm`, which resolved the DSH Desktop
   runtime-commands shim on `PATH` (pnpm 11.8.0) instead of the corepack-pinned 11.7.0.
   Repaired by running the runtime preparation with a clean `PATH` — the same technique the
   repository's own `docs/contracts/upstream-sync.md` documents for its build step. No source
   change was needed.
2. **#16** bilingual documentation gate — the README pin prose changed, so the recorded Git blob
   hashes had to be recomputed: `README.md` → `63d9ac92…`, `README.zh.md` → `8c6c21be…`
   (`git hash-object --path=<rel> -- <rel>`, exactly what the gate computes).
3. **#17** `verify-layout` — the submodule gitlink is only a pin change once it is in the index;
   repaired with `git add deepseek-harness`.
4. **#20** `yarn check` — 2 failures in `tests/dshmarket-compat.spec.ts`, **not caused by this
   change**; proven by #21, which reproduces the identical failures on the untouched base
   revision. Root cause is outside this repository: the third-party `dshmarket` code resolves the
   live registry latest (`v1.66.9`) for the two "trial install" assertions while the test only
   stubs `globalThis.fetch` (which returns `1.39.0`). The remaining `yarn check` stages were run
   individually (#22–#28) and all pass.
