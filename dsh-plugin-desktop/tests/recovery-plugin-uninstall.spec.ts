import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  formatRecoveryPluginRemoveFailure,
  recoveryPluginEnvironment,
  RecoveryPluginUninstallError,
  removeRecoveryPlugin,
} from '../src/recovery-plugin-uninstall.ts'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

function fixture(source: string) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-recovery-plugin-uninstall-'))
  roots.push(root)
  const profileDir = join(root, 'home', 'profiles', 'desktop')
  const nodeBinDir = join(root, 'runtime', 'node-bin')
  const pnpmBinDir = join(root, 'runtime', 'pnpm-bin')
  mkdirSync(profileDir, { recursive: true })
  mkdirSync(nodeBinDir, { recursive: true })
  mkdirSync(pnpmBinDir, { recursive: true })
  const dshBootstrapPath = join(root, 'desktop-cli.mjs')
  writeFileSync(dshBootstrapPath, source)
  return {
    appExecutable: process.execPath,
    dshBootstrapPath,
    profileName: 'desktop',
    profileDir,
    homeDir: join(root, 'home'),
    nodeBinDir,
    nodeShimPath: join(nodeBinDir, 'node'),
    pnpmBinDir,
    electronVersion: '43.4.0',
    packageName: 'third-party-plugin',
  }
}

describe('pre-Host recovery plugin uninstall command', () => {
  it('pins packaged Node and pnpm ahead of a released or hostile system PATH', () => {
    const options = fixture('')
    const systemBin = join(dirname(options.profileDir), 'system-bin')
    const environment = recoveryPluginEnvironment({
      ...options,
      environment: { PATH: systemBin, KEEP: 'value' },
    })

    expect(environment.PATH?.split(delimiter)).toEqual([
      options.nodeBinDir,
      options.pnpmBinDir,
      systemBin,
    ])
    expect(environment).toMatchObject({
      NODE: options.nodeShimPath,
      ELECTRON_RUN_AS_NODE: '1',
      DSH_HOME: options.homeDir,
      KEEP: 'value',
    })
  })

  it('normalizes the case-insensitive Windows PATH before projecting recovery commands', () => {
    const options = fixture('')
    const systemBin = 'C:\\System Pnpm'
    const environment = recoveryPluginEnvironment({
      ...options,
      environment: { Path: systemBin, KEEP: 'value' },
    }, 'win32')

    expect(environment.PATH).toBe(`${options.nodeBinDir};${options.pnpmBinDir};${systemBin}`)
    expect(environment).not.toHaveProperty('Path')
    expect(environment.KEEP).toBe('value')
  })

  it('runs the packaged official dsh plugin remove argv for the selected Profile', async () => {
    const options = fixture(`process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), home: process.env.DSH_HOME, path: process.env.PATH }))\n`)
    const systemBin = join(dirname(options.profileDir), 'system-bin')
    const result = await removeRecoveryPlugin({ ...options, environment: { PATH: systemBin } })
    expect(JSON.parse(result.stdout)).toEqual({
      argv: ['plugin', '--profile', 'desktop', 'remove', 'third-party-plugin'],
      home: options.homeDir,
      path: [options.nodeBinDir, options.pnpmBinDir, systemBin].join(delimiter),
    })
    expect(result).toMatchObject({
      packageName: 'third-party-plugin',
      profileName: 'desktop',
      exitCode: 0,
    })
  })

  // Upstream now refuses to let the CLI manage the desktop profile, so the
  // pre-Host recovery path cannot remove the dependency through it. The shell
  // surfaces that refusal instead of silently succeeding. Re-implementing the
  // removal with the packaged pnpm plus the bundle reconciliation is tracked as
  // the remaining follow-up for this upgrade.
  it('surfaces the upstream refusal when the CLI cannot manage the desktop profile', async () => {
    const base = fixture('')
    const dshBootstrapPath = join(import.meta.dirname, '../lib/desktop-cli.js')
    let failure: unknown
    try {
      await removeRecoveryPlugin({ ...base, dshBootstrapPath })
    } catch (cause) { failure = cause }
    expect(failure).toBeInstanceOf(RecoveryPluginUninstallError)
    expect(formatRecoveryPluginRemoveFailure(failure as RecoveryPluginUninstallError))
      .toContain('managed exclusively by the Electron application')
  })
  it('retains bounded command diagnostics when dsh plugin remove fails', async () => {
    const options = fixture(`process.stderr.write('simulated remove failure\\n'); process.exitCode = 7\n`)
    let failure: unknown
    try { await removeRecoveryPlugin(options) } catch (cause) { failure = cause }
    expect(failure).toBeInstanceOf(RecoveryPluginUninstallError)
    const detail = formatRecoveryPluginRemoveFailure(failure)
    expect(detail).toContain('dsh plugin --profile desktop remove third-party-plugin')
    expect(detail).toContain('Package-manager policy: --config.minimumReleaseAge=0')
    expect(detail).toContain('Exit status: 7')
    expect(detail).toContain('simulated remove failure')
  })
})
