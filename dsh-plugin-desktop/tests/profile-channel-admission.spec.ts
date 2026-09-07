import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { clearDesktopProfileUsageHistory, desktopReleaseUserDataLocations } from '../src/profile-channel-admission.ts'
import { DesktopProfileCheckpoint } from '../src/profile-checkpoint.ts'
import { completeOrSkipDesktopSetupWizard, readDesktopSetupWizardState } from '../src/setup-wizard-state.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it('clears only the current desktop data directory and selected Profile', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omnimux-profile-usage-'))
  roots.push(root)
  const home = join(root, 'home')
  const profile = join(home, 'profiles', 'work')
  const dev = join(root, 'OmniMux-Dev')
  const prod = join(root, 'OmniMux')
  mkdirSync(profile, { recursive: true })
  writeFileSync(join(profile, 'package.json'), '{"name":"work"}\n')
  const manifests: string[] = []
  for (const userDataDir of [dev, prod]) {
    mkdirSync(userDataDir, { recursive: true })
    const checkpoint = new DesktopProfileCheckpoint({
      userDataDir, profileDir: profile, homeDir: home, profileName: 'work',
      provider: 'dsh-market', appVersion: '2.0.5', dshVersion: '0.1.2-rc.1',
    }).captureHealthy()
    if (checkpoint.status !== 'captured') throw new Error('expected captured checkpoint')
    manifests.push(join(checkpoint.snapshotDirectory, 'manifest.json'))
    await completeOrSkipDesktopSetupWizard(userDataDir, profile, 'completed', {
      desktopVersion: '2.0.5', dshVersion: '0.1.2-rc.1', setupRevision: 1,
    })
  }
  clearDesktopProfileUsageHistory(desktopReleaseUserDataLocations(root, dev), profile)
  expect(existsSync(manifests[0]!)).toBe(false)
  expect(readDesktopSetupWizardState(dev, profile)).toBeUndefined()
  expect(existsSync(manifests[1]!)).toBe(true)
  expect(readDesktopSetupWizardState(prod, profile)).toBeDefined()
  expect(existsSync(join(profile, 'package.json'))).toBe(true)
})
