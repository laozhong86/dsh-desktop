/** Materialize offline OmniMux profile plugins into preset/plugins. */

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listPackageNames, packageDirSegments } from '../src/preset-profile.ts'
import {
  BETTER_SIDEBAR_PNPM_VERSION,
  buildPatchedBetterSidebar,
  verifyInstalledBetterSidebar,
} from './better-sidebar/build-patched-sidebar.ts'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultPresetDir = join(desktopRoot, 'preset')
const defaultPluginsDir = join(defaultPresetDir, 'plugins')

/**
 * Product-tree plugins staged into the preset. The profile stays on `link:`
 * during development; packaging reads the same source trees (the link
 * targets) and materializes offline copies here — one structure, no
 * switching. The source root is required via OMNIMUX_PLUGINS_DIR so the
 * desktop deploy root never embeds a host machine's absolute path.
 */
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
const REQUIRED_PACKAGES = [...PRODUCT_PLUGINS, 'dsh-better-sidebar']
interface Manifest {
  name?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}
export interface StagePresetProfileOptions {
  readonly pluginsRoot?: string
  readonly presetDir?: string
}

/**
 * Stage plugin snapshots the desktop seed copies into the user profile.
 * @returns the number of package directories written under preset/plugins.
 */
export function stagePresetProfile(options: StagePresetProfileOptions = {}): number {
  if (process.env.DSH_BETTER_SIDEBAR_SPEC !== undefined) {
    throw new Error('DSH_BETTER_SIDEBAR_SPEC is no longer supported; the sidebar source and patch are repository-pinned')
  }
  const targetPresetDir = resolve(options.presetDir ?? defaultPresetDir)
  mkdirSync(targetPresetDir, { recursive: true })
  const pluginsRoot = options.pluginsRoot ?? process.env.OMNIMUX_PLUGINS_DIR
  if (pluginsRoot === undefined || pluginsRoot === '') {
    throw new Error('OMNIMUX_PLUGINS_DIR is required (absolute path to the omnimux-dsh product-tree plugins directory)')
  }
  const resolvedPluginsRoot = resolve(pluginsRoot)
  for (const name of PRODUCT_PLUGINS) {
    if (!existsSync(join(resolvedPluginsRoot, name, 'package.json'))) {
      throw new Error(`product plugin source is missing: ${join(resolvedPluginsRoot, name)} (set OMNIMUX_PLUGINS_DIR)`)
    }
  }
  // Keep every local file: spec on one canonical path namespace. macOS may
  // expose the same temporary directory as both /var and /private/var;
  // mixing those spellings makes pnpm resolve a valid tarball as /private/private/var.
  const staging = realpathSync(mkdtempSync(join(tmpdir(), 'omnimux-preset-')))
  let candidateDir: string | undefined
  try {
    const sidebar = buildPatchedBetterSidebar(join(staging, 'better-sidebar'))
    const dependencies: Record<string, string> = {
      'dsh-better-sidebar': toFileSpec(staging, sidebar.tarballPath),
    }
    const optionalDependencies: Record<string, string> = {}
    const stagedPackagesRoot = join(staging, 'packages')
    const packages = new Map<string, { source: string; destination: string }>()
    for (const name of PRODUCT_PLUGINS) {
      const source = realpathSync(join(resolvedPluginsRoot, name))
      const destination = join(stagedPackagesRoot, ...packageDirSegments(name))
      registerPackage(packages, name, source, destination)
    }
    const copied = new Set<string>()
    for (const name of PRODUCT_PLUGINS) {
      const entry = packages.get(name)!
      copyPackageClosure(name, entry.source, entry.destination, stagedPackagesRoot, packages, copied)
      dependencies[name] = toFileSpec(staging, entry.destination)
    }
    for (const [name, entry] of packages) {
      if ((PRODUCT_PLUGINS as readonly string[]).includes(name)) continue
      if (Object.hasOwn(dependencies, name)) {
        throw new Error(
          `local package ${JSON.stringify(name)} from ${entry.source} conflicts with explicit staging dependency ${JSON.stringify(dependencies[name])}`,
        )
      }
      optionalDependencies[name] = toFileSpec(staging, entry.destination)
    }
    writeFileSync(join(staging, 'package.json'), `${JSON.stringify({
      private: true,
      dependencies,
      optionalDependencies,
    }, undefined, 2)}\n`)
    writeFileSync(join(staging, 'pnpm-workspace.yaml'), `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n`)
    installStaging(staging)

    candidateDir = mkdtempSync(join(targetPresetDir, '.preset-stage-'))
    const candidatePluginsDir = join(candidateDir, 'plugins')
    mkdirSync(candidatePluginsDir)
    copyHoistedModules(join(staging, 'node_modules'), candidatePluginsDir)
    const owned = listPackageNames(candidatePluginsDir)
    for (const required of REQUIRED_PACKAGES) {
      if (!owned.includes(required)) {
        throw new Error(`staged preset is missing required plugin ${required}: ${owned.join(', ')}`)
      }
    }
    verifyInstalledBetterSidebar(join(candidatePluginsDir, 'dsh-better-sidebar'), sidebar.packedRoot)
    writeFileSync(join(candidateDir, 'owned-packages.json'), `${JSON.stringify(owned, undefined, 2)}\n`)
    const seedVersionPath = join(targetPresetDir, 'seed-version')
    writeFileSync(
      join(candidateDir, 'seed-version'),
      existsSync(seedVersionPath) ? readFileSync(seedVersionPath) : '1\n',
    )
    publishCandidate(candidateDir, targetPresetDir)
    candidateDir = undefined
    return owned.length
  } finally {
    if (candidateDir !== undefined) rmSync(candidateDir, { recursive: true, force: true })
    rmSync(staging, { recursive: true, force: true })
  }
}

