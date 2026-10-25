# Issue #3786 — macOS universal smoke packaging regression

Worktree `.worktrees/sharp-universal-issue-3786`, branch `agent/sharp-universal-issue-3786`, base `omnimux` = `dca12ebdd2`.
Reproduced and fixed on macOS with Node `v24.18.1` (the smoke script refuses Node 25) and Yarn `4.18.0`.

**Verdict: the CI step `Build macOS smoke artifact` had two independent root causes on the same path, and both are fixed. `dist:mac-smoke` now runs end to end locally and verifies the DMG.**

The step had never executed since the 0.2.1 migration: the stale vitest assertion fixed in #106 aborted the job before it. The first cause is the one recorded in the issue; the second only became visible once the first was fixed, which is why it is fixed in this same PR — same step, same acceptance.

## Cause 1 — the sharp pin drifted behind what the install resolves

| Fact | Evidence |
| --- | --- |
| The inventory named 0.35.3 / libvips 8.18.3 | `dsh-plugin-desktop/scripts/mac-universal.ts:20,24,52,56` |
| Both manifests pinned `sharp: 0.35.3` | `dsh-plugin-desktop/package.json:366`, `dsh-community-market/package.json:78` |
| A third consumer pulled a different range | the vendored `@deepseek-ai/dsh-attachment-local@0.2.1-rc.3` also depends on `sharp` |
| So the lockfile carried two resolutions | `"sharp@npm:0.35.3"` **and** `"sharp@npm:0.35.5"` |
| Hoisting put 0.35.5 at the top of the workspace | `dsh-plugin-desktop/node_modules/@img/sharp-darwin-*/lib/sharp-darwin-*-0.35.5.node`, `@img/sharp-libvips-darwin-*/lib/libvips-cpp.8.18.7.dylib` |

`prepareInstalledMacUniversalRuntime` therefore threw on the four names it was told to expect.

## Cause 2 — `x64ArchFiles` never learned the new native dependencies

With cause 1 fixed the run reached the universal merge and aborted there:

```
⨯ Detected file "Contents/Resources/app.asar.unpacked/node_modules/@deepseek-ai/libreoffice-kit-darwin-arm64/bin/libreoffice-kit"
  that's the same in both x64 and arm64 builds and not covered by the x64ArchFiles rule:
  "**/node_modules/{@deepseek-ai/node-addon-system-darwin-*/**,…,@dataiku/uv-darwin-*/**}"
```

`@electron/universal` (`dist/esm/index.js:100-108`) refuses a Mach-O file that is byte-identical in the x64 and arm64 trees unless `x64ArchFiles` names it. An audit of the two finished temp trees (see [audit-x64-arch-files.mjs](audit-x64-arch-files.mjs)) found **14** such files, in three families the fork's rule never listed:

| Family | Files | Upstream `origin/master` rule |
| --- | --- | --- |
| `@deepseek-ai/libreoffice-kit-darwin-{arm64,x64}` | 2 (`bin/libreoffice-kit`) | `@deepseek-ai/libreoffice-kit-darwin-*/**` — present |
| `meshcall-router-darwin-{arm64,x64}` | 4 (`bin/meshcall`, `bin/meshcall-router`) | `meshcall-router-darwin-*/**` — present |
| `sherpa-onnx-darwin-{arm64,x64}` | 8 (`sherpa-onnx.node`, `libsherpa-onnx-{c,cxx}-api.dylib`, `libonnxruntime.dylib`) | `sherpa-onnx-darwin-*/**` — present |

The fork's rule was missing exactly those three globs; `origin/master:dsh-plugin-desktop/package.json:455` has them.

## Changes

| File | Change | Why |
| --- | --- | --- |
| `dsh-plugin-desktop/scripts/mac-universal.ts:20,24,52,56` | `0.35.3`→`0.35.5`, `8.18.3`→`8.18.7` | match what the install actually resolves, and upstream |
| `dsh-plugin-desktop/package.json:366` | `sharp: 0.35.3`→`0.35.5` | the pin must be the single version in the tree |
| `dsh-community-market/package.json:78` | `sharp: 0.35.3`→`0.35.5` | same, and matches upstream |
| `dsh-plugin-desktop/package.json:446` | `x64ArchFiles` += `@deepseek-ai/libreoffice-kit-darwin-*/**`, `meshcall-router-darwin-*/**`, `sherpa-onnx-darwin-*/**` | cause 2 |
| `yarn.lock` | drops the whole unused `sharp@npm:0.35.3` / `@img/sharp-*@0.35.3` / `@img/sharp-libvips-*@1.3.2` subtree (330 lines) | `sharp@npm:0.35.5` was already present; the 0.35.3 tree became unreachable |
| `dsh-plugin-desktop/tests/mac-universal.spec.ts` | new case: the manifest pin, the lockfile and the native entry names must agree | fail-fast guard; see below |

