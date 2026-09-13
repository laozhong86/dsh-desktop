import { describe, expect, it } from 'vitest'
import {
  defaultDesktopFirstRunSettings,
  desktopFirstRunSetupSuppressed,
} from '../src/desktop-first-run.ts'

const DEFAULT_MODE = process.platform === 'linux' ? 'compatibility' : 'advanced'

describe('first-run policy', () => {
  it('suppresses first-run setup across all standard channels to settle deterministic defaults', () => {
    expect(desktopFirstRunSetupSuppressed('dev')).toBe(true)
    expect(desktopFirstRunSetupSuppressed('DEV')).toBe(true)
    expect(desktopFirstRunSetupSuppressed('prod')).toBe(true)
    expect(desktopFirstRunSetupSuppressed('production')).toBe(true)
    expect(desktopFirstRunSetupSuppressed('')).toBe(true)
    expect(desktopFirstRunSetupSuppressed(undefined)).toBe(true)
  })

  it('allows explicitly forcing first-run setup via environment flag', () => {
    const original = process.env.OMNIMUX_FORCE_SETUP_WIZARD
    try {
      process.env.OMNIMUX_FORCE_SETUP_WIZARD = '1'
      expect(desktopFirstRunSetupSuppressed('dev')).toBe(false)
      expect(desktopFirstRunSetupSuppressed('prod')).toBe(false)
    } finally {
      if (original === undefined) delete process.env.OMNIMUX_FORCE_SETUP_WIZARD
      else process.env.OMNIMUX_FORCE_SETUP_WIZARD = original
    }
  })

  it('ships the platform default mode with loopback browser access on', () => {
    const settings = defaultDesktopFirstRunSettings()
    expect(settings.mode).toBe(DEFAULT_MODE)
    expect(settings.openBrowser).toBe(true)
    expect(settings.networkExposure).toBe('loopback')
    expect(settings.notifications.enabled).toBe(true)
  })
})
