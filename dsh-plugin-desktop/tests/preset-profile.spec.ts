import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { parseDocument } from 'yaml'
import {
  resolveDesktopHarnessHome,
  seedOmnimuxSettings,
} from '../src/preset-profile.ts'

describe('resolveDesktopHarnessHome', () => {
  it('respects explicit DSH_HOME environment variable', () => {
    const custom = '/tmp/custom-dsh-home'
    expect(resolveDesktopHarnessHome({ env: { DSH_HOME: custom } })).toBe(custom)
  })

  it('routes OmniMux Dev variant to ~/.omnimux-dev even with ambient DSH_HOME', () => {
    expect(
      resolveDesktopHarnessHome({
        env: { DSH_HOME: "/Users/test/.dsh" },
        appName: 'OmniMux Dev',
        userDataDir: '/Users/test/Library/Application Support/OmniMux-Dev',
      }),
    ).toBe(join(homedir(), '.omnimux-dev'))

    expect(
      resolveDesktopHarnessHome({
        env: {},
        appName: 'OmniMux Dev',
        userDataDir: '/Users/test/Library/Application Support/OmniMux-Dev',
      }),
    ).toBe(join(homedir(), '.omnimux-dev'))

    expect(
      resolveDesktopHarnessHome({
        env: { OMNIMUX_DEV: '1' },
        appName: '',
        userDataDir: '',
      }),
    ).toBe(join(homedir(), '.omnimux-dev'))
  })

  it('routes OmniMux Release to ~/.omnimux', () => {
    expect(
      resolveDesktopHarnessHome({
        env: {},
        appName: 'OmniMux',
        userDataDir: '/Users/test/Library/Application Support/OmniMux',
      }),
    ).toBe(join(homedir(), '.omnimux'))
  })

  it('falls back to standard ~/.dsh for upstream DSH Desktop', () => {
    expect(
      resolveDesktopHarnessHome({
        env: {},
        appName: 'DSH Desktop',
        userDataDir: '/Users/test/Library/Application Support/DSH Desktop',
      }),
    ).toBe(join(homedir(), '.dsh'))
  })
})

describe('seedOmnimuxSettings', () => {
  it('creates clean compatibility settings when target home is fresh', () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'omnimux-home-'))
    try {
      seedOmnimuxSettings(tempHome)
      const settingsFile = join(tempHome, 'settings.yaml')
      expect(existsSync(settingsFile)).toBe(true)

      const doc = parseDocument(readFileSync(settingsFile, 'utf8'))
      const js = doc.toJS() as Record<string, any>
      expect(js['dsh-desktop']).toBeDefined()
      expect(js['dsh-desktop'].mode).toBe('compatibility')
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  it('preserves existing settings without overwriting on subsequent seeds', () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'omnimux-home-existing-'))
    try {
      const settingsFile = join(tempHome, 'settings.yaml')
      const customConfig = [
        'locale:',
        '  preference: en',
        'agent-default-model:',
        '  model: custom-user-model',
        'dsh-desktop:',
        '  mode: compatibility',
        '',
      ].join('\n')
      writeFileSync(settingsFile, customConfig)

      seedOmnimuxSettings(tempHome)

      const after = readFileSync(settingsFile, 'utf8')
      expect(after).toBe(customConfig)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })
})