A repo-wide sweep found no other `0.35.3` / `8.18.3` hardcode (only these six lines existed).

## Local reproduction — before and after

Both runs execute the exact `prepareRuntime()` from `dsh-plugin-desktop/scripts/package-mac.ts:77-81`.

**Before** (`REAL_EXIT=1`):

```
THREW: universal macOS runtime is missing 4 native file(s):
  …/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64-0.35.3.node,
  …/@img/sharp-libvips-darwin-arm64/lib/libvips-cpp.8.18.3.dylib,
  …/@img/sharp-darwin-x64/lib/sharp-darwin-x64-0.35.3.node,
  …/@img/sharp-libvips-darwin-x64/lib/libvips-cpp.8.18.3.dylib
```

**After** (`REAL_EXIT=0`): `OK: universal runtime complete — all 18 native entries present for both CPUs`

**End to end** — `DSH_PACKAGE_CHECK_ALREADY_RAN=1 yarn workspace dsh-plugin-desktop dist:mac-smoke` (the exact CI command, `REAL_EXIT=0`):

```
• packaging  platform=darwin arch=x64       appOutDir=dist/mac-smoke/mac-universal-x64-temp
• packaging  platform=darwin arch=arm64     appOutDir=dist/mac-smoke/mac-universal-arm64-temp
• packaging  platform=darwin arch=universal appOutDir=dist/mac-smoke/mac-universal
• building   target=DMG arch=universal file=dist/mac-smoke/OmniMux-2.0.10-universal.dmg
macOS DMG smoke verification passed: …/dist/mac-smoke/OmniMux-2.0.10-universal.dmg
```

`lipo -info …/mac-universal/OmniMux.app/Contents/MacOS/OmniMux` → `Architectures in the fat file: x86_64 arm64`.

Before the `x64ArchFiles` fix the same command aborted at the universal step with the `⨯ Detected file …` error quoted above.

## The new guard test

`tests/mac-universal.spec.ts` now asserts that `package.json`'s `sharp` pin, the single `sharp@npm:` resolution in `yarn.lock`, and the version embedded in the sharp native entry names all agree. Mutation-checked both ways:

- manifest back to `0.35.3` while the lock says `0.35.5` → `AssertionError: expected [ '"sharp@npm:0.35.5":' ] to deeply equal [ '"sharp@npm:0.35.3":' ]`
- one entry path back to `0.35.3` while the manifest says `0.35.5` → `AssertionError: expected '0.35.3' to be '0.35.5'`

This fails in the `check` job on ubuntu rather than waiting for the macOS job, which is the point: the drift is a pin/lock problem, not a macOS problem.

## Verification and limits

| Check | Result |
| --- | --- |
| `check:mac-package` (the mac job's preflight, with #106's one-line assertion applied) | `REAL_EXIT=0`, `5 passed (5)`, `135 passed \| 1 skipped`, closure green |
| `dist:mac-smoke` end to end | `REAL_EXIT=0`, DMG verified, fat binary `x86_64 arm64` |
| `yarn install --immutable` | `REAL_EXIT=0` after the lock refresh (it fails with `YN0028` against the stale lock) |
| Repo-wide `0.35.3` / `8.18.3` sweep | none left outside this diff |

Not verified here:

- **This branch's own CI.** It is based on `omnimux` = `dca12ebdd2`, which does not yet contain #106, so `tests/package.spec.ts:1047` still asserts `43.3.0` and the desktop jobs will fail on that one assertion until #106 merges. The `check:mac-package` run above shows the gate is otherwise green once it is applied.
- **The signed release lane.** `dist:mac-smoke` is unsigned (`CSC_IDENTITY_AUTO_DISCOVERY=false`); `release-mac.ts` is a manual credentialed step and was not run.
- **`verify-mac-release`** (the signed-release verifier) was not exercised; only the smoke verifier ran.
- The smoke log warns `the OmniMux preset seed preset/plugins/omnimux/package.json was not staged` — expected for a smoke build without `stage-preset-profile`, and unchanged by this task.
