# win-seam-021rc3-issue-3776 — command ledger

Worktree `.worktrees/win-seam-021rc3-issue-3776`, branch `agent/win-seam-021rc3-issue-3776`, base `omnimux` = `dca12ebdd2`.
Host: macOS, Node `v25.8.0`, Yarn `4.18.0` (Corepack). Every command ran in the worktree unless noted.
Long steps were run as `cmd > log 2>&1; echo "REAL_EXIT=$?" >> log`, so the codes below are real exit codes, not piped ones.

| # | Command | REAL_EXIT | Note |
| --- | --- | --- | --- |
| 1 | `bash scripts/worktree.sh new win-seam-021rc3-issue-3776 omnimux --type agent` | 0 | created `.worktrees/win-seam-021rc3-issue-3776` on `agent/win-seam-021rc3-issue-3776` from `omnimux` |
| 2 | `corepack yarn install --immutable` | 0 | `Done with warnings in 1m 28s`; the 3.3 GB Yarn cache was warm, so no real download step |
| 3 | `git submodule update --init --reference <primary>/.git/modules/deepseek-harness deepseek-harness` | 0 | 18.3 s; checked out `1f81c047fc48fa190a683e469daa699857e9afe8`, matching `upstream.json`. The worktree starts with no submodule checkout, which is why #15 fails |
| 4 | `corepack yarn typecheck` (root) | 0 | desktop + market |
| 5 | `corepack yarn build` (root) | 0 | precondition for the package specs: `tests/package.spec.ts:405-416` asserts built `lib/**` artifacts exist |
| 6 | `corepack yarn workspace dsh-community-market vitest run tests/market-settings-persistence.spec.ts` | 0 | after the fix: `4 passed`. Before it, CI showed `2 failed \| 270 passed (272)` in this file |
| 7 | `corepack yarn workspace dsh-plugin-desktop vitest run tests/package.spec.ts tests/windows-pwsh-sandbox.spec.ts tests/profile.spec.ts` | 0 | `103 passed \| 1 skipped` |
| 8 | `node --input-type=module -e "…import.meta.resolve('dsh-plugin-desktop/windows-acl-sandbox-provider')…"` | 0 | resolves to `lib/windows-acl-sandbox-provider.js`; default export `DesktopWindowsAclSandboxProvider`; `Object.getPrototypeOf(proto) === LocalSandboxProvider.prototype` → `true`; `prototype.confine` overridden → `true`; `DesktopWindowsPwshSandbox.prototype.resolve` overridden → `true` |
| 9 | `node -e "…readFileSync(@deepseek-ai/dsh-win32-process/lib/index.js)…"` | 0 | `dwFlags: 257,` ×2 and `wShowWindow: 0,` ×2 in the shipped `0.2.1-rc.3` runtime |
| 10 | `node --input-type=module -e "…new Context(); ctx.plugin(probe)…"` | 0 | inside a plugin's `apply`: `ctx.settings` → `THREW: cannot get property "settings" without inject`; `ctx.get('settings')` → `undefined` |
| 11 | mutation check: replace the provider's `return` with `return confined`, run #7's windows spec, then restore | vitest **1**, source restored | `FAIL tests/windows-pwsh-sandbox.spec.ts > desktop Windows ACL sandbox provider seam > inserts the trampoline into the argv the upstream provider already confined`; `Tests 1 failed \| 14 passed (15)`; `git diff` on the provider file empty afterwards, so the seam test has teeth |
| 12 | `corepack yarn workspace dsh-plugin-desktop vitest run <the 13-file check:win-package list>` | 0 | `13 passed (13)`, `245 passed \| 3 skipped (248)` — the same 248 the Windows CI job reports as `1 failed \| 247 passed` |
| 13 | `corepack yarn run verify:closure` (desktop) | 0 | `319 first-party nodes form a closed reachable runtime graph` |
| 14 | `corepack yarn workspace dsh-plugin-desktop typecheck` | 0 | |
| 15 | `corepack yarn check:layout` **before** #3 | **1** | `ENOENT … deepseek-harness/package.json` — the worktree had no submodule checkout |
| 16 | `corepack yarn check:layout` after #3 | 0 | bilingual docs, architecture, vendored runtime, layout |
| 17 | `corepack yarn workspace dsh-plugin-desktop verify:closure` / `verify:cli` / `verify:loader` / `verify:profile` / `verify:licenses` / `verify:operations` | 0 each | |
| 18 | `corepack yarn check:bilingual-docs` / `check:architecture` / `check:vendored-runtime` | 0 each | |
| 19 | `corepack yarn workspace dsh-plugin-desktop vitest run tests/managed-profile.spec.ts` (inside a combined run) | 0 | `27 passed \| 1 skipped` |
| 20 | `corepack yarn workspace dsh-plugin-desktop test` — the full 146-file desktop suite | **not completed** | stalls inside `tests/host-process-integration.spec.ts`, which forks a real Host child and boots the full web profile; every other file reached green before it. See [macos-blocked-verification.md](macos-blocked-verification.md) row 5 |
| 21 | `node scripts/verify-version.mjs` | 0 | `版本一致: 2.0.10` |
| 22 | `git checkout -- dsh-community-market/tests/market-settings-persistence.spec.ts` (to capture a local pre-fix run) | **blocked** | repo hook: "严禁在主 checkout 通过 git 变异子命令改写工作树". Not bypassed; the pre-fix evidence comes from the CI log instead (`check` job @ `40178415243`) |

## CI evidence read (not produced locally)

| Command | Result |
| --- | --- |
| `gh api repos/laozhong86/omnimux-desktop-fork/actions/runs/40178415243/jobs` | `changes` success; `check`, `desktop-macos`, `desktop-windows` failure; `upstream-command-windows` success |
| `gh run view --job 121124139811 --log-failed` (desktop-windows) | one failed test: `tests/package.spec.ts > published package surface > keeps Electron out of production dependencies consumed by electron-builder` — `AssertionError: expected '43.0.0' to be '43.3.0'`; `1 failed \| 247 passed (248)` |
| `gh run view --job 121124139749 --log-failed` (desktop-macos) | the same single assertion; `1 failed \| 133 passed \| 1 skipped` |
| `gh run view --job 121124139759 --log-failed` (check) | `tests/market-settings-persistence.spec.ts:44` `expected { sources: [] } to deeply equal { sources: [ { …(7) } ] }` and `:58` `expected "vi.fn()" to be called with arguments: [ 'dsh-community-market', …(1) ]`; `2 failed \| 270 passed (272)` |
