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
  'omnimux-forms',
] as const
const CORE_REQUIRED_BUNDLES = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  'dsh-better-sidebar',
  'omnimux',
] as const
const RELEASE_CHANNELS = ['production', 'development'] as const
type ReleaseChannel = (typeof RELEASE_CHANNELS)[number]

/**
 * Product-tree plugins staged into the preset. The profile stays on `link:`
 * during development; packaging reads the same source trees (the link
 * targets) and materializes offline copies here — one structure, no
 * switching. The source root is required via OMNIMUX_PLUGINS_DIR so the
 * desktop deploy root never embeds a host machine's absolute path.
 */
interface Manifest {
  name?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  dsh?: { profile?: { bundles?: string[] } }
}
interface LifecycleEntry {
  readonly stage: 'alpha'
  readonly toolPrefixes: readonly string[]
}
export interface StagePresetProfileOptions {
  readonly pluginsRoot?: string
  readonly presetDir?: string
  readonly releaseChannel?: ReleaseChannel
}

/**
 * Stage plugin snapshots the desktop seed copies into the user profile.
 * @returns the number of package directories written under preset/plugins.
 */
export function stagePresetProfile(options: StagePresetProfileOptions = {}): number {
  if (process.env.DSH_BETTER_SIDEBAR_SPEC !== undefined) {
    throw new Error('DSH_BETTER_SIDEBAR_SPEC is no longer supported; the sidebar source and patch are repository-pinned')
  }
  const releaseChannel = options.releaseChannel ?? 'production'
  if (!RELEASE_CHANNELS.includes(releaseChannel)) {
    throw new Error(`release channel must be production or development: ${JSON.stringify(releaseChannel)}`)
  }
  const targetPresetDir = resolve(options.presetDir ?? defaultPresetDir)
  const pluginsRoot = options.pluginsRoot ?? process.env.OMNIMUX_PLUGINS_DIR
  if (pluginsRoot === undefined || pluginsRoot === '') {
    throw new Error('OMNIMUX_PLUGINS_DIR is required (absolute path to the omnimux-dsh product-tree plugins directory)')
  }
  const resolvedPluginsRoot = resolve(pluginsRoot)
  const lifecycle = readLifecycleRegistry(resolvedPluginsRoot)
  readSourceReleaseChannel(resolvedPluginsRoot)
  const alphaPlugins = new Set(Object.keys(lifecycle))
  const productPlugins: readonly string[] = PRODUCT_PLUGINS.filter(name => releaseChannel === 'development' || !alphaPlugins.has(name))
  for (const name of alphaPlugins) {
    if (!(PRODUCT_PLUGINS as readonly string[]).includes(name)) throw new Error(`unknown lifecycle plugin: ${name}`)
  }
  for (const name of PRODUCT_PLUGINS) assertProductPluginSource(resolvedPluginsRoot, name)
  mkdirSync(targetPresetDir, { recursive: true })
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
    for (const name of productPlugins) {
      const source = realpathSync(join(resolvedPluginsRoot, name))
      const destination = join(stagedPackagesRoot, ...packageDirSegments(name))
      registerPackage(packages, name, source, destination)
    }
    const copied = new Set<string>()
    for (const name of productPlugins) {
      const entry = packages.get(name)!
      copyPackageClosure(
        name,
        entry.source,
        entry.destination,
        stagedPackagesRoot,
        packages,
        copied,
        releaseChannel === 'production' ? alphaPlugins : new Set(),
      )
      dependencies[name] = toFileSpec(staging, entry.destination)
    }
    writeReleaseChannel(join(stagedPackagesRoot, 'omnimux'), releaseChannel)
    for (const [name, entry] of packages) {
      if (productPlugins.includes(name)) continue
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
    assertNoAlphaPackages(join(staging, 'node_modules'), alphaPlugins, releaseChannel)

    candidateDir = mkdtempSync(join(targetPresetDir, '.preset-stage-'))
    const candidatePluginsDir = join(candidateDir, 'plugins')
    mkdirSync(candidatePluginsDir)
    copyHoistedModules(join(staging, 'node_modules'), candidatePluginsDir)
    const owned = listPackageNames(candidatePluginsDir)
    for (const required of [...productPlugins, 'dsh-better-sidebar']) {
      if (!owned.includes(required)) {
        throw new Error(`staged preset is missing required plugin ${required}: ${owned.join(', ')}`)
      }
    }
    assertNoAlphaPackages(candidatePluginsDir, alphaPlugins, releaseChannel)
    assertReleaseChannel(candidatePluginsDir, releaseChannel)
    verifyInstalledBetterSidebar(join(candidatePluginsDir, 'dsh-better-sidebar'), sidebar.packedRoot)
    stageSkeleton(targetPresetDir, candidateDir, alphaPlugins, releaseChannel)
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
  excludedPackages: ReadonlySet<string>,
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
      if (excludedPackages.has(dependencyName)) {
        throw new Error(`production plugin ${JSON.stringify(name)} depends on Alpha plugin ${JSON.stringify(dependencyName)}`)
      }
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
        excludedPackages,
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

function readLifecycleRegistry(pluginsRoot: string): Readonly<Record<string, LifecycleEntry>> {
  const path = join(pluginsRoot, 'omnimux', 'src', 'plugin-lifecycle.json')
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`plugin lifecycle registry is unreadable (${path}): ${String(error)}`)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`plugin lifecycle registry must be an object: ${path}`)
  }
  if (Object.keys(value).length === 0) {
    throw new Error(`plugin lifecycle registry must contain at least one entry: ${path}`)
  }
  for (const [pluginId, entry] of Object.entries(value)) {
    packageDirSegments(pluginId)
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`invalid lifecycle entry: ${pluginId}`)
    }
    const candidate = entry as Partial<LifecycleEntry>
    if (candidate.stage !== 'alpha' || !Array.isArray(candidate.toolPrefixes)) {
      throw new Error(`invalid lifecycle entry: ${pluginId}`)
    }
    if (candidate.toolPrefixes.some(prefix => typeof prefix !== 'string' || prefix.length === 0)) {
      throw new Error(`invalid lifecycle tool prefix: ${pluginId}`)
    }
  }
  return value as Record<string, LifecycleEntry>
}

