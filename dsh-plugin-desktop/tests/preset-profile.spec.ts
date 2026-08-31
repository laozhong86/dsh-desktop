import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { parseDocument } from 'yaml'
import {
  resolveDesktopHarnessHome,
  resolveHarnessHome,
  seedOmnimuxSettings,
} from '../src/preset-profile.ts'

describe('resolveDesktopHarnessHome', () => {
  it('routes OmniMux Dev to ~/.omnimux-dev even when ambient DSH_HOME points at ~/.dsh', () => {
    expect(
      resolveDesktopHarnessHome({
        env: { DSH_HOME: join(homedir(), '.dsh') },
        appName: 'OmniMux Dev',
        userDataDir: join(homedir(), 'Library/Application Support/OmniMux-Dev'),
      }),
    ).toBe(join(homedir(), '.omnimux-dev'))
  })

  it('routes OmniMux Dev via OMNIMUX_CHANNEL=dev without relying on app name', () => {
    expect(
      resolveDesktopHarnessHome({
        env: { DSH_HOME: join(homedir(), '.dsh'), OMNIMUX_CHANNEL: 'dev' },
        appName: '',
        userDataDir: '',
      }),
    ).toBe(join(homedir(), '.omnimux-dev'))
  })

  it('routes OmniMux Release to ~/.omnimux even when ambient DSH_HOME points at ~/.dsh', () => {
    expect(
      resolveDesktopHarnessHome({
        env: { DSH_HOME: join(homedir(), '.dsh') },
        appName: 'OmniMux',
        userDataDir: join(homedir(), 'Library/Application Support/OmniMux'),
      }),
    ).toBe(join(homedir(), '.omnimux'))
  })

  it('keeps upstream DSH Desktop on explicit DSH_HOME / ~/.dsh', () => {
    const custom = '/tmp/custom-dsh-home'
    expect(
      resolveDesktopHarnessHome({
        env: { DSH_HOME: custom },
        appName: 'DSH Desktop',
        userDataDir: join(homedir(), 'Library/Application Support/DSH Desktop'),
      }),
    ).toBe(custom)

    expect(
      resolveDesktopHarnessHome({
        env: {},
        appName: 'DSH Desktop',
        userDataDir: join(homedir(), 'Library/Application Support/DSH Desktop'),
      }),
    ).toBe(join(homedir(), '.dsh'))
  })

  it('resolveHarnessHome remains identity-aware for OmniMux channel env', () => {
    expect(resolveHarnessHome({ OMNIMUX_CHANNEL: 'dev', DSH_HOME: join(homedir(), '.dsh') }))
      .toBe(join(homedir(), '.omnimux-dev'))
    expect(resolveHarnessHome({ OMNIMUX_CHANNEL: 'prod', DSH_HOME: join(homedir(), '.dsh') }))
      .toBe(join(homedir(), '.omnimux'))
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
