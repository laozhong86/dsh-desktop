import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertManagedSourceGraph,
  managedDependencySpec,
  managedSourcePath,
  rebuildManagedProfile,
} from '../src/managed-profile.ts'

const OWNED = ['plugin-a', 'dsh-ui-kit'] as const
const NODE_PTY_OWNED = ['node-pty'] as const

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, undefined, 2)}\n`)
}

function writePackage(
  root: string,
  name: string,
  marker: string,
  dependencies?: Record<string, string>,
  optionalDependencies?: Record<string, string>,
): void {
  const directory = join(root, name)
  mkdirSync(directory, { recursive: true })
  writeJson(join(directory, 'package.json'), {
    name,
    version: '1.0.0',
    main: 'index.js',
    files: ['index.js'],
    ...(dependencies === undefined ? {} : { dependencies }),
    ...(optionalDependencies === undefined ? {} : { optionalDependencies }),
  })
  writeFileSync(join(directory, 'index.js'), `module.exports = ${JSON.stringify(marker)}\n`)
  writeFileSync(join(directory, 'excluded.txt'), 'not part of the pnpm pack list\n')
}

function createPreset(root: string, missingKit = false): string {
  const preset = join(root, 'preset')
  const plugins = join(preset, 'plugins')
  // The inactive dependencies edge is intentionally broken. The effective
  // optionalDependencies edge targets the staged kit and must win.
  writePackage(
    plugins,
    'plugin-a',
    'candidate',
    { 'dsh-ui-kit': 'file:../inactive-missing' },
    { 'dsh-ui-kit': 'file:../dsh-ui-kit' },
  )
  if (!missingKit) writePackage(plugins, 'dsh-ui-kit', 'kit')
  writeJson(join(preset, 'owned-packages.json'), OWNED)
  return preset
}

function createLegacyProfile(root: string): string {
  const profile = join(root, 'profiles', 'omnimux')
  mkdirSync(join(profile, 'node_modules'), { recursive: true })
  writeJson(join(profile, 'package.json'), {
    name: 'fixture-profile',
    dependencies: {
      'plugin-a': 'file:./node_modules/plugin-a',
      'dsh-ui-kit': 'file:./node_modules/dsh-ui-kit',
    },
  })
  writeFileSync(join(profile, 'pnpm-workspace.yaml'), 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
  writeFileSync(join(profile, 'pnpm-lock.yaml'), 'lockfileVersion: \'9.0\'\nsettings:\n  autoInstallPeers: false\n')
  writePackage(join(profile, 'node_modules'), 'plugin-a', 'legacy')
  writePackage(join(profile, 'node_modules'), 'dsh-ui-kit', 'legacy-kit')
  return profile
}

function writeNodePtyPackage(root: string): void {
  const directory = join(root, 'node-pty')
  mkdirSync(directory, { recursive: true })
  writeJson(join(directory, 'package.json'), {
    name: 'node-pty',
    version: '1.1.0',
    main: 'index.js',
    files: ['index.js', 'install.cjs'],
    bin: 'cli.js',
    scripts: { install: 'node install.cjs' },
  })
  writeFileSync(join(directory, 'index.js'), 'module.exports = "reviewed-node-pty"\n')
  writeFileSync(join(directory, 'install.cjs'), 'require("node:fs").writeFileSync("built.txt", "built\\n")\n')
  writeFileSync(join(directory, 'cli.js'), 'process.stdout.write("fixture-ok\\n")\n')
}

function createNodePtyPreset(root: string): string {
  const preset = join(root, 'preset')
  writeNodePtyPackage(join(preset, 'plugins'))
  writeJson(join(preset, 'owned-packages.json'), NODE_PTY_OWNED)
  return preset
}

function createNodePtyLegacyProfile(root: string, deniedRule?: string): string {
  const profile = join(root, 'profiles', 'omnimux')
  mkdirSync(join(profile, 'node_modules'), { recursive: true })
  writeJson(join(profile, 'package.json'), {
    name: 'fixture-profile',
    dependencies: { 'node-pty': 'file:./node_modules/node-pty' },
  })
  const denial = deniedRule === undefined ? '' : `allowBuilds:\n  '${deniedRule}': false\n`
  writeFileSync(
    join(profile, 'pnpm-workspace.yaml'),
    `packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n${denial}`,
  )
  writeFileSync(join(profile, 'pnpm-lock.yaml'), 'lockfileVersion: \'9.0\'\nsettings:\n  autoInstallPeers: false\n')
  writeNodePtyPackage(join(profile, 'node_modules'))
  return profile
}

function snapshotGraph(profile: string): string {
  const hash = createHash('sha256')
  const visit = (path: string): void => {
    if (!existsSync(path)) {
      hash.update(`missing:${relative(profile, path)}\n`)
      return
    }
    const stat = lstatSync(path)
    hash.update(`${stat.isSymbolicLink() ? 'l' : stat.isDirectory() ? 'd' : 'f'}:${relative(profile, path)}\n`)
    if (stat.isSymbolicLink()) hash.update(readlinkSync(path))
    else if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(join(path, name))
    } else hash.update(readFileSync(path))
  }
  for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'node_modules', '.materialize-snapshots']) {
    visit(join(profile, name))
  }
  return hash.digest('hex')
}

async function fakeMaterialize(candidate: string): Promise<void> {
  const manifest = JSON.parse(readFileSync(join(candidate, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>
  }
  const modules = join(candidate, 'node_modules')
  mkdirSync(modules, { recursive: true })
  for (const name of Object.keys(manifest.dependencies)) {
    const source = managedSourcePath(candidate, name)
    if (!existsSync(source)) continue
    cpSync(source, join(modules, name), { recursive: true })
  }
  writeFileSync(join(candidate, 'pnpm-lock.yaml'), 'lockfileVersion: \'9.0\'\nsettings:\n  autoInstallPeers: false\n')
}

async function pnpmMaterialize(candidate: string): Promise<void> {
  const pnpm = join(dirname(createRequire(import.meta.url).resolve('pnpm')), 'bin', 'pnpm.mjs')
  const result = spawnSync(process.execPath, [pnpm, '--config.minimumReleaseAge=0', 'install', '--no-frozen-lockfile'], {
    cwd: candidate,
    env: { ...process.env, CI: 'true' },
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(`pnpm failed: ${result.stderr || result.stdout}`)
}

async function fakePackedFiles(): Promise<readonly string[]> {
  return ['index.js', 'package.json']
}

async function pnpmPackedFiles(source: string): Promise<readonly string[]> {
  const pnpm = join(dirname(createRequire(import.meta.url).resolve('pnpm')), 'bin', 'pnpm.mjs')
  const result = spawnSync(
    process.execPath,
    [pnpm, '--config.ignore-scripts=true', 'pack', '--dry-run', '--json'],
    { cwd: source, env: { ...process.env, CI: 'true' }, encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(`pnpm pack failed: ${result.stderr || result.stdout}`)
  const parsed = JSON.parse(result.stdout) as { files: Array<{ path: string }> }
  return parsed.files.map(file => file.path)
}

describe('managed OmniMux Profile rebuild', () => {
  it('validates only effective optional dependency edges', () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-effective-'))
    try {
      const preset = createPreset(root)
      expect(() => assertManagedSourceGraph(join(preset, 'plugins'), OWNED)).not.toThrow()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('allows only a physically absent effective optional local source', () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-optional-missing-'))
    try {
      const preset = createPreset(root)
      const manifestPath = join(preset, 'plugins', 'plugin-a', 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      writeJson(manifestPath, {
        ...manifest,
        optionalDependencies: {
          'dsh-ui-kit': 'file:../dsh-ui-kit',
          'optional-native': 'file:../optional-native',
        },
      })
      expect(() => assertManagedSourceGraph(join(preset, 'plugins'), OWNED)).not.toThrow()

      mkdirSync(join(preset, 'plugins', 'optional-native'))
      expect(() => assertManagedSourceGraph(join(preset, 'plugins'), OWNED)).toThrow('incomplete local source')
      rmSync(join(preset, 'plugins', 'optional-native'), { recursive: true })
      symlinkSync(join(root, 'missing-native'), join(preset, 'plugins', 'optional-native'))
      expect(() => assertManagedSourceGraph(join(preset, 'plugins'), OWNED)).toThrow('physical directory')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('runs the reviewed managed node-pty lifecycle with exact build rules', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-node-pty-build-'))
    try {
      const presetDir = createNodePtyPreset(root)
      const profileDir = createNodePtyLegacyProfile(root)
      await expect(rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: NODE_PTY_OWNED,
        packedFiles: pnpmPackedFiles,
        materialize: pnpmMaterialize,
      })).resolves.toMatchObject({ packageCount: 1 })
      const policy = readFileSync(join(profileDir, 'pnpm-workspace.yaml'), 'utf8')
      expect(policy).toContain('node-pty@1.1.0: true')
      expect(policy).toContain('node-pty@file:.materialize-snapshots/plugins/node-pty: true')
      expect(readFileSync(join(profileDir, 'node_modules', 'node-pty', 'built.txt'), 'utf8')).toBe('built\n')
      const installedCli = join(profileDir, 'node_modules', 'node-pty', 'cli.js')
      const cli = spawnSync(process.execPath, [installedCli], { encoding: 'utf8' })
      expect(cli).toMatchObject({ status: 0, stdout: 'fixture-ok\n' })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('preserves every explicit node-pty build denial and publishes nothing', async () => {
    for (const deniedRule of [
      'node-pty',
      'node-pty@1.1.0',
      'node-pty@v1.1.0 || 1.2.0',
      'node-pty@file:.materialize-snapshots/plugins/node-pty',
    ] as const) {
      const root = mkdtempSync(join(tmpdir(), 'managed-profile-node-pty-denied-'))
      try {
        const presetDir = createNodePtyPreset(root)
        const profileDir = createNodePtyLegacyProfile(root, deniedRule)
        const before = snapshotGraph(profileDir)
        let materialized = false
        await expect(rebuildManagedProfile({
          profileDir,
          presetDir,
          ownedPackages: NODE_PTY_OWNED,
          packedFiles: fakePackedFiles,
          materialize: async candidate => {
            materialized = true
            await fakeMaterialize(candidate)
          },
        })).rejects.toThrow(`explicitly denies required node-pty lifecycle scripts (${deniedRule})`)
        expect(materialized).toBe(false)
        expect(snapshotGraph(profileDir)).toBe(before)
        expect(readFileSync(join(profileDir, 'pnpm-workspace.yaml'), 'utf8')).toContain(`'${deniedRule}': false`)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('preserves an unrelated exact-version union denial without blocking the reviewed build', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-node-pty-other-denial-'))
    try {
      const deniedRule = 'node-pty@1.2.0 || 1.3.0'
      const presetDir = createNodePtyPreset(root)
      const profileDir = createNodePtyLegacyProfile(root, deniedRule)
      await expect(rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: NODE_PTY_OWNED,
        packedFiles: fakePackedFiles,
        materialize: fakeMaterialize,
      })).resolves.toMatchObject({ packageCount: 1 })
      const policy = readFileSync(join(profileDir, 'pnpm-workspace.yaml'), 'utf8')
      expect(policy).toContain(`'${deniedRule}': false`)
      expect(policy).toContain('node-pty@1.1.0: true')
      expect(policy).toContain('node-pty@file:.materialize-snapshots/plugins/node-pty: true')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a missing declared managed bin before materialization or publish', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-missing-bin-'))
    try {
      const presetDir = createNodePtyPreset(root)
      rmSync(join(presetDir, 'plugins', 'node-pty', 'cli.js'))
      const profileDir = createNodePtyLegacyProfile(root)
      const before = snapshotGraph(profileDir)
      let materialized = false
      await expect(rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: NODE_PTY_OWNED,
        packedFiles: fakePackedFiles,
        materialize: async candidate => {
          materialized = true
          await fakeMaterialize(candidate)
        },
      })).rejects.toThrow('bin "node-pty" is missing or is not a physical file')
      expect(materialized).toBe(false)
      expect(snapshotGraph(profileDir)).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('runs real pnpm from old self-references to a resolvable managed graph', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-pnpm-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      const result = await rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: OWNED,
        packedFiles: pnpmPackedFiles,
        materialize: pnpmMaterialize,
      })
      const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>
      }
      expect(manifest.dependencies['plugin-a']).toBe(managedDependencySpec('plugin-a'))
      expect(result.packageCount).toBe(2)
      expect(result.sourceHash).toMatch(/^[a-f0-9]{64}$/u)
      expect(result.manifestHash).toMatch(/^[a-f0-9]{64}$/u)
      expect(createRequire(join(profileDir, 'package.json'))('plugin-a')).toBe('candidate')
      expect(existsSync(join(profileDir, 'node_modules', '.ignored'))).toBe(false)
      expect(existsSync(join(profileDir, 'node_modules', 'plugin-a', 'excluded.txt'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('accepts real pnpm installs with import-only and require-only root exports', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-import-only-'))
    try {
      const presetDir = createPreset(root)
      const manifestPath = join(presetDir, 'plugins', 'plugin-a', 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      delete manifest.main
      writeJson(manifestPath, {
        ...manifest,
        type: 'module',
        exports: { '.': { import: './index.js', types: './index.d.ts' } },
      })
      writeFileSync(join(presetDir, 'plugins', 'plugin-a', 'index.js'), 'export default "import-only"\n')
      const kitManifestPath = join(presetDir, 'plugins', 'dsh-ui-kit', 'package.json')
      const kitManifest = JSON.parse(readFileSync(kitManifestPath, 'utf8')) as Record<string, unknown>
      delete kitManifest.main
      writeJson(kitManifestPath, {
        ...kitManifest,
        exports: { '.': { require: './index.js', types: './index.d.ts' } },
      })
      const profileDir = createLegacyProfile(root)
      await expect(rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: pnpmPackedFiles, materialize: pnpmMaterialize,
      })).resolves.toMatchObject({ packageCount: 2 })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('accepts a types-only root export without inventing a runtime entry', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-types-only-'))
    try {
      const presetDir = createPreset(root)
      const manifestPath = join(presetDir, 'plugins', 'plugin-a', 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      delete manifest.main
      writeJson(manifestPath, {
        ...manifest,
        files: ['api.d.ts'],
        exports: { '.': { types: './api.d.ts' } },
      })
      writeFileSync(join(presetDir, 'plugins', 'plugin-a', 'api.d.ts'), 'export interface PluginApi {}\n')
      const profileDir = createLegacyProfile(root)
      await expect(rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: pnpmPackedFiles, materialize: pnpmMaterialize,
      })).resolves.toMatchObject({ packageCount: 2 })
      expect(readFileSync(join(profileDir, 'node_modules', 'plugin-a', 'api.d.ts'), 'utf8'))
        .toBe('export interface PluginApi {}\n')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('still rejects a declared runtime export whose target is missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-missing-export-'))
    try {
      const presetDir = createPreset(root)
      const manifestPath = join(presetDir, 'plugins', 'plugin-a', 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      delete manifest.main
      writeJson(manifestPath, {
        ...manifest,
        files: ['index.js', 'index.d.ts'],
        exports: { '.': { types: './index.d.ts', import: './missing.js' } },
      })
      writeFileSync(join(presetDir, 'plugins', 'plugin-a', 'index.d.ts'), 'declare const plugin: string\nexport default plugin\n')
      const profileDir = createLegacyProfile(root)
      const before = snapshotGraph(profileDir)
      await expect(rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: pnpmPackedFiles, materialize: pnpmMaterialize,
      })).rejects.toThrow('runtime entry is missing')
      expect(snapshotGraph(profileDir)).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('preserves a valid newer managed source over the same-version candidate', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-preserve-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      writePackage(join(profileDir, '.materialize-snapshots', 'plugins'), 'plugin-a', 'newer-synced')
      writePackage(join(profileDir, '.materialize-snapshots', 'plugins'), 'dsh-ui-kit', 'newer-kit')
      const sentinel = join(profileDir, '.materialize-snapshots', 'receipts', 'keep.json')
      writeJson(sentinel, { keep: true })
      const result = await rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: fakePackedFiles, materialize: fakeMaterialize,
      })
      expect(result.preservedManagedSources).toEqual(OWNED)
      expect(readFileSync(join(managedSourcePath(profileDir, 'plugin-a'), 'index.js'), 'utf8')).toContain('newer-synced')
      expect(createRequire(join(profileDir, 'package.json'))('plugin-a')).toBe('newer-synced')
      expect(JSON.parse(readFileSync(sentinel, 'utf8'))).toEqual({ keep: true })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('preserves a valid newer package while the candidate supplies its missing required source', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-compose-closure-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      writePackage(
        join(profileDir, '.materialize-snapshots', 'plugins'),
        'plugin-a',
        'newer-plugin',
        { 'dsh-ui-kit': 'file:../dsh-ui-kit' },
      )
      const result = await rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: pnpmPackedFiles, materialize: pnpmMaterialize,
      })
      expect(result.preservedManagedSources).toEqual(['plugin-a'])
      expect(createRequire(join(profileDir, 'package.json'))('plugin-a')).toBe('newer-plugin')
      expect(createRequire(join(profileDir, 'package.json'))('dsh-ui-kit')).toBe('kit')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('copies Profile-local pnpm configuration into the candidate without publishing over it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-npmrc-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      const npmrc = '@private:registry=http://127.0.0.1:4873/\ncafile=./registry-ca.pem\n'
      writeFileSync(join(profileDir, '.npmrc'), npmrc)
      writeFileSync(join(profileDir, 'registry-ca.pem'), 'test-only registry certificate\n')
      writeFileSync(join(profileDir, '.pnpmfile.cjs'), 'module.exports = { hooks: {} }\n')
      await rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: OWNED,
        packedFiles: fakePackedFiles,
        materialize: async candidate => {
          expect(readFileSync(join(candidate, '.npmrc'), 'utf8')).toBe(npmrc)
          expect(readFileSync(join(candidate, 'registry-ca.pem'), 'utf8')).toBe('test-only registry certificate\n')
          expect(readFileSync(join(candidate, '.pnpmfile.cjs'), 'utf8')).toBe('module.exports = { hooks: {} }\n')
          await fakeMaterialize(candidate)
        },
      })
      expect(readFileSync(join(profileDir, '.npmrc'), 'utf8')).toBe(npmrc)
      expect(readFileSync(join(profileDir, 'registry-ca.pem'), 'utf8')).toBe('test-only registry certificate\n')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('excludes the rebuildable module fallback projection without deleting the active copy', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-module-fallback-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      const helper = join(root, 'fixture-helper')
      writePackage(root, 'fixture-helper', 'helper')
      const fallback = join(profileDir, '.dsh-module-fallback', 'node_modules')
      mkdirSync(fallback, { recursive: true })
      symlinkSync(helper, join(fallback, 'fixture-helper'))

      await rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: OWNED,
        packedFiles: fakePackedFiles,
        materialize: async candidate => {
          expect(existsSync(join(candidate, '.dsh-module-fallback'))).toBe(false)
          await fakeMaterialize(candidate)
        },
      })

      expect(lstatSync(join(fallback, 'fixture-helper')).isSymbolicLink()).toBe(true)
      expect(readFileSync(join(fallback, 'fixture-helper', 'index.js'), 'utf8')).toContain('helper')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects incomplete candidate coverage before any Profile write', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-incomplete-'))
    try {
      const presetDir = createPreset(root, true)
      const profileDir = createLegacyProfile(root)
      const before = snapshotGraph(profileDir)
      await expect(rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: fakePackedFiles, materialize: fakeMaterialize,
      }))
        .rejects.toThrow('dsh-ui-kit')
      expect(snapshotGraph(profileDir)).toBe(before)
      expect(readdirSync(dirname(profileDir)).some(name => name.startsWith('.omnimux-profile-candidate-'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('leaves the whole active graph unchanged when materialization fails', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-install-fail-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      const before = snapshotGraph(profileDir)
      await expect(rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: OWNED,
        packedFiles: fakePackedFiles,
        materialize: async candidate => {
          await fakeMaterialize(candidate)
          throw new Error('interrupted install')
        },
      })).rejects.toThrow('interrupted install')
      expect(snapshotGraph(profileDir)).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a damaged existing managed source instead of replacing it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-damaged-existing-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      writePackage(join(profileDir, '.materialize-snapshots', 'plugins'), 'plugin-a', 'damaged')
      writeJson(join(managedSourcePath(profileDir, 'plugin-a'), 'package.json'), {
        name: 'wrong-package', version: '1.0.0', main: 'index.js',
      })
      const before = snapshotGraph(profileDir)
      await expect(rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: fakePackedFiles, materialize: fakeMaterialize,
      }))
        .rejects.toThrow('declares name')
      expect(snapshotGraph(profileDir)).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects nested source symlinks before dereferenced copying', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-source-link-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      symlinkSync(join(root, 'outside'), join(presetDir, 'plugins', 'plugin-a', 'outside-link'))
      const before = snapshotGraph(profileDir)
      await expect(rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: fakePackedFiles, materialize: fakeMaterialize,
      }))
        .rejects.toThrow('symbolic link')
      expect(snapshotGraph(profileDir)).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects Profile and managed-source boundary symlinks without invoking materialization', async () => {
    const cases = ['profile', 'snapshots', 'plugins', 'scope'] as const
    for (const boundary of cases) {
      const root = mkdtempSync(join(tmpdir(), `managed-profile-${boundary}-link-`))
      try {
        const presetDir = createPreset(root)
        let profileDir = createLegacyProfile(root)
        let protectedPath: string | undefined
        if (boundary === 'profile') {
          const physicalProfile = join(root, 'physical-profile')
          renameSync(profileDir, physicalProfile)
          symlinkSync(physicalProfile, profileDir)
          protectedPath = join(physicalProfile, 'package.json')
        } else if (boundary === 'snapshots') {
          const outside = join(root, 'outside-snapshots')
          writePackage(join(outside, 'plugins'), 'plugin-a', 'outside')
          writePackage(join(outside, 'plugins'), 'dsh-ui-kit', 'outside-kit')
          symlinkSync(outside, join(profileDir, '.materialize-snapshots'))
          protectedPath = join(outside, 'plugins', 'plugin-a', 'package.json')
        } else if (boundary === 'plugins') {
          const snapshots = join(profileDir, '.materialize-snapshots')
          const outside = join(root, 'outside-plugins')
          mkdirSync(snapshots)
          writePackage(outside, 'plugin-a', 'outside')
          writePackage(outside, 'dsh-ui-kit', 'outside-kit')
          symlinkSync(outside, join(snapshots, 'plugins'))
          protectedPath = join(outside, 'plugin-a', 'package.json')
        } else {
          const plugins = join(profileDir, '.materialize-snapshots', 'plugins')
          const outside = join(root, 'outside-scope')
          mkdirSync(plugins, { recursive: true })
          writePackage(outside, 'extra', 'outside-extra')
          symlinkSync(outside, join(plugins, '@scope'))
          const manifestPath = join(profileDir, 'package.json')
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
            dependencies: Record<string, string>
          }
          manifest.dependencies['@scope/extra'] = managedDependencySpec('@scope/extra')
          writeJson(manifestPath, manifest)
          protectedPath = join(outside, 'extra', 'package.json')
        }
        const before = snapshotGraph(profileDir)
        let materialized = false
        await expect(rebuildManagedProfile({
          profileDir,
          presetDir,
          ownedPackages: OWNED,
          packedFiles: fakePackedFiles,
          materialize: async candidate => {
            materialized = true
            await fakeMaterialize(candidate)
          },
        })).rejects.toThrow(/physical directory|symbolic link/u)
        expect(materialized).toBe(false)
        expect(snapshotGraph(profileDir)).toBe(before)
        expect(existsSync(protectedPath)).toBe(true)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('rejects a missing declared runtime entry after real pnpm install and before publish', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-missing-main-'))
    try {
      const presetDir = createPreset(root)
      const manifestPath = join(presetDir, 'plugins', 'plugin-a', 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      writeJson(manifestPath, { ...manifest, main: 'missing.js' })
      const profileDir = createLegacyProfile(root)
      const before = snapshotGraph(profileDir)
      await expect(rebuildManagedProfile({
        profileDir, presetDir, ownedPackages: OWNED, packedFiles: pnpmPackedFiles, materialize: pnpmMaterialize,
      })).rejects.toThrow(/declared main is not resolvable|runtime entr(?:y is missing|ies are not import-resolvable)/u)
      expect(snapshotGraph(profileDir)).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('rejects same-version installed content drift before publish', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-content-drift-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      const before = snapshotGraph(profileDir)
      await expect(rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: OWNED,
        packedFiles: fakePackedFiles,
        materialize: async candidate => {
          await fakeMaterialize(candidate)
          writeFileSync(join(candidate, 'node_modules', 'plugin-a', 'index.js'), 'module.exports = "drift"\n')
        },
      })).rejects.toThrow('installed content differs')
      expect(snapshotGraph(profileDir)).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('restores the whole dependency graph when the publish rename fails', async () => {
    const root = mkdtempSync(join(tmpdir(), 'managed-profile-commit-fail-'))
    try {
      const presetDir = createPreset(root)
      const profileDir = createLegacyProfile(root)
      const before = snapshotGraph(profileDir)
      let failed = false
      await expect(rebuildManagedProfile({
        profileDir,
        presetDir,
        ownedPackages: OWNED,
        packedFiles: fakePackedFiles,
        materialize: fakeMaterialize,
        rename: (source, destination) => {
          if (!failed && source.includes('.omnimux-profile-candidate-') && source.endsWith('pnpm-lock.yaml')) {
            failed = true
            throw new Error('commit fault')
          }
          renameSync(source, destination)
        },
      })).rejects.toThrow('commit fault')
      expect(snapshotGraph(profileDir)).toBe(before)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
