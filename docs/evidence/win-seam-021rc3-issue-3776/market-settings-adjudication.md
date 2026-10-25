# Issue #3776 — `market-settings-persistence.spec.ts`: stale fixture, not a functional regression

CI job `check` @ `dca12ebdd2` failed with:

- `tests/market-settings-persistence.spec.ts:44` — `AssertionError: expected { sources: [] } to deeply equal { sources: [ { …(7) } ] }`
- `tests/market-settings-persistence.spec.ts:58` — `AssertionError: expected "vi.fn()" to be called with arguments: [ 'dsh-community-market', …(1) ]`

**Verdict: the test fixture is stale. The product behaviour is the one Issue #3775 asks for** — the market skips its settings namespace when the service is absent and uses it when present. No functionality was lost.

## Evidence chain

**1. The fixture models an interface the implementation no longer reads.**

`tests/market-settings-persistence.spec.ts:29-35` builds `{ settings: { describe, update, replace } }` — a plain object carrying a `settings` **property** and no `get`. The implementation reads the service through the on-demand lookup instead: `src/host/routes.ts:1230-1232`

```ts
const service = settings
  ?? (typeof ctx.get === 'function' ? ctx.get('settings') as MarketSettingsService | undefined : undefined)
  ?? undefined
```

**2. Both sides were rewritten once, then only one side again.**

| Commit | Change | Test state after |
| --- | --- | --- |
| before #101 | `ctx.settings.register(MARKET_SETTINGS_NAMESPACE, SETTINGS_SCHEMA, { applies: 'live' })` — the removed registration API (`git show 7f474f3292^:dsh-community-market/src/host/routes.ts:238-239`) | old test booted a real `FileSettingsProvider`; green |
| #101 `7f474f3292` | rewrite to `ctx.settings.describe()/update()/replace()`, plus the plain-object fake and a rewritten test | green |
| #102 `7b0758c1e6` | one line: `?? (ctx as { settings?: MarketSettingsService }).settings` → `?? undefined` — the property fallback is **deleted** | **red** — the fixture still exercises only the deleted path |

The #102 commit message states the reason: "在无 profileContext 的桌面宿主上缺席，兜底会触发依赖拦截。改为 按需取，缺席走默认档。"

**3. Deleting that fallback is correct, and the failure is reproducible without any test.**

Cordis' context proxy trap is `dsh-community-market/node_modules/@deepseek-ai/cordis/lib/index.js:672-697`. On a fiber-backed context whose service is not provided it throws:

```
inside plugin apply, ctx.settings        -> THREW: cannot get property "settings" without inject
inside plugin apply, ctx.get('settings') -> undefined
```

(`ctx.get` is the documented non-blocking read — "Read a service from the store without the inject requirement … returns `undefined` when not (yet) provided", `cordis/lib/types/reflect.d.ts:6-16,114-122`.)

So the property fallback would have crashed the market plugin on the desktop host, and the `ctx.get` form is what keeps activation non-blocking. This is exactly the "按需取而非硬等待" behaviour #3775 describes.

**4. The service really is absent on the desktop host — by upstream design.**

- `@deepseek-ai/dsh-base/cordis.patch.yml:108-111` disables the row unless a profile context exists: `- id: settings` / `name: '@deepseek-ai/dsh-settings'` / `disabled: !!js "!ctx.get('profileContext')"`.
- `@deepseek-ai/dsh-app-boot/lib/types/profile-context.d.ts:36-39`: `/** Present only in a profile launched by dsh. */ profileContext: ProfileContext`.
- `dsh-plugin-desktop/src` never mentions `profileContext`, and the Electron launcher does not launch through `dsh`.

## Fix applied

- `tests/market-settings-persistence.spec.ts`: the stand-in now implements `get(name)`, mirroring a real Cordis context.
- One added case, `reads only the on-demand lookup, never a bare settings property`, pins the #102 behaviour: a context whose lookup reports no service returns the schema defaults, its writes no-op, and the bare `settings` property is never consulted. Without it, "fixing" the red by restoring the property fallback would go unnoticed.

## Open observation (not a regression, not changed here)

Because the `settings` row is disabled on a desktop-launched profile, the market's source selection falls back to schema defaults there rather than persisting across restarts. That is upstream's profile-context rule combined with #101/#102's deliberate "skip when absent" choice. Whether the desktop profile should mount its own settings seat is a product decision outside Issue #3776; it is recorded here so it is not mistaken for something this task fixed.
