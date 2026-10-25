import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { DSH_1024STORE_ADAPTER_ID, DSH_1024STORE_PROVIDER_ID } from '../src/adapters/dsh-1024store.js'
import { SettingsCatalogSourceStore, type MarketSettingsDocument } from '../src/catalog/source-store.js'
import type { LocalSourceRecord } from '../src/contracts/index.js'
import { MARKET_SETTINGS_NAMESPACE, registerMarketSettings } from '../src/host/routes.js'

const source: LocalSourceRecord = {
  sourceRecordId: '018f1f77-a5c4-7b73-a9ae-0242ac120002',
  registrationKind: 'built-in',
  adapterId: DSH_1024STORE_ADAPTER_ID,
  providerId: DSH_1024STORE_PROVIDER_ID,
  builtInProviderKey: 'dsh-1024store',
  enabled: true,
  order: 0,
}

interface Descriptor {
  ns: string
  value: unknown
}

/**
 * The settings service derives a namespace's value from its profile entry, so
 * cross-restart persistence is owned by the service rather than the market.
 * What remains the market's responsibility is addressing its own namespace and
 * reading the resolved value, which is what these cases pin down.
 *
 * The stand-in mirrors the real Cordis context: `get(name)` is the lookup the
 * market uses, because reading `ctx.settings` on a fiber-backed context without
 * the inject requirement throws instead of returning undefined.
 */
function serviceContext(descriptors: Descriptor[]) {
  const describe = vi.fn(() => descriptors)
  const update = vi.fn(async () => {})
  const replace = vi.fn(async () => {})
  const settings = { describe, update, replace }
  const ctx = { get: (name: string) => (name === 'settings' ? settings : undefined) } as unknown as Context
  return { ctx, describe, update, replace }
}

describe('community market settings handle', () => {
  it('reads the resolved value of its own namespace', () => {
    const { ctx } = serviceContext([
      { ns: 'market-persistence-fixture', value: { label: 'sibling' } },
      { ns: MARKET_SETTINGS_NAMESPACE, value: { sources: [source] } },
    ])

    expect(registerMarketSettings(ctx).get()).toEqual({ sources: [source] } satisfies MarketSettingsDocument)
  })

  it('falls back to the schema defaults before its entry publishes a form', () => {
    const { ctx } = serviceContext([])

    expect(registerMarketSettings(ctx).get()).toEqual({ sources: [] } satisfies MarketSettingsDocument)
  })

  it('reads only the on-demand lookup, never a bare settings property', async () => {
    // The Electron-managed desktop profile composes no settings entry, so the
    // lookup has to stay non-blocking: schema defaults, and writes that no-op.
    const describe = vi.fn(() => [{ ns: MARKET_SETTINGS_NAMESPACE, value: { sources: [source] } }])
    const update = vi.fn(async () => {})
    const ctx = { get: () => undefined, settings: { describe, update } } as unknown as Context
    const scope = registerMarketSettings(ctx)

    expect(scope.get()).toEqual({ sources: [] } satisfies MarketSettingsDocument)
    await scope.update({ sources: [source] })
    expect(update).not.toHaveBeenCalled()
  })

  it('writes through to its own namespace', async () => {
    const { ctx, update, replace } = serviceContext([])
    const scope = registerMarketSettings(ctx)

    await new SettingsCatalogSourceStore(scope).save([source])
    expect(update).toHaveBeenCalledWith(MARKET_SETTINGS_NAMESPACE, { sources: [source] })

    await scope.replace({ sources: [source] })
    expect(replace).toHaveBeenCalledWith(MARKET_SETTINGS_NAMESPACE, { sources: [source] })
  })
})