function registerPackage(
  packages: Map<string, { source: string; destination: string }>,
  name: string,
  source: string,
  destination: string,
): void {
  packageDirSegments(name)
  const existing = packages.get(name)
  if (existing !== undefined && existing.source !== source) {
    throw new Error(`local package ${JSON.stringify(name)} resolves to conflicting sources: ${existing.source} and ${source}`)
  }
  if (existing === undefined) packages.set(name, { source, destination })
}

function copyPackageClosure(
  name: string,
  source: string,
  destination: string,
  stagedPackagesRoot: string,
  packages: Map<string, { source: string; destination: string }>,
  copied: Set<string>,
): void {
  if (copied.has(name)) return
  copied.add(name)
  copyPluginSources(source, destination)
  const manifestPath = join(destination, 'package.json')
  const manifest = readManifest(manifestPath)
  const optionalDependencies = new Set(Object.keys(manifest.optionalDependencies ?? {}))
  let changed = false
  for (const field of ['dependencies', 'optionalDependencies'] as const) {
    const dependencyMap = manifest[field]
    if (dependencyMap === undefined) continue
    for (const [dependencyName, spec] of Object.entries(dependencyMap)) {
      if (field === 'dependencies' && optionalDependencies.has(dependencyName)) continue
      if (!spec.startsWith('file:')) continue
      const sourcePath = spec.slice('file:'.length)
      if (sourcePath === '') {
        throw new Error(`local dependency ${JSON.stringify(dependencyName)} in ${join(source, 'package.json')} has an empty file: path`)
      }
      const unresolvedSource = resolve(source, sourcePath)
      if (!existsSync(join(unresolvedSource, 'package.json'))) {
        throw new Error(`local dependency ${JSON.stringify(dependencyName)} is missing package.json: ${unresolvedSource}`)
      }
      const dependencySource = realpathSync(unresolvedSource)
      const dependencyDestination = join(stagedPackagesRoot, ...packageDirSegments(dependencyName))
      registerPackage(packages, dependencyName, dependencySource, dependencyDestination)
      const entry = packages.get(dependencyName)!
      copyPackageClosure(
        dependencyName,
        entry.source,
        entry.destination,
        stagedPackagesRoot,
        packages,
        copied,
      )
      dependencyMap[dependencyName] = toFileSpec(destination, entry.destination)
      changed = true
    }
  }
  if (changed) writeFileSync(manifestPath, `${JSON.stringify(manifest, undefined, 2)}\n`)
}

function readManifest(path: string): Manifest {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Manifest
  } catch (error) {
    throw new Error(`cannot read package manifest ${path}: ${String(error)}`)
  }
}

function toFileSpec(fromPackageDir: string, targetPackageDir: string): string {
  const path = relative(fromPackageDir, targetPackageDir).split(sep).join('/')
  return `file:${path.startsWith('.') ? path : `./${path}`}`
}

