import { beforeEach, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { createRequire } from 'node:module'

const sidebarFixture = vi.hoisted(() => ({
  path: undefined as string | undefined,
  buildError: undefined as Error | undefined,
  verifyError: undefined as Error | undefined,
}))
vi.mock('../scripts/better-sidebar/build-patched-sidebar.ts', async () => {
  const fs = await import('node:fs')
  const pathApi = await import('node:path')
  return {
    BETTER_SIDEBAR_PNPM_VERSION: '11.8.0',
    buildPatchedBetterSidebar: (workRoot: string) => {
      if (sidebarFixture.buildError !== undefined) throw sidebarFixture.buildError
      const path = sidebarFixture.path ?? pathApi.join(workRoot, 'fixture-sidebar')
      if (sidebarFixture.path === undefined) {
        fs.mkdirSync(path, { recursive: true })
        fs.writeFileSync(pathApi.join(path, 'package.json'), '{"name":"dsh-better-sidebar","version":"1.0.0"}\n')
      }
      return { tarballPath: path, packedRoot: path }
    },
    verifyInstalledBetterSidebar: () => {
      if (sidebarFixture.verifyError !== undefined) throw sidebarFixture.verifyError
    },
  }
})
import { publishCandidate, stagePresetProfile } from '../scripts/stage-preset-profile.ts'
import { listPackageNames } from '../src/preset-profile.ts'

const PRODUCT_PLUGINS = [
  'omnimux',
  'omnimux-accounts',
  'omnimux-assets',
  'omnimux-products',
  'omnimux-workflow',
  'omnimux-market',
  'omnimux-inspiration',
  'omnimux-clip',
  'omnimux-video',
  'omnimux-analytics',
  'omnimux-publish',
] as const

describe('stagePresetProfile', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    sidebarFixture.path = undefined
    sidebarFixture.buildError = undefined
    sidebarFixture.verifyError = undefined
  })

  it('rejects the retired arbitrary sidebar package override', () => {
    vi.stubEnv('DSH_BETTER_SIDEBAR_SPEC', 'latest')
    expect(() => stagePresetProfile()).toThrowError('DSH_BETTER_SIDEBAR_SPEC is no longer supported')
  })

  it('preserves an existing preset when the pinned sidebar build fails', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux sidebar build failure '))
    try {
      const pluginsRoot = join(fixture, 'product plugins')
      const presetDir = join(fixture, 'existing preset')
      createProductPlugins(pluginsRoot)
      createExistingPreset(presetDir)
      sidebarFixture.buildError = new Error('pinned patch does not apply')

      expect(() => stagePresetProfile({ pluginsRoot, presetDir })).toThrowError('pinned patch does not apply')
      expectExistingPreset(presetDir)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('preserves an existing preset when installed sidebar provenance fails', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux sidebar provenance failure '))
    try {
      const pluginsRoot = join(fixture, 'product plugins')
      const presetDir = join(fixture, 'existing preset')
      createProductPlugins(pluginsRoot)
      createExistingPreset(presetDir)
      sidebarFixture.verifyError = new Error('staged sidebar differs from packed build')

      expect(() => stagePresetProfile({ pluginsRoot, presetDir }))
        .toThrowError('staged sidebar differs from packed build')
      expectExistingPreset(presetDir)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  }, 30_000)
  it('materializes a local file dependency closure from paths containing spaces', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux stage fixture '))
    try {
      const sourceRoot = join(fixture, 'source tree with spaces')
      const pluginsRoot = join(sourceRoot, 'product plugins')
      const uiKit = join(sourceRoot, 'shared packages', 'ui kit')
      const requiredLeaf = join(sourceRoot, 'shared packages', 'required leaf')
      const tokens = join(sourceRoot, 'shared packages', 'tokens package')
      const sidebar = join(sourceRoot, 'sidebar package')
      const presetDir = join(fixture, 'target preset with spaces')
      createPackage(requiredLeaf, '@fixture/required-leaf')
      createPackage(tokens, '@fixture/tokens')
      createPackage(uiKit, '@fixture/ui-kit', {
        dependencies: {
          '@fixture/required-leaf': 'file:../required leaf',
        },
        optionalDependencies: {
          '@fixture/tokens': 'file:../tokens package',
        },
      })
      createPackage(sidebar, 'dsh-better-sidebar')
      createProductPlugins(pluginsRoot, {
        omnimux: {
          dependencies: {
            '@fixture/ui-kit': 'file:../../missing ui kit',
          },
          optionalDependencies: {
            '@fixture/ui-kit': 'file:../../shared packages/ui kit',
          },
        },
        'omnimux-accounts': {
          dependencies: {
            '@fixture/ui-kit': 'file:../../shared packages/ui kit',
          },
        },
      })
      writeFileSync(join(pluginsRoot, 'omnimux', 'index.js'), "module.exports = require('@fixture/ui-kit')\n")
      writeFileSync(
        join(uiKit, 'index.js'),
        "module.exports = { required: require('@fixture/required-leaf'), optional: require('@fixture/tokens') }\n",
      )

      sidebarFixture.path = sidebar
      expect(stagePresetProfile({ pluginsRoot, presetDir })).toBe(15)

      rmSync(sourceRoot, { recursive: true, force: true })
      const movedPresetDir = join(fixture, 'moved preset with spaces')
      renameSync(presetDir, movedPresetDir)
      const output = join(movedPresetDir, 'plugins')
      expect(listPackageNames(output)).toEqual(expect.arrayContaining([
        ...PRODUCT_PLUGINS,
        '@fixture/ui-kit',
        '@fixture/required-leaf',
        '@fixture/tokens',
        'dsh-better-sidebar',
      ]))
      const omnimux = readJson(join(output, 'omnimux', 'package.json'))
      expect(omnimux.dependencies).toMatchObject({
        '@fixture/ui-kit': 'file:../../missing ui kit',
      })
      expect(omnimux.optionalDependencies).toMatchObject({
        '@fixture/ui-kit': 'file:../@fixture/ui-kit',
      })
      const stagedUiKit = readJson(join(output, '@fixture', 'ui-kit', 'package.json'))
      expect(stagedUiKit.dependencies).toMatchObject({
        '@fixture/required-leaf': 'file:../required-leaf',
      })
      expect(stagedUiKit.optionalDependencies).toMatchObject({
        '@fixture/tokens': 'file:../tokens',
      })
      expect(findSymlinks(output)).toEqual([])
      for (const name of listPackageNames(output)) {
        const manifest = readFileSync(join(output, ...name.split('/'), 'package.json'), 'utf8')
        expect(manifest).not.toContain(sourceRoot)
      }

      const runtimeRoot = join(fixture, 'runtime install with spaces')
      mkdirSync(runtimeRoot)
      const owned = readJson(join(movedPresetDir, 'owned-packages.json')) as unknown as string[]
      const dependencies = Object.fromEntries(owned.map(name => [
        name,
        relativeFileSpec(runtimeRoot, join(output, ...name.split('/'))),
      ]))
      writeFileSync(join(runtimeRoot, 'package.json'), `${JSON.stringify({ private: true, dependencies }, undefined, 2)}\n`)
      writeFileSync(join(runtimeRoot, 'pnpm-workspace.yaml'), 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n')
      const installed = spawnSync(
        'pnpm',
        ['install', '--prod', '--ignore-scripts', '--config.confirmModulesPurge=false'],
        { cwd: runtimeRoot, encoding: 'utf8', env: { ...process.env, CI: 'true' } },
      )
      if (installed.status !== 0) {
        throw new Error(`runtime install failed (${String(installed.status)}):\n${installed.stdout ?? ''}\n${installed.stderr ?? ''}`)
      }
      expect(createRequire(join(runtimeRoot, 'probe.cjs'))('omnimux')).toEqual({
        required: { loaded: '@fixture/required-leaf' },
        optional: { loaded: '@fixture/tokens' },
      })
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  }, 30_000)

  it('surfaces pnpm output and preserves an existing preset when install fails', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux stage failure '))
    try {
      const pluginsRoot = join(fixture, 'product plugins')
      const presetDir = join(fixture, 'existing preset')
      createProductPlugins(pluginsRoot)
      createExistingPreset(presetDir)

      let failure: unknown
      try {
        sidebarFixture.path = join(fixture, 'missing sidebar package')
        stagePresetProfile({ pluginsRoot, presetDir })
      } catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(Error)
      expect((failure as Error).message).toContain('stage-preset-profile: pnpm install failed')
      expect((failure as Error).message).toContain('stdout:')
      expect((failure as Error).message).toContain('ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND')
      expectExistingPreset(presetDir)
      expect(readdirSync(presetDir).some(name => name.startsWith('.preset-stage-'))).toBe(false)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  }, 30_000)

  it('rejects a missing local file dependency before publishing', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux stage missing local '))
    try {
      const pluginsRoot = join(fixture, 'product plugins')
      const presetDir = join(fixture, 'existing preset')
      createProductPlugins(pluginsRoot, {
        omnimux: { dependencies: { 'missing-local': 'file:../missing local' } },
      })
      createExistingPreset(presetDir)

      expect(() => stagePresetProfile({ pluginsRoot, presetDir }))
        .toThrowError(/local dependency "missing-local" is missing package\.json/)
      expectExistingPreset(presetDir)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('rejects one local package name resolving to different sources', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux stage conflict '))
    try {
      const sourceRoot = join(fixture, 'source tree')
      const pluginsRoot = join(sourceRoot, 'product plugins')
      createPackage(join(sourceRoot, 'shared one'), 'shared-local')
      createPackage(join(sourceRoot, 'shared two'), 'shared-local')
      createProductPlugins(pluginsRoot, {
        omnimux: { dependencies: { 'shared-local': 'file:../../shared one' } },
        'omnimux-accounts': { dependencies: { 'shared-local': 'file:../../shared two' } },
      })

      expect(() => stagePresetProfile({
        pluginsRoot,
        presetDir: join(fixture, 'target preset'),
      })).toThrowError(/local package "shared-local" resolves to conflicting sources/)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('keeps an incompatible optional-only local package out of the staged output', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux stage optional platform '))
    try {
      const sourceRoot = join(fixture, 'source tree')
      const pluginsRoot = join(sourceRoot, 'product plugins')
      const excluded = join(sourceRoot, 'shared packages', 'excluded package')
      const sidebar = join(sourceRoot, 'sidebar package')
      const presetDir = join(fixture, 'target preset')
      createPackage(excluded, '@fixture/excluded', {
        os: ['definitely-not-a-node-platform'],
      })
      createPackage(sidebar, 'dsh-better-sidebar')
      createProductPlugins(pluginsRoot, {
        'omnimux-assets': {
          optionalDependencies: {
            '@fixture/excluded': 'file:../../shared packages/excluded package',
          },
        },
      })

      sidebarFixture.path = sidebar
      expect(stagePresetProfile({ pluginsRoot, presetDir })).toBe(12)
      expect(listPackageNames(join(presetDir, 'plugins'))).not.toContain('@fixture/excluded')
      expect(readJson(join(presetDir, 'owned-packages.json'))).not.toContain('@fixture/excluded')
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  }, 30_000)

  it('rejects a local package that would override the explicit sidebar dependency', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux stage sidebar collision '))
    try {
      const sourceRoot = join(fixture, 'source tree')
      const pluginsRoot = join(sourceRoot, 'product plugins')
      const localSidebar = join(sourceRoot, 'local sidebar')
      const presetDir = join(fixture, 'existing preset')
      createPackage(localSidebar, 'dsh-better-sidebar')
      createProductPlugins(pluginsRoot, {
        omnimux: {
          dependencies: {
            'dsh-better-sidebar': 'file:../../local sidebar',
          },
        },
      })
      createExistingPreset(presetDir)

      expect(() => stagePresetProfile({ pluginsRoot, presetDir }))
        .toThrowError(/local package "dsh-better-sidebar".+conflicts with explicit staging dependency/)
      expectExistingPreset(presetDir)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })

  it('restores plugins, owned packages, and seed version when publishing fails', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'omnimux publish rollback '))
    try {
      const presetDir = join(fixture, 'preset')
      const candidateDir = join(fixture, 'candidate')
      createExistingPreset(presetDir)
      createPackage(join(candidateDir, 'plugins', 'new-valid'), 'new-valid')
      writeFileSync(join(candidateDir, 'owned-packages.json'), '["new-valid"]\n')
      writeFileSync(join(candidateDir, 'seed-version'), '8\n')
      let renameCount = 0

      expect(() => publishCandidate(candidateDir, presetDir, (from, to) => {
        renameCount += 1
        if (renameCount === 5) throw new Error('injected publish failure')
        renameSync(from, to)
      })).toThrowError('injected publish failure')

      expectExistingPreset(presetDir)
      expect(existsSync(join(presetDir, 'plugins', 'new-valid'))).toBe(false)
      expect(readdirSync(presetDir).some(name => name.startsWith('.preset-backup-'))).toBe(false)
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })
})

interface PackageManifestExtras {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
  readonly os?: readonly string[]
}

function createProductPlugins(
  pluginsRoot: string,
  extras: Partial<Record<(typeof PRODUCT_PLUGINS)[number], PackageManifestExtras>> = {},
): void {
  for (const name of PRODUCT_PLUGINS) createPackage(join(pluginsRoot, name), name, extras[name])
}

function createPackage(root: string, name: string, extras: PackageManifestExtras = {}): void {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({
    name,
    version: '1.0.0',
    main: 'index.js',
    ...extras,
  }, undefined, 2)}\n`)
  writeFileSync(join(root, 'index.js'), `module.exports = { loaded: ${JSON.stringify(name)} }\n`)
}

function createExistingPreset(presetDir: string): void {
  createPackage(join(presetDir, 'plugins', 'existing-valid'), 'existing-valid')
  writeFileSync(join(presetDir, 'owned-packages.json'), '["existing-valid"]\n')
  writeFileSync(join(presetDir, 'seed-version'), '7\n')
}

function expectExistingPreset(presetDir: string): void {
  expect(existsSync(join(presetDir, 'plugins', 'existing-valid', 'package.json'))).toBe(true)
  expect(readFileSync(join(presetDir, 'owned-packages.json'), 'utf8')).toBe('["existing-valid"]\n')
  expect(readFileSync(join(presetDir, 'seed-version'), 'utf8')).toBe('7\n')
}

function relativeFileSpec(from: string, path: string): string {
  const value = relative(from, path).split(sep).join('/')
  return `file:${value.startsWith('.') ? value : `./${value}`}`
}

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>
}

function findSymlinks(root: string): string[] {
  const found: string[] = []
  const queue = [root]
  while (queue.length > 0) {
    const dir = queue.pop()!
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isSymbolicLink()) found.push(path)
      else if (entry.isDirectory()) queue.push(path)
    }
  }
  return found
}
