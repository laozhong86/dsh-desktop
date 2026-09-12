import { describe, expect, it } from 'vitest'
import {
  defaultDesktopFirstRunSettings,
  desktopFirstRunSetupSuppressed,
} from '../src/desktop-first-run.ts'

const DEFAULT_MODE = process.platform === 'linux' ? 'compatibility' : 'advanced'

describe('release-channel first-run policy', () => {
  it('never asks for setup outside the development channel', () => {
    expect(desktopFirstRunSetupSuppressed('dev')).toBe(false)
    expect(desktopFirstRunSetupSuppressed('DEV')).toBe(false)
    expect(desktopFirstRunSetupSuppressed('prod')).toBe(true)
    expect(desktopFirstRunSetupSuppressed('production')).toBe(true)
    expect(desktopFirstRunSetupSuppressed('')).toBe(true)
    expect(desktopFirstRunSetupSuppressed(undefined)).toBe(true)
  })

  it('ships the platform default mode with loopback browser access on', () => {
    const settings = defaultDesktopFirstRunSettings()
    expect(settings.mode).toBe(DEFAULT_MODE)
    expect(settings.openBrowser).toBe(true)
    expect(settings.networkExposure).toBe('loopback')
    expect(settings.notifications.enabled).toBe(true)
  })
})