function copyPluginSources(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true })
  cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter: (path) => {
      const relative = path.slice(source.length)
      if (relative.includes(`${join('node_modules')}`)) return false
      if (relative.endsWith('.test.js') || relative.endsWith('.spec.js')) return false
      return true
    },
  })
}

function installStaging(staging: string): void {
  const installArgs = ['install', '--prod', '--ignore-scripts', '--config.confirmModulesPurge=false']
  const command = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'corepack'
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `corepack pnpm@${BETTER_SIDEBAR_PNPM_VERSION} ${installArgs.join(' ')}`]
    : [`pnpm@${BETTER_SIDEBAR_PNPM_VERSION}`, ...installArgs]
  const result = spawnSync(command, args, {
    cwd: staging,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  })
  if (result.status === 0) return
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  const status = result.status === null
    ? result.signal ?? result.error?.message ?? 'unknown'
    : String(result.status)
  throw new Error([
    `stage-preset-profile: pnpm install failed (${status})`,
    result.error === undefined ? undefined : `error: ${result.error.message}`,
    `stdout:\n${stdout === '' ? '<empty>' : stdout.trimEnd()}`,
    `stderr:\n${stderr === '' ? '<empty>' : stderr.trimEnd()}`,
  ].filter((line): line is string => line !== undefined).join('\n'))
}

function copyHoistedModules(source: string, destination: string): void {
  for (const name of listPackageNames(source)) {
    const from = join(source, ...name.split('/'))
    const to = join(destination, ...name.split('/'))
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true, dereference: true })
    // pnpm materializes nested `node_modules/.bin` entries whose relative
    // targets pointed into the (now deleted) staging tree. electron-builder
    // stats every packaged file, so a dangling link fails the whole build,
    // while runtime code never invokes these CLI shims.
    removeDanglingBinLinks(to)
  }
}

function removeDanglingBinLinks(packageDir: string): void {
  const queue = [join(packageDir, 'node_modules')]
  while (queue.length > 0) {
    const dir = queue.pop()!
    const binDir = join(dir, '.bin')
    if (existsSync(binDir)) rmSync(binDir, { recursive: true, force: true })
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== '.bin' && !entry.name.startsWith('.')) {
        queue.push(join(dir, entry.name, 'node_modules'))
      }
    }
  }
}

export function publishCandidate(
  candidateDir: string,
  targetPresetDir: string,
  rename: typeof renameSync = renameSync,
): void {
  const entries = ['plugins', 'owned-packages.json', 'seed-version'] as const
  const backupRoot = mkdtempSync(join(targetPresetDir, '.preset-backup-'))
  const backedUp: string[] = []
  const published: string[] = []
  try {
    for (const entry of entries) {
      const target = join(targetPresetDir, entry)
      if (!existsSync(target)) continue
      rename(target, join(backupRoot, entry))
      backedUp.push(entry)
    }
    for (const entry of entries) {
      rename(join(candidateDir, entry), join(targetPresetDir, entry))
      published.push(entry)
    }
  } catch (error) {
    const rollbackErrors: string[] = []
    for (const entry of [...published].reverse()) {
      try {
        rmSync(join(targetPresetDir, entry), { recursive: true, force: true })
      } catch (rollbackError) {
        rollbackErrors.push(`remove new ${entry}: ${String(rollbackError)}`)
      }
    }
    for (const entry of [...backedUp].reverse()) {
      try {
        const target = join(targetPresetDir, entry)
        if (existsSync(target)) rmSync(target, { recursive: true, force: true })
        rename(join(backupRoot, entry), target)
      } catch (rollbackError) {
        rollbackErrors.push(`restore ${entry}: ${String(rollbackError)}`)
      }
    }
    if (rollbackErrors.length > 0) {
      throw new Error(
        `preset publish failed (${String(error)}); rollback also failed; previous preset backup retained at ${backupRoot}: ${rollbackErrors.join('; ')}`,
      )
    }
    rmSync(backupRoot, { recursive: true, force: true })
    throw error
  }
  try {
    rmSync(candidateDir, { recursive: true, force: true })
    rmSync(backupRoot, { recursive: true, force: true })
  } catch (error) {
    throw new Error(
      `preset published successfully, but staging cleanup failed; the new preset remains active and the previous backup is retained at ${backupRoot}: ${String(error)}`,
    )
  }
}
function main(): void {
  const count = stagePresetProfile()
  process.stdout.write(`staged ${String(count)} preset packages into ${defaultPluginsDir}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