function readSourceReleaseChannel(pluginsRoot: string): void {
  const path = join(pluginsRoot, 'omnimux', 'src', 'release-channel.json')
  const channel = readReleaseChannel(path)
  if (channel !== 'development') {
    throw new Error(`product source release channel must be development: ${path}`)
  }
}

function readReleaseChannel(path: string): ReleaseChannel {
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`release channel marker is unreadable (${path}): ${String(error)}`)
  }
  const channel = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as { channel?: unknown }).channel
    : undefined
  if (channel !== 'production' && channel !== 'development') {
    throw new Error(`release channel marker is invalid (${path}): ${JSON.stringify(channel)}`)
  }
  return channel
}

function assertProductPluginSource(pluginsRoot: string, name: string): void {
  const path = join(pluginsRoot, ...packageDirSegments(name), 'package.json')
  if (!existsSync(path)) {
    throw new Error(`product plugin source is missing: ${dirname(path)} (set OMNIMUX_PLUGINS_DIR)`)
  }
  const manifest = readManifest(path)
  if (manifest.name !== name) {
    throw new Error(`product plugin source ${path} declares name ${JSON.stringify(manifest.name)}, expected ${JSON.stringify(name)}`)
  }
}

function writeReleaseChannel(hubRoot: string, releaseChannel: ReleaseChannel): void {
  writeFileSync(
    join(hubRoot, 'src', 'release-channel.json'),
    `${JSON.stringify({ channel: releaseChannel }, undefined, 2)}\n`,
  )
}

function assertReleaseChannel(pluginsDir: string, releaseChannel: ReleaseChannel): void {
  const path = join(pluginsDir, 'omnimux', 'src', 'release-channel.json')
  if (readReleaseChannel(path) !== releaseChannel) {
    throw new Error(`staged hub release channel does not match ${releaseChannel}: ${path}`)
  }
}

function assertNoAlphaPackages(
  pluginsDir: string,
  alphaPlugins: ReadonlySet<string>,
  releaseChannel: ReleaseChannel,
): void {
  if (releaseChannel !== 'production') return
  const found = listPackageNames(pluginsDir).filter(name => alphaPlugins.has(name))
  if (found.length > 0) {
    throw new Error(`production preset contains Alpha packages: ${found.join(', ')}`)
  }
}

function stageSkeleton(
  targetPresetDir: string,
  candidateDir: string,
  alphaPlugins: ReadonlySet<string>,
  releaseChannel: ReleaseChannel,
): void {
  const source = join(targetPresetDir, 'skeleton')
  const destination = join(candidateDir, 'skeleton')
  if (!existsSync(join(source, 'package.json'))) {
    throw new Error(`desktop preset skeleton package.json is missing: ${join(source, 'package.json')}`)
  }
  cpSync(source, destination, { recursive: true, dereference: true })
  const manifestPath = join(destination, 'package.json')
  const manifest = readManifest(manifestPath)
  const currentBundles = manifest.dsh?.profile?.bundles
  if (!Array.isArray(currentBundles) || currentBundles.some(name => typeof name !== 'string' || name === '')) {
    throw new Error(`desktop preset skeleton bundles are invalid: ${manifestPath}`)
  }
  const bundles = currentBundles.filter(name => !alphaPlugins.has(name))
  if (releaseChannel === 'development') {
    for (const name of alphaPlugins) if (!bundles.includes(name)) bundles.push(name)
  }
  const missingCore = CORE_REQUIRED_BUNDLES.filter(name => !bundles.includes(name))
  if (missingCore.length > 0) {
    throw new Error(`desktop preset skeleton is missing mandatory bundles: ${missingCore.join(', ')}`)
  }
  const stripAlpha = (dependencies: Record<string, string> | undefined): Record<string, string> | undefined => {
    if (dependencies === undefined || releaseChannel === 'development') return dependencies
    return Object.fromEntries(Object.entries(dependencies).filter(([name]) => !alphaPlugins.has(name)))
  }
  writeFileSync(manifestPath, `${JSON.stringify({
    ...manifest,
    dependencies: stripAlpha(manifest.dependencies),
    optionalDependencies: stripAlpha(manifest.optionalDependencies),
    devDependencies: stripAlpha(manifest.devDependencies),
    dsh: {
      ...manifest.dsh,
      profile: {
        ...manifest.dsh?.profile,
        bundles,
      },
    },
  }, undefined, 2)}\n`)
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
  const entries = ['plugins', 'skeleton', 'owned-packages.json', 'seed-version'] as const
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
  const count = stagePresetProfile({ releaseChannel: parseReleaseChannel(process.argv.slice(2)) })
  process.stdout.write(`staged ${String(count)} preset packages into ${defaultPluginsDir}\n`)
}

export function parseReleaseChannel(args: readonly string[]): ReleaseChannel {
  if (args.length === 0) return 'production'
  if (args.length === 2 && args[0] === '--channel' && RELEASE_CHANNELS.includes(args[1] as ReleaseChannel)) {
    return args[1] as ReleaseChannel
  }
  throw new Error('usage: stage-preset-profile.ts [--channel production|development]')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
