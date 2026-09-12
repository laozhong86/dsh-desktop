/**
 * Release-channel first-run policy.
 *
 * A release build must not ask anything before it works: the channels users
 * install start with the platform default window mode and loopback browser
 * access on, and first-run Setup stays a development surface.
 */

import { defaultDesktopShellMode } from './desktop-mode-default.ts'
import {
  defaultDesktopSetupWizardSettings,
  type DesktopSetupWizardSettings,
} from './setup-wizard-settings.ts'

/** Only the development channel runs first-run Setup; every release skips it. */
export function desktopFirstRunSetupSuppressed(channel: string | undefined): boolean {
  return (channel ?? '').trim().toLowerCase() !== 'dev'
}

/** Shipped first-run settings: the platform default mode with browser access on. */
export function defaultDesktopFirstRunSettings(): DesktopSetupWizardSettings {
  return Object.freeze({
    ...defaultDesktopSetupWizardSettings(),
    mode: defaultDesktopShellMode(),
    openBrowser: true,
  })
}
