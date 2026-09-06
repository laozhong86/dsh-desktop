import { describe, expect, it } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { parseDocument } from 'yaml'
import {
  completeOmnimuxProfileMaterialization,
  PROFILE_MATERIALIZATION_PENDING,
  resolveDesktopHarnessHome,
  resolveHarnessHome,
  replaceManagedHub,
  seedOmnimuxProfile,
  seedOmnimuxSettings,
} from '../src/preset-profile.ts'
import { managedDependencySpec, managedSourcePath } from '../src/managed-profile.ts'
import { materializeProfile } from '../src/profile-materializer.ts'

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, undefined, 2)}\n`)
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

const LIFECYCLE = {
  'omnimux-accounts': { stage: 'alpha', toolPrefixes: ['omnimux_accounts_'] },
  'omnimux-publish': { stage: 'alpha', toolPrefixes: ['omnimux_publish_'] },
  'omnimux-analytics': { stage: 'alpha', toolPrefixes: ['omnimux_analytics_'] },
} as const

describe('hub policy replacement recovery', () => {
  for (const rollbackFails of [false, true]) {
    it(`preserves the previous hub when publish fails and rollback ${rollbackFails ? 'fails' : 'succeeds'}`, () => {
      const root = mkdtempSync(join(tmpdir(), 'omnimux-hub-recovery-'))
      try {
        const installed = join(root, 'managed', 'omnimux')
        const staging = join(root, '.release-policy')
        const candidate = join(staging, 'omnimux')
        mkdirSync(installed, { recursive: true })
        mkdirSync(candidate, { recursive: true })
        writeFileSync(join(installed, 'previous'), 'recoverable')
        let calls = 0
        const rename: typeof renameSync = (from, to) => {
          calls++
          if (calls === 2 || (rollbackFails && calls === 3)) throw new Error('injected rename failure')
          renameSync(from, to)
        }
        expect(() => replaceManagedHub(installed, candidate, rename)).toThrow(rollbackFails ? /previous hub retained at/ : /injected rename failure/)
        rmSync(staging, { recursive: true, force: true })
        const backups = readdirSync(join(root, 'managed')).filter(name => name.startsWith('.omnimux-previous-'))
        if (rollbackFails) {
          expect(backups).toHaveLength(1)
          expect(readFileSync(join(root, 'managed', backups[0]!, 'omnimux', 'previous'), 'utf8')).toBe('recoverable')
        } else {
          expect(backups).toHaveLength(0)
          expect(readFileSync(join(installed, 'previous'), 'utf8')).toBe('recoverable')
        }
      } finally { rmSync(root, { recursive: true, force: true }) }
    })
  }
})

function createPreset(root: string, complete = true, channel: 'production' | 'development' = 'development'): string {
  const preset = join(root, 'preset')
  const skeleton = join(preset, 'skeleton')
  const alphaPackages = ['omnimux-accounts', 'omnimux-publish', 'omnimux-analytics']
  const productPackages = channel === 'production'
    ? ['omnimux-assets', 'omnimux-workflow']
    : ['omnimux-accounts', 'omnimux-assets', 'omnimux-workflow', 'omnimux-publish', 'omnimux-analytics']
  mkdirSync(skeleton, { recursive: true })
  writeJson(join(skeleton, 'package.json'), {
    name: 'dsh-profile-omnimux',
    dependencies: {},
    dsh: { profile: { bundles: [
      '@deepseek-ai/dsh-base',
      '@deepseek-ai/dsh-web-app',
      'dsh-better-sidebar',
      'omnimux',
      ...productPackages,
    ] } },
  })
  writeFileSync(join(skeleton, 'cordis.patch.yml'), '[]\n')
  writeFileSync(join(skeleton, 'pnpm-workspace.yaml'), 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
  writeFileSync(join(preset, 'seed-version'), '5\n')
  const packages = ['dsh-better-sidebar', 'omnimux', ...productPackages]
  writeJson(join(preset, 'owned-packages.json'), packages)
  for (const name of packages) {
    if (!complete && name === 'omnimux-workflow') continue
    const directory = join(preset, 'plugins', name)
    mkdirSync(directory, { recursive: true })
    writeJson(join(directory, 'package.json'), { name, version: '1.0.0', main: 'index.js' })
    writeFileSync(join(directory, 'index.js'), `module.exports = ${JSON.stringify(name)}\n`)
  }
  const hubSource = join(preset, 'plugins', 'omnimux', 'src')
  mkdirSync(hubSource)
  writeJson(join(hubSource, 'plugin-lifecycle.json'), LIFECYCLE)
  writeJson(join(hubSource, 'release-channel.json'), { channel })
  const gateSource = join(hubSource, 'gate')
  mkdirSync(gateSource)
  writeFileSync(join(gateSource, 'guard.js'), `export const fixtureChannel = ${JSON.stringify(channel)}\n`)
  if (channel === 'production') {
    for (const name of alphaPackages) rmSync(join(preset, 'plugins', name), { recursive: true, force: true })
  }
  return preset
}

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

describe('seedOmnimuxProfile managed sources', () => {
  it('creates a fresh Profile with stable sources and declarations outside node_modules', () => {
    const root = mkdtempSync(join(tmpdir(), 'omnimux-managed-seed-'))
    try {
      const presetDir = createPreset(root)
      const home = join(root, 'home')
      const result = seedOmnimuxProfile({ home, presetDir })
      const manifest = JSON.parse(readFileSync(join(result.profileDir, 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>
      }
      expect(result).toMatchObject({ created: true, refreshedPlugins: true })
      expect(manifest.dependencies.omnimux).toBe(managedDependencySpec('omnimux'))
      expect(readFileSync(join(managedSourcePath(result.profileDir, 'omnimux'), 'index.js'), 'utf8'))
        .toContain('omnimux')
      expect(existsSync(join(result.profileDir, 'node_modules'))).toBe(false)
      expect(result.materializationRequired).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('creates a production Profile from the staged bundle set without Alpha packages', () => {
    const root = mkdtempSync(join(tmpdir(), 'omnimux-managed-production-'))
    try {
      const presetDir = createPreset(root, true, 'production')
      const home = join(root, 'home')
      const result = seedOmnimuxProfile({ home, presetDir })
      const manifest = JSON.parse(readFileSync(join(result.profileDir, 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>
        dsh: { profile: { bundles: string[] } }
      }

      expect(manifest.dsh.profile.bundles).toEqual([
        '@deepseek-ai/dsh-base',
        '@deepseek-ai/dsh-web-app',
        'dsh-better-sidebar',
        'omnimux',
        'omnimux-assets',
        'omnimux-workflow',
      ])
      expect(Object.keys(manifest.dependencies)).toEqual(expect.arrayContaining([
        'dsh-better-sidebar',
        'omnimux',
        'omnimux-assets',
      ]))
      expect(manifest.dependencies).not.toHaveProperty('omnimux-accounts')
      expect(manifest.dependencies).toHaveProperty('omnimux-workflow')
      expect(existsSync(managedSourcePath(result.profileDir, 'omnimux-accounts'))).toBe(false)
      expect(existsSync(managedSourcePath(result.profileDir, 'omnimux-workflow'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an empty packaged lifecycle registry before creating a Profile', () => {
    const root = mkdtempSync(join(tmpdir(), 'omnimux-managed-empty-lifecycle-'))
    try {
      const presetDir = createPreset(root, true, 'production')
      const home = join(root, 'home')
      writeJson(join(presetDir, 'plugins', 'omnimux', 'src', 'plugin-lifecycle.json'), {})

      expect(() => seedOmnimuxProfile({ home, presetDir }))
        .toThrow('plugin lifecycle registry must contain at least one entry')
      expect(existsSync(join(home, 'profiles', 'omnimux'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('removes Alpha and installs the production hub when an existing same-version Profile upgrades', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omnimux-managed-alpha-upgrade-'))
    try {
      const developmentPreset = createPreset(join(root, 'development'))
      const productionPreset = createPreset(join(root, 'production'), true, 'production')
      const home = join(root, 'home')
      const first = seedOmnimuxProfile({ home, presetDir: developmentPreset })
      const preloader = join(root, 'clear-env.mjs')
      writeFileSync(preloader, '')
      const materializer = {
        appExecutable: process.execPath,
        clearEnvironmentPath: preloader,
        pnpmBinPath: join(dirname(createRequire(import.meta.url).resolve('pnpm')), 'bin/pnpm.mjs'),
        nodeBinDir: dirname(process.execPath),
        nodeShimPath: process.execPath,
        homeDir: home,
        profileDir: first.profileDir,
        electronVersion: '43.3.0',
        updateLockfile: true,
      }
      await materializeProfile(materializer)
      expect(readJson(join(first.profileDir, 'node_modules/omnimux/src/release-channel.json'))).toEqual({ channel: 'development' })
      completeOmnimuxProfileMaterialization(first.profileDir)
      for (const name of ['omnimux-accounts', 'omnimux-publish', 'omnimux-analytics']) {
        const installed = join(first.profileDir, 'node_modules', name)
        mkdirSync(installed, { recursive: true })
        writeJson(join(installed, 'package.json'), { name, version: '1.0.0' })
      }
      const userPackage = join(first.profileDir, 'node_modules', 'user-package')
      mkdirSync(userPackage, { recursive: true })
      writeJson(join(userPackage, 'package.json'), { name: 'user-package', version: '1.0.0' })

      const upgraded = seedOmnimuxProfile({ home, presetDir: productionPreset })
      const manifest = JSON.parse(readFileSync(join(first.profileDir, 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>
        dsh: { profile: { bundles: string[] } }
      }

      expect(upgraded).toMatchObject({ created: false, refreshedPlugins: true, materializationRequired: true })
      expect(manifest.dsh.profile.bundles).not.toContain('omnimux-accounts')
      expect(manifest.dsh.profile.bundles).not.toContain('omnimux-publish')
      expect(manifest.dsh.profile.bundles).not.toContain('omnimux-analytics')
      expect(manifest.dsh.profile.bundles).toContain('omnimux-workflow')
      expect(manifest.dependencies).not.toHaveProperty('omnimux-accounts')
      expect(manifest.dependencies).not.toHaveProperty('omnimux-publish')
      expect(manifest.dependencies).not.toHaveProperty('omnimux-analytics')
      expect(manifest.dependencies).toHaveProperty('omnimux-workflow')
      expect(existsSync(managedSourcePath(first.profileDir, 'omnimux-accounts'))).toBe(false)
      expect(existsSync(managedSourcePath(first.profileDir, 'omnimux-publish'))).toBe(false)
      expect(existsSync(managedSourcePath(first.profileDir, 'omnimux-analytics'))).toBe(false)
      expect(existsSync(managedSourcePath(first.profileDir, 'omnimux-workflow'))).toBe(true)
      expect(existsSync(join(first.profileDir, 'node_modules', 'omnimux-accounts'))).toBe(false)
      expect(existsSync(join(first.profileDir, 'node_modules', 'omnimux-publish'))).toBe(false)
      expect(existsSync(join(first.profileDir, 'node_modules', 'omnimux-analytics'))).toBe(false)
      expect(existsSync(userPackage)).toBe(true)
      expect(readJson(join(managedSourcePath(first.profileDir, 'omnimux'), 'src', 'release-channel.json')))
        .toEqual({ channel: 'production' })
      expect(readFileSync(join(managedSourcePath(first.profileDir, 'omnimux'), 'src', 'gate', 'guard.js'), 'utf8'))
        .toContain('production')

      expect(seedOmnimuxProfile({ home, presetDir: productionPreset }))
        .toMatchObject({ created: false, refreshedPlugins: false, materializationRequired: true })
      await materializeProfile(materializer)
      expect(readJson(join(first.profileDir, 'node_modules/omnimux/src/release-channel.json'))).toEqual({ channel: 'production' })
      expect(readFileSync(join(first.profileDir, 'node_modules/omnimux/src/gate/guard.js'), 'utf8')).toContain('production')
      for (const name of ['omnimux-accounts', 'omnimux-publish', 'omnimux-analytics']) {
        expect(existsSync(join(first.profileDir, 'node_modules', name))).toBe(false)
      }
      completeOmnimuxProfileMaterialization(first.profileDir)
      expect(seedOmnimuxProfile({ home, presetDir: productionPreset }))
        .toMatchObject({ created: false, refreshedPlugins: false, materializationRequired: false })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('keeps a failed first materialization retryable on the next startup', () => {
    const root = mkdtempSync(join(tmpdir(), 'omnimux-managed-retry-'))
    try {
      const presetDir = createPreset(root)
      const home = join(root, 'home')
      const first = seedOmnimuxProfile({ home, presetDir })
      expect(first.materializationRequired).toBe(true)
      expect(seedOmnimuxProfile({ home, presetDir }).materializationRequired).toBe(true)
      completeOmnimuxProfileMaterialization(first.profileDir)
      expect(seedOmnimuxProfile({ home, presetDir }).materializationRequired).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('retries interrupted fresh initialization states before the manifest commit point', () => {
    for (const phase of ['partial-copy', 'stamp-write', 'pending-write'] as const) {
      const root = mkdtempSync(join(tmpdir(), `omnimux-managed-${phase}-`))
      try {
        const presetDir = createPreset(root)
        const home = join(root, 'home')
        const profile = join(home, 'profiles', 'omnimux')
        const plugins = join(profile, '.materialize-snapshots', 'plugins')
        mkdirSync(plugins, { recursive: true })
        if (phase === 'partial-copy') {
          mkdirSync(join(plugins, 'omnimux'))
          writeFileSync(join(plugins, 'omnimux', 'index.js'), 'partial copy\n')
          const staleCandidate = join(home, 'profiles', '.omnimux-initializing')
          mkdirSync(staleCandidate)
          writeFileSync(join(staleCandidate, 'partial'), 'interrupted candidate\n')
        } else {
          cpSync(join(presetDir, 'plugins'), plugins, { recursive: true })
        }
        if (phase === 'pending-write') writeFileSync(join(profile, '.omnimux-seed-version'), '5\n')
        mkdirSync(join(plugins, 'user-snapshot'), { recursive: true })
        writeFileSync(join(plugins, 'user-snapshot', 'keep.txt'), 'preserve me\n')
        writeFileSync(join(profile, 'cordis.patch.yml'), 'custom: true\n')

        const result = seedOmnimuxProfile({ home, presetDir })

        expect(result).toMatchObject({ created: true, materializationRequired: true })
        expect(readFileSync(join(managedSourcePath(profile, 'omnimux'), 'package.json'), 'utf8')).toContain('"omnimux"')
        expect(readFileSync(join(plugins, 'user-snapshot', 'keep.txt'), 'utf8')).toBe('preserve me\n')
        expect(readFileSync(join(profile, 'cordis.patch.yml'), 'utf8')).toBe('custom: true\n')
        expect(existsSync(join(profile, PROFILE_MATERIALIZATION_PENDING))).toBe(true)
        expect(existsSync(join(profile, 'package.json'))).toBe(true)
        expect(existsSync(join(home, 'profiles', '.omnimux-initializing'))).toBe(false)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('rejects fresh destination boundary symlinks before settings or source writes', () => {
    for (const boundary of ['candidate', 'snapshots', 'plugins', 'scope', 'package'] as const) {
      const root = mkdtempSync(join(tmpdir(), `omnimux-fresh-${boundary}-link-`))
      try {
        const presetDir = createPreset(root)
        const home = join(root, 'home')
        const profile = join(home, 'profiles', 'omnimux')
        const outside = join(root, 'outside')
        mkdirSync(outside)
        writeFileSync(join(outside, 'sentinel'), 'untouched\n')
        if (boundary === 'candidate') {
          mkdirSync(join(home, 'profiles'), { recursive: true })
          symlinkSync(outside, join(home, 'profiles', '.omnimux-initializing'))
        } else if (boundary === 'snapshots') {
          mkdirSync(profile, { recursive: true })
          symlinkSync(outside, join(profile, '.materialize-snapshots'))
        } else if (boundary === 'plugins') {
          mkdirSync(join(profile, '.materialize-snapshots'), { recursive: true })
          symlinkSync(outside, join(profile, '.materialize-snapshots', 'plugins'))
        } else {
          const plugins = join(profile, '.materialize-snapshots', 'plugins')
          mkdirSync(plugins, { recursive: true })
          symlinkSync(outside, join(plugins, boundary === 'scope' ? '@scope' : 'omnimux'))
        }

        expect(() => seedOmnimuxProfile({ home, presetDir })).toThrow(/physical directory|symbolic link/u)
        expect(existsSync(join(home, 'settings.yaml'))).toBe(false)
        expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('untouched\n')
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('does not downgrade or rewrite an existing valid managed Profile', () => {
    const root = mkdtempSync(join(tmpdir(), 'omnimux-managed-repeat-'))
    try {
      const presetDir = createPreset(root)
      const home = join(root, 'home')
      const first = seedOmnimuxProfile({ home, presetDir })
      const source = join(managedSourcePath(first.profileDir, 'omnimux'), 'index.js')
      writeFileSync(source, 'module.exports = "newer-synced-content"\n')
      const manifestBefore = readFileSync(join(first.profileDir, 'package.json'))
      const sourceBefore = readFileSync(source)

      expect(seedOmnimuxProfile({ home, presetDir })).toMatchObject({ created: false, refreshedPlugins: false })
      expect(readFileSync(join(first.profileDir, 'package.json'))).toEqual(manifestBefore)
      expect(readFileSync(source)).toEqual(sourceBefore)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a legacy self-reference before repair writes', () => {
    const root = mkdtempSync(join(tmpdir(), 'omnimux-managed-legacy-'))
    try {
      const presetDir = createPreset(root)
      const home = join(root, 'home')
      const profile = join(home, 'profiles', 'omnimux')
      mkdirSync(profile, { recursive: true })
      const manifest = {
        name: 'dsh-profile-omnimux',
        dependencies: { omnimux: 'file:./node_modules/omnimux' },
        dsh: { profile: { bundles: [
          '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-better-sidebar', 'omnimux',
          'omnimux-accounts', 'omnimux-assets', 'omnimux-workflow',
        ] } },
      }
      writeJson(join(profile, 'package.json'), manifest)
      const before = readFileSync(join(profile, 'package.json'))

      expect(() => seedOmnimuxProfile({ home, presetDir }))
        .toThrow('yarn omnimux:profile rebuild --target dev --app <frozen-candidate.app>')
      expect(readFileSync(join(profile, 'package.json'))).toEqual(before)
      expect(existsSync(join(home, 'settings.yaml'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('validates complete packaged source coverage before creating a Profile', () => {
    const root = mkdtempSync(join(tmpdir(), 'omnimux-managed-incomplete-'))
    try {
      const presetDir = createPreset(root, false)
      const home = join(root, 'home')
      expect(() => seedOmnimuxProfile({ home, presetDir })).toThrow('desktop preset is missing omnimux-workflow')
      expect(existsSync(join(home, 'profiles', 'omnimux'))).toBe(false)
      expect(existsSync(join(home, 'settings.yaml'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
