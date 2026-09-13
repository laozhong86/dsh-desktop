/**
 * First-run policy.
 *
 * Every channel starts with deterministic shipped defaults: the platform
 * default window mode (enhanced mode on macOS and Windows) with loopback browser
 * access already on. First-run Setup is suppressed by default across all channels
 * unless explicitly requested via OMNIMUX_FORCE_SETUP_WIZARD.
 */

import { defaultDesktopShellMode } from './desktop-mode-default.ts'
import {
  defaultDesktopSetupWizardSettings,
  type DesktopSetupWizardSettings,
} from './setup-wizard-settings.ts'

/** First-run Setup is suppressed across all standard channels unless explicitly forced. */
export function desktopFirstRunSetupSuppressed(_channel?: string): boolean {
  if (process.env.OMNIMUX_FORCE_SETUP_WIZARD === '1') return false
  return true
}

/** Shipped first-run settings: the platform default mode with browser access on. */
export function defaultDesktopFirstRunSettings(): DesktopSetupWizardSettings {
  return Object.freeze({
    ...defaultDesktopSetupWizardSettings(),
    mode: defaultDesktopShellMode(),
    openBrowser: true,
  })
}
