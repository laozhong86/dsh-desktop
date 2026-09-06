# Sidebar source pipeline acceptance — 2026-09-06

Reviewed base: `fork/omnimux` at `b31f59837ae5a386d92f5102dc26262dcf28d3c5`. The remote tip was fetched again before local commit and remained unchanged. The target is the source pipeline change accompanying this evidence; no remote publication or shared Dev activation is included.

## Evidence

| Check | Result | Record |
| --- | --- | --- |
| npm release source vs pinned Git revision | All 87 published source files byte-identical | `release-source-comparison.json`, `npm-provenance-statements.json` |
| Clean source build and second build through real staging | 184 packaged files byte-identical; staged candidate provenance verified | `clean-build-and-staging.json`, `clean-build-and-staging.log` |
| Failure behavior | Tampered runtime bytes, changed patch context, and repeated application rejected | `clean-build-and-staging.json` |
| Desktop dependency setup | Immutable install passed | `immutable-install.log` |
| Focused desktop tests | 3 files, 27 tests passed | `focused-tests.log` |
| Desktop typecheck | Passed; contract types current | `typecheck.log` |
| Source lifecycle regression | Exact final patched source: 2/2 tests passed | `source-lifecycle.log` |
| Compiled component in built-in browser | Native drag 528 → 608 px; live variables retained; final pointerup ordering and disposal passed | `iab-observations.json` |

## Reproduction

From the desktop worktree root:

```sh
corepack yarn install --immutable
corepack yarn workspace dsh-plugin-desktop exec vitest run tests/stage-preset-profile.spec.ts tests/preset-profile.spec.ts tests/preset-distribution.spec.ts
corepack yarn typecheck
SIDEBAR_PIPELINE_REPORT=/absolute/path/to/report.json node dsh-plugin-desktop/tests/better-sidebar/verify-pipeline.mjs
```

The verifier uses minimal product fixtures and the real sidebar build, pack, install, and candidate publication path. See the [browser harness instructions](../../../dsh-plugin-desktop/tests/better-sidebar/browser/README.md) for the explicit bundle selection and focused source regression command.

Final client SHA-256: `f927bb56e117ff9beceef610ed7cc82c574c6bd647bdd2153d9850689f2455ed`.
Tarball SHA-256: `a90b4c70dff4b25c669edf70e9d06b7ff93b090fd1f1864a4a38b5b4913e684b`.

## Electron supplement

Electron 43.4.0 arm64 passed against the same final client SHA. `sidebar-harness-result.json` records the ordered CSS writes, drag-marker release, and unmount cleanup; `sidebar-harness.png` shows the result.

The initial runner used top-level `await app.whenReady()`, which blocks ESM entrypoint completion before Electron readiness. Starting the async function without top-level await resolves this cycle, consistent with [Electron ESM readiness semantics](https://www.electronjs.org/docs/latest/tutorial/esm). The probe selects a live bottom-panel toggle and checks geometry for its resulting state. Failed probes and load errors exit nonzero through `app.exit(1)`; a missing-toggle failure was observed with exit 1 before the final passing capture.

## Acceptance limits

The compiled-component harness calls the real client factory and `apply(ctx)` with an inert context. It does not exercise a full desktop Host, real user sessions, shared Dev, or Windows. Build evidence was produced on macOS with Node v25.8.0. The registry attestation was decoded, not independently signature-verified. Two-directory equality covers the sidebar package, not the complete preset runtime dependency graph. Issues #579/#620 remain open and #620 tab layout is outside this change.

Directory-local Git attributes preserve literal unified-diff context in the patch and legacy delta. Other whitespace checks remain enabled.
