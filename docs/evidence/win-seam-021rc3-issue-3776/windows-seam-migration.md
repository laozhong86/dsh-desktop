# Issue #3776 — Windows sandbox provider seam migration: static verification

Worktree `.worktrees/win-seam-021rc3-issue-3776`, branch `agent/win-seam-021rc3-issue-3776`, base `omnimux` = `dca12ebdd2`.
Pinned upstream `deepseek-harness` = `1f81c047fc48fa190a683e469daa699857e9afe8` (`dsh-v0.2.1-alpha.2-996-g1f81c047fc`, runtime `0.2.1-rc.3`).
Runtime under test is the vendored `vendor/dsh-runtime/0.2.1-rc.3/`, installed at `dsh-plugin-desktop/node_modules/@deepseek-ai/`.

**Verdict: the migration is complete.** No call to the old interface survives, and every shell-owned Windows override point now sits on a seam that 0.2.1-rc.3 still declares public. What is *not* proven here is runtime behaviour on win32 — see [macos-blocked-verification.md](macos-blocked-verification.md).

## 1. Old interface → new seam

| # | Shell override point | Old interface | New seam | Verdict | Evidence (file:line) |
| --- | --- | --- | --- | --- | --- |
| 1 | Windows ACL runner argv prefix | `SandboxInternals.windowsAclRunnerArgs` | none — the field survives but is documented as a **test hook** ("inject probe verdicts / a fake launcher / a platform without real runners"), never a production seam | no production caller; last consumer deleted | `dsh-plugin-desktop/node_modules/@deepseek-ai/dsh-sandbox-local/lib/types/index.d.ts:50,67`; deleted consumer `dsh-plugin-desktop/scripts/verify-windows-minimal-pty.mjs:84` removed by `4b6f8a2750` (#26) |
| 2 | Trampoline insertion into the confined argv | `DesktopWindowsPwshSandbox`'s `protected runArgv` / `startArgv` (runs **before** confinement) | `DesktopWindowsAclSandboxProvider.confine()` — wraps the provider's public `confine`, so the trampoline lands **after** confinement | migrated | old overrides removed by `983f8e4f6a`; new seam `dsh-plugin-desktop/src/windows-acl-sandbox-provider.ts:15-25` |
| 3 | Electron `ELECTRON_RUN_AS_NODE` env half | same removed override | `DesktopWindowsPwshSandbox.resolve()` (public hook on the executor) | migrated | `dsh-plugin-desktop/src/windows-pwsh-sandbox.ts:134-148`; upstream public declaration `dsh-pwsh-sandbox/lib/types/index.d.ts:55` |
| 4 | Why the executor can no longer host the argv half | — | upstream `SandboxPwshExecutor.confine` is `private`, and its `execute()` is the only caller | confirmed | `dsh-plugin-desktop/node_modules/@deepseek-ai/dsh-pwsh-sandbox/lib/types/index.d.ts:56,77` |
| 5 | New base-class contract | — | `LocalSandboxProvider.confine(argv, policy, signal?): Promise<ConfinedArgv>` is public | type-enforced (`override` + explicit types; `typecheck` green) | `dsh-sandbox-local/lib/types/index.d.ts:119`; abstract contract `dsh-sandbox/lib/types/index.d.ts:141` |
| 6 | Profile row: PowerShell executor | row `pwsh-sandbox` = `@deepseek-ai/dsh-pwsh-sandbox` | upstream row disabled, `desktop-windows-pwsh-sandbox` → `dsh-plugin-desktop/windows-pwsh-sandbox` inserted | migrated | `dsh-plugin-desktop/src/profile.ts:85-88,1062-1083` |
| 7 | Profile row: sandbox provider | row `sandbox` = `@deepseek-ai/dsh-sandbox-local` | upstream row disabled, `desktop-windows-acl-sandbox` → `dsh-plugin-desktop/windows-acl-sandbox-provider` inserted | migrated | `dsh-plugin-desktop/src/profile.ts:89-92,1084-1104` |
| 8 | Row reachability ("injected **and active**") | — | package subpath export + build entry, resolved by the Cordis Loader from the row `name` | verified by execution, not just by reading | `dsh-plugin-desktop/package.json:41-43`, `dsh-plugin-desktop/tsdown.config.ts:32`; `import.meta.resolve('dsh-plugin-desktop/windows-acl-sandbox-provider')` → `lib/windows-acl-sandbox-provider.js`, whose default export is `DesktopWindowsAclSandboxProvider extends LocalSandboxProvider` (see commands.md #7) |
| 9 | Node-mode trampoline itself | — | desktop-owned `src/windows-acl-runner.ts` | intact | `dsh-plugin-desktop/src/windows-acl-runner.ts:15-24`; built entry `dsh-plugin-desktop/tsdown.config.ts:33` |
| 10 | Residual helper | `adaptWindowsAclExecution` | production no longer calls it: the provider uses `adaptWindowsAclArgv`, the executor uses `resolve` | **residual, not a broken call** | `dsh-plugin-desktop/src/windows-pwsh-sandbox.ts:112-126`; only caller is `dsh-plugin-desktop/tests/windows-pwsh-sandbox.spec.ts` |

Two Windows-relevant `override` members exist in the whole shell, and both are on the new seams (`grep -rn "override " dsh-plugin-desktop/src`): `windows-pwsh-sandbox.ts:134` and `windows-acl-sandbox-provider.ts:16`. No `runArgv`, `startArgv`, or `.internals` access survives anywhere in `dsh-plugin-desktop/src` or `dsh-plugin-desktop/tests`.

## 2. Windows controlled child process and console hiding

Upstream owns both halves now; the shell contributes nothing but the profile rows and the trampoline.

| Fact | Evidence |
| --- | --- |
| The restricted-process spawn requests a hidden console | `@deepseek-ai/dsh-win32-process` `0.2.1-rc.3` `lib/index.js` carries `dwFlags: 257` (`CREATE_NO_WINDOW`) twice and `wShowWindow: 0` (`SW_HIDE`) twice — counted on this macOS host in commands.md #8 |
| That fact is pinned by a test that runs on every platform | `dsh-plugin-desktop/tests/package.spec.ts:1197-1209` ("starts restricted Windows shells with a hidden console show state"); comment: "Upstream owns this behaviour now; the shell no longer patches the package" |
| The desktop no longer patches that package | `patches/` holds only `dsh-sandbox-windows-acl@0.2.1-rc.3.patch` (ACL write-grant retry, no process creation) and `dsh-subprocess-local@0.2.1-rc.3.patch` (runner env, not process flags) |
| The Electron Node-mode flag is upstream-owned for the private subprocess runner | `patches/dsh-subprocess-local@0.2.1-rc.3.patch`; pinned by `dsh-plugin-desktop/tests/package.spec.ts:1102-1134` |

## 3. Seam coverage after this task

| Behaviour | Test | Platform |
| --- | --- | --- |
| Both rows are swapped on `win32`, absent on `darwin` | `dsh-plugin-desktop/tests/profile.spec.ts` (added: `desktop-windows-acl-sandbox` assertions) | any |
| Trampoline is inserted into the argv the upstream provider already confined, and the upstream verdict is not mutated | `dsh-plugin-desktop/tests/windows-pwsh-sandbox.spec.ts` (added: `desktop Windows ACL sandbox provider seam`) | any — the Host identity is stubbed, and the test fails if the provider stops inserting the trampoline (mutation check in commands.md #10) |
| Trampoline argv rewrite rules (exact executable + exact runner only) | `dsh-plugin-desktop/tests/windows-pwsh-sandbox.spec.ts` (pre-existing) | any |
| Built subpath export resolves to the provider class | commands.md #7 (one-off execution; not a committed test) | any |
| A real restricted-token win32 process spawns without a console | **none** | Windows only — blocked, see [macos-blocked-verification.md](macos-blocked-verification.md) |
