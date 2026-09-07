/** Profile usage cleanup in the current desktop data directory. */
import { isAbsolute, resolve } from 'node:path'
import { clearDesktopProfileCheckpoint } from './profile-checkpoint.ts'
import { clearDesktopSetupWizardStateSync } from './setup-wizard-state.ts'

export interface DesktopReleaseUserDataLocations {
  readonly userDataDir: string
}

export function desktopReleaseUserDataLocations(
  _appDataDir: string,
  currentUserDataDir: string,
): DesktopReleaseUserDataLocations {
  if (!isAbsolute(currentUserDataDir) || currentUserDataDir.includes('\0')) {
    throw new TypeError('dsh-plugin-desktop: user-data directory must be absolute without NUL')
  }
  return Object.freeze({ userDataDir: resolve(currentUserDataDir) })
}

export function clearDesktopProfileUsageHistory(
  locations: DesktopReleaseUserDataLocations,
  profileDir: string,
): void {
  clearDesktopProfileCheckpoint(locations.userDataDir, profileDir)
  clearDesktopSetupWizardStateSync(locations.userDataDir, profileDir)
}
