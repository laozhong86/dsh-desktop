import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { resolveDesktopHarnessHome, resolveHarnessHome } from '../src/preset-profile.ts'

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
