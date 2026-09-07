/** First-run seed of the OmniMux desktop profile. Never calls pnpm. */

import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { parseDocument } from 'yaml'
import {
  assertExistingManagedProfile,
  assertFreshManagedProfileDestination,
  assertManagedSourceGraph,
  createFreshManagedSources,
  managedSourcePath,
} from './managed-profile.ts'

/** Profile name the desktop Host boots. */
export const OMNIMUX_PROFILE_NAME = 'omnimux'

/** File in the packaged preset that holds the monotone seed integer. */
export const SEED_VERSION_FILENAME = 'seed-version'

/** Generated list of package directories the preset owns under `plugins/`. */
export const OWNED_PACKAGES_FILENAME = 'owned-packages.json'

/** Stamp written inside the user profile after a successful seed or refresh. */
export const PROFILE_SEED_STAMP = '.omnimux-seed-version'

/** Retry fence removed only after packaged pnpm completes a fresh install. */
export const PROFILE_MATERIALIZATION_PENDING = '.omnimux-materialization-pending'

/** Core bundle names every staged OmniMux desktop profile must retain. */
export const REQUIRED_BUNDLES = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  'dsh-better-sidebar',
  'omnimux',
] as const

type ReleaseChannel = 'production' | 'development'

interface PresetPolicy {
  readonly requiredBundles: readonly string[]
  readonly excludedPackages: readonly string[]
}

/** Inputs for {@link seedOmnimuxProfile}. */
export interface SeedOmnimuxProfileOptions {
  /** Harness home (`$DSH_HOME` or `~/.dsh`). */
  readonly home: string
  /** Packaged or checkout preset directory. */
  readonly presetDir: string
}

/** Outcome of one seed pass. */
export interface SeedOmnimuxProfileResult {
  /** Absolute profile directory. */
  readonly profileDir: string
  /** True when `package.json` did not exist before this call. */
  readonly created: boolean
  /** True when owned plugin directories were copied this call. */
  readonly refreshedPlugins: boolean
  /** True while a fresh Profile still needs its first successful pnpm install. */
  readonly materializationRequired: boolean
}

/** Explicit unpackaged Electron QA identity contained within one prepared L2 task. */
export interface DesktopL2Launch {
  task: string
  homeDir: string
  userDataDir: string
}

/** Resolve only the explicit task flag; ambient home/channel variables cannot opt into L2. */
export function resolveDesktopL2Launch(options: {
  argv: readonly string[]
  isPackaged: boolean
  homeDirectory?: string
}): DesktopL2Launch | undefined {
  const flags = options.argv.filter(arg => arg.startsWith('--omnimux-l2-task'))
  if (flags.length === 0) return undefined
  if (options.isPackaged) throw new Error('L2 task launch requires an unpackaged Electron runtime')
  const task = flags.length === 1 ? /^--omnimux-l2-task=([A-Za-z0-9_-]+)$/.exec(flags[0]!)?.[1] : undefined
  if (task === undefined) throw new Error('Expected one --omnimux-l2-task=<task> flag')
  const userHome = realpathSync(options.homeDirectory ?? homedir())
  const homeDir = join(userHome, '.dsh-dev', 'tasks', task)
  const userDataDir = join(homeDir, 'electron-user-data')
  for (const directory of [homeDir, userDataDir]) {
    if (realpathSync(directory) !== directory || !statSync(directory).isDirectory()) {
      throw new Error('L2 task home and electron-user-data must be prepared directories without symlink redirects')
    }
  }
  return { task, homeDir, userDataDir }
}

/**
 * Resolve the application-scoped Harness home directory.
 *
 * Priority (OmniMux desktop identity always wins over ambient `$DSH_HOME`):
 * 1. OmniMux Dev (name/userData/OMNIMUX_DEV/OMNIMUX_CHANNEL=dev) -> ~/.omnimux-dev
 * 2. OmniMux Release (name/userData/OMNIMUX_CHANNEL=prod) -> ~/.omnimux
 * 3. Explicit `$DSH_HOME` for upstream / custom harness overrides
 * 4. Upstream default fallback -> ~/.dsh
 *
 * Why identity wins: macOS Dock/Finder launches inherit login-shell env, which
 * often carries `DSH_HOME=~/.dsh`. If ambient env were allowed to override Dev/
 * Prod identity, both apps would collapse onto ~/.dsh and break physical isolation.
 */
export function resolveDesktopHarnessHome(options?: {
  env?: NodeJS.ProcessEnv
  userDataDir?: string
  appName?: string
  execPath?: string
}): string {
  const env = options?.env ?? process.env
  const name = options?.appName ?? ''
  const userData = options?.userDataDir ?? ''
  const execPath = options?.execPath ?? ''
  const channel = (env.OMNIMUX_CHANNEL ?? '').trim().toLowerCase()

  // 1. App identity takes precedence for OmniMux variants to guarantee physical profile isolation
  if (
    name.includes('Dev')
    || userData.includes('OmniMux-Dev')
    || userData.includes('omnimux-dev')
    || execPath.includes('OmniMux Dev')
    || execPath.includes('OmniMux-Dev')
    || env.OMNIMUX_DEV === '1'
    || channel === 'dev'
  ) {
    return join(homedir(), '.omnimux-dev')
  }
  if (
    name.includes('OmniMux')
    || userData.includes('OmniMux')
    || userData.includes('omnimux')
    || channel === 'prod'
  ) {
    return join(homedir(), '.omnimux')
  }

  // 2. Explicit DSH_HOME for generic / custom harness overrides
  const fromEnv = env.DSH_HOME
  if (fromEnv !== undefined && fromEnv.trim() !== '') return resolve(expandHome(fromEnv.trim()))

  // 3. Fallback to standard ~/.dsh
  return join(homedir(), '.dsh')
}

/**
 * Resolve the Harness home with OmniMux desktop identity awareness.
 * @param env - environment mapping; defaults to `process.env`.
 * @returns absolute Harness home.
 */
export function resolveHarnessHome(env: NodeJS.ProcessEnv = process.env): string {
  return resolveDesktopHarnessHome({ env })
}

/**
 * Seed initial settings.yaml and credentials in the isolated OmniMux home if absent.
 * If fresh and an existing ~/.dsh/settings.yaml exists, bootstrap user credentials and models while enforcing compatibility mode.
 */
export function seedOmnimuxSettings(homeDir: string): void {
  const targetHome = resolve(homeDir)
  mkdirSync(targetHome, { recursive: true })
  const settingsFile = join(targetHome, 'settings.yaml')
  const globalDshHome = join(homedir(), '.dsh')

  // 1. Initial settings.yaml bootstrapping
  if (!existsSync(settingsFile)) {
    const globalSettingsFile = join(globalDshHome, 'settings.yaml')
    if (existsSync(globalSettingsFile) && targetHome !== globalDshHome) {
      try {
        const raw = readFileSync(globalSettingsFile, 'utf8')
        const doc = parseDocument(raw)
        // Ensure dsh-desktop is configured with compatibility mode
        const desktop = doc.get('dsh-desktop')
        if (desktop && typeof (desktop as any).set === 'function') {
          ;(desktop as any).set('mode', 'compatibility')
        } else {
          doc.set('dsh-desktop', {
            mode: 'compatibility',
            macosMaterial: 'transparent',
            windowsMaterial: 'acrylic',
            openBrowser: false,
            networkExposure: 'loopback',
          })
        }
        // Ensure dsh-better-sidebar defaults (agentOpenTools + loopback browser access)
        const sidebar = doc.get('dsh-better-sidebar')
        if (sidebar && typeof (sidebar as any).set === 'function') {
          if ((sidebar as any).get('agentOpenTools') === undefined) {
            ;(sidebar as any).set('agentOpenTools', true)
          }
          if ((sidebar as any).get('browserAllowedLoopback') === undefined) {
            ;(sidebar as any).set('browserAllowedLoopback', '127.0.0.1, localhost')
          }
          const tabs = (sidebar as any).get('tabsEnabled')
          if (tabs && typeof (tabs as any).set === 'function') {
            if ((tabs as any).get('browser') === undefined) {
              ;(tabs as any).set('browser', true)
            }
          } else if (tabs === undefined) {
            ;(sidebar as any).set('tabsEnabled', { browser: true })
          }
        } else if (!sidebar) {
          doc.set('dsh-better-sidebar', {
            agentOpenTools: true,
            browserAllowedLoopback: '127.0.0.1, localhost',
            tabsEnabled: { browser: true },
          })
        }
        writeFileSync(settingsFile, doc.toString())
      } catch {
        writeCleanCompatibilitySettings(settingsFile)
      }
    } else {
      writeCleanCompatibilitySettings(settingsFile)
    }
  }

  // 2. Initial .credentials.yaml bootstrapping (API Keys migration)
  const credsFile = join(targetHome, '.credentials.yaml')
  const globalCreds = join(globalDshHome, '.credentials.yaml')
  if (!existsSync(credsFile) && existsSync(globalCreds) && targetHome !== globalDshHome) {
    try {
      cpSync(globalCreds, credsFile)
    } catch {}
  }
}

function writeCleanCompatibilitySettings(settingsFile: string): void {
  const initial = [
    'ui-onboarding:',
    '  welcomeNoticeVersion: 2026-08-13.1',
    'locale:',
    '  preference: zh',
    'permission:',
    '  defaultPreset: danger-full-access',
    'dsh-desktop:',
    '  mode: compatibility',
    '  macosMaterial: transparent',
    '  windowsMaterial: acrylic',
    '  openBrowser: false',
    '  networkExposure: loopback',
    'dsh-better-sidebar:',
    '  agentOpenTools: true',
    '  browserAllowedLoopback: 127.0.0.1, localhost',
    '  tabsEnabled:',
    '    browser: true',
    '',
  ].join('\n')
  writeFileSync(settingsFile, initial)
}

/**
 * Seed or upgrade `$DSH_HOME/profiles/omnimux` from the packaged preset.
 * Existing managed profiles are preserved except for formal-release policy
 * changes, which remove excluded product plugins and refresh the policy-owning
 * hub. Fresh profiles receive physical package sources outside `node_modules`;
 * startup then runs the packaged pnpm materializer before composing the Profile.
 * @param options - Harness home and preset directory.
 * @returns which writes this call performed.
 */
export function seedOmnimuxProfile(options: SeedOmnimuxProfileOptions): SeedOmnimuxProfileResult {
  const presetDir = resolve(options.presetDir)
  const version = readSeedVersion(join(presetDir, SEED_VERSION_FILENAME))
  const skeletonDir = join(presetDir, 'skeleton')
  const pluginsDir = join(presetDir, 'plugins')
  const policy = readPresetPolicy(skeletonDir, pluginsDir)
  assertFile(join(skeletonDir, 'package.json'), 'desktop preset skeleton package.json is missing')
  assertFile(join(skeletonDir, 'cordis.patch.yml'), 'desktop preset skeleton cordis.patch.yml is missing')
  for (const name of policy.requiredBundles) {
    if (name.startsWith('@deepseek-ai/')) continue
    assertFile(
      join(pluginsDir, name, 'package.json'),
      `desktop preset is missing ${name}; run scripts/stage-preset-profile.ts`,
    )
  }

  const profileDir = join(resolve(options.home), 'profiles', OMNIMUX_PROFILE_NAME)
  const candidateDir = join(dirname(profileDir), `.${basename(profileDir)}-initializing`)
  const created = !existsSync(join(profileDir, 'package.json'))
  const owned = readOwnedPackages(presetDir, pluginsDir)
  const excludedOwned = owned.filter(name => policy.excludedPackages.includes(name))
  if (excludedOwned.length > 0) {
    throw new Error(`production desktop preset owns excluded Alpha packages: ${excludedOwned.join(', ')}`)
  }
  assertManagedSourceGraph(pluginsDir, owned)
  if (!created) {
    assertExistingManagedProfile(profileDir, owned)
    assertRequiredBundles(profileDir, policy.requiredBundles)
    const policyChanged = removeExcludedPackages(
      profileDir,
      pluginsDir,
      policy.excludedPackages,
      version,
    )
    seedOmnimuxSettings(options.home)
    return {
      profileDir,
      created: false,
      refreshedPlugins: policyChanged,
      materializationRequired: policyChanged || existsSync(join(profileDir, PROFILE_MATERIALIZATION_PENDING)),
    }
  }

  // Validate the complete packaged source graph before the first Profile write.
  assertFreshManagedProfileDestination(profileDir, candidateDir)
  mkdirSync(dirname(profileDir), { recursive: true })
  rmSync(candidateDir, { recursive: true, force: true })
  mkdirSync(candidateDir)
  try {
    copyFreshConfiguration(profileDir, candidateDir)
    writeSkeletonIfAbsent(skeletonDir, candidateDir)
    ensureMinimumReleaseAgeDisabled(candidateDir)
    mergeRequiredBundles(candidateDir, policy.requiredBundles)
    createFreshManagedSources(presetDir, candidateDir, owned)
    writeFileSync(join(candidateDir, PROFILE_SEED_STAMP), `${String(version)}\n`)
    writeFileSync(join(candidateDir, PROFILE_MATERIALIZATION_PENDING), `${String(version)}\n`)
    seedOmnimuxSettings(options.home)
    publishFreshCandidate(candidateDir, profileDir, owned)
  } finally {
    rmSync(candidateDir, { recursive: true, force: true })
  }
  return { profileDir, created: true, refreshedPlugins: true, materializationRequired: true }
}

/** Mark the retryable first install complete after packaged pnpm succeeds. */
export function completeOmnimuxProfileMaterialization(profileDir: string): void {
  rmSync(join(profileDir, PROFILE_MATERIALIZATION_PENDING), { force: true })
}

function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

function assertFile(path: string, message: string): void {
  if (!existsSync(path)) throw new Error(`${message}: ${path}`)
}

function readSeedVersion(path: string): number {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8').trim()
  } catch (error) {
    throw new Error(`desktop preset seed-version is unreadable (${path}): ${String(error)}`)
  }
  const version = Number.parseInt(raw, 10)
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`desktop preset seed-version must be a positive integer: ${JSON.stringify(raw)}`)
  }
  return version
}

function writeSkeletonIfAbsent(skeletonDir: string, profileDir: string): void {
  for (const name of ['package.json', 'cordis.patch.yml', 'pnpm-workspace.yaml'] as const) {
    const destination = join(profileDir, name)
    if (existsSync(destination)) continue
    const source = join(skeletonDir, name)
    if (!existsSync(source)) throw new Error(`desktop preset skeleton is missing ${name}: ${source}`)
    writeFileSync(destination, readFileSync(source))
  }
}

function copyFreshConfiguration(profileDir: string, candidateDir: string): void {
  if (!existsSync(profileDir)) return
  for (const name of ['cordis.patch.yml', 'pnpm-workspace.yaml'] as const) {
    const source = join(profileDir, name)
    if (existsSync(source)) cpSync(source, join(candidateDir, name))
  }
}

function replaceFreshEntry(source: string, destination: string): void {
  rmSync(destination, { recursive: true, force: true })
  renameSync(source, destination)
}

function publishFreshFile(source: string, destination: string): void {
  renameSync(source, destination)
}

function publishFreshCandidate(candidateDir: string, profileDir: string, ownedPackages: readonly string[]): void {
  mkdirSync(profileDir, { recursive: true })
  publishFreshFile(
    join(candidateDir, PROFILE_MATERIALIZATION_PENDING),
    join(profileDir, PROFILE_MATERIALIZATION_PENDING),
  )
  for (const name of ['cordis.patch.yml', 'pnpm-workspace.yaml', PROFILE_SEED_STAMP] as const) {
    publishFreshFile(join(candidateDir, name), join(profileDir, name))
  }
  for (const name of ownedPackages) {
    const destination = managedSourcePath(profileDir, name)
    mkdirSync(dirname(destination), { recursive: true })
    replaceFreshEntry(managedSourcePath(candidateDir, name), destination)
  }
  // package.json is the commit point: before this atomic rename, retries still
  // classify the Profile as fresh; afterwards the pending fence forces pnpm.
  renameSync(join(candidateDir, 'package.json'), join(profileDir, 'package.json'))
}

/** pnpm 11 defaults to a 1-day release-age window; user-chosen plugins must install now. */
function ensureMinimumReleaseAgeDisabled(profileDir: string): void {
  const path = join(profileDir, 'pnpm-workspace.yaml')
  if (!existsSync(path)) return
  const current = readFileSync(path, 'utf8')
  if (/(?:^|\n)minimumReleaseAge\s*:/u.test(current)) return
  const suffix = current.endsWith('\n') ? '' : '\n'
  writeFileSync(path, `${current}${suffix}minimumReleaseAge: 0\n`)
}

function mergeRequiredBundles(profileDir: string, requiredBundles: readonly string[]): void {
  const path = join(profileDir, 'package.json')
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
    dependencies?: Record<string, string>
  } & {
    dsh?: { profile?: { bundles?: string[] } }
  }
  const current = manifest.dsh?.profile?.bundles ?? []
  const bundles = [...current]
  for (const name of requiredBundles) {
    if (!bundles.includes(name)) bundles.push(name)
  }
  if (bundles.length === current.length && bundles.every((name, index) => name === current[index])) return
  writeFileSync(path, `${JSON.stringify({
    ...manifest,
    dsh: {
      ...manifest.dsh,
      profile: {
        ...manifest.dsh?.profile,
        bundles,
      },
    },
  }, undefined, 2)}\n`)
}

function assertRequiredBundles(profileDir: string, requiredBundles: readonly string[]): void {
  const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as {
    dsh?: { profile?: { bundles?: string[] } }
  }
  const bundles = manifest.dsh?.profile?.bundles ?? []
  const missing = requiredBundles.filter(name => !bundles.includes(name))
  if (missing.length > 0) {
    throw new Error(
      `OmniMux Profile is missing required bundles ${missing.join(', ')}; repair the Profile manifest explicitly. `
      + 'The managed-source rebuild preserves bundle configuration and cannot add them.',
    )
  }
}

function readPresetPolicy(skeletonDir: string, pluginsDir: string): PresetPolicy {
  const skeletonPath = join(skeletonDir, 'package.json')
  const skeleton = readJsonObject(skeletonPath, 'desktop preset skeleton') as {
    dsh?: { profile?: { bundles?: unknown } }
  }
  const bundles = skeleton.dsh?.profile?.bundles
  if (!Array.isArray(bundles) || bundles.some(name => typeof name !== 'string' || name === '')) {
    throw new Error(`desktop preset skeleton bundles are invalid: ${skeletonPath}`)
  }
  const requiredBundles = bundles as string[]
  const missingCore = REQUIRED_BUNDLES.filter(name => !requiredBundles.includes(name))
  if (missingCore.length > 0) {
    throw new Error(`desktop preset skeleton is missing mandatory bundles: ${missingCore.join(', ')}`)
  }

  const hubSource = join(pluginsDir, 'omnimux', 'src')
  const markerPath = join(hubSource, 'release-channel.json')
  const marker = readJsonObject(markerPath, 'release channel marker') as { channel?: unknown }
  const channel = marker.channel
  if (channel !== 'production' && channel !== 'development') {
    throw new Error(`release channel marker is invalid (${markerPath}): ${JSON.stringify(channel)}`)
  }
  const releaseChannel: ReleaseChannel = channel

  const lifecyclePath = join(hubSource, 'plugin-lifecycle.json')
  const lifecycle = readJsonObject(lifecyclePath, 'plugin lifecycle registry')
  if (Object.keys(lifecycle).length === 0) {
    throw new Error(`plugin lifecycle registry must contain at least one entry: ${lifecyclePath}`)
  }
  const alphaPlugins: string[] = []
  for (const [pluginId, entry] of Object.entries(lifecycle)) {
    packageDirSegments(pluginId)
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`invalid lifecycle entry: ${pluginId}`)
    }
    const candidate = entry as { stage?: unknown; toolPrefixes?: unknown }
    if (
      candidate.stage !== 'alpha'
      || !Array.isArray(candidate.toolPrefixes)
      || candidate.toolPrefixes.some(prefix => typeof prefix !== 'string' || prefix.length === 0)
    ) {
      throw new Error(`invalid lifecycle entry: ${pluginId}`)
    }
    alphaPlugins.push(pluginId)
  }
  if (releaseChannel === 'production') {
    const includedAlpha = requiredBundles.filter(name => alphaPlugins.includes(name))
    if (includedAlpha.length > 0) {
      throw new Error(`production desktop preset includes Alpha bundles: ${includedAlpha.join(', ')}`)
    }
  }
  return {
    requiredBundles,
    excludedPackages: releaseChannel === 'production' ? alphaPlugins : [],
  }
}

function readJsonObject(path: string, label: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`${label} is unreadable (${path}): ${String(error)}`)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object: ${path}`)
  }
  return value as Record<string, unknown>
}

function removeExcludedPackages(
  profileDir: string,
  presetPluginsDir: string,
  excludedPackages: readonly string[],
  seedVersion: number,
): boolean {
  if (excludedPackages.length === 0) return false
  const manifestPath = join(profileDir, 'package.json')
  const manifest = readJsonObject(manifestPath, 'OmniMux Profile manifest') as {
    dependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: string[] } }
  }
  const dependencies = { ...manifest.dependencies }
  const optionalDependencies = manifest.optionalDependencies === undefined
    ? undefined
    : { ...manifest.optionalDependencies }
  const devDependencies = manifest.devDependencies === undefined
    ? undefined
    : { ...manifest.devDependencies }
  const currentBundles = manifest.dsh?.profile?.bundles ?? []
  const bundles = currentBundles.filter(name => !excludedPackages.includes(name))
  const packagedHub = join(presetPluginsDir, 'omnimux')
  const installedHub = managedSourcePath(profileDir, 'omnimux')
  const hubPolicyFiles = [
    'src/release-channel.json',
    'src/plugin-lifecycle.json',
    'src/gate/guard.js',
  ] as const
  const hubNeedsRefresh = hubPolicyFiles.some(relativePath => !filesEqual(
    join(packagedHub, relativePath),
    join(installedHub, relativePath),
  ))
  let changed = bundles.length !== currentBundles.length || hubNeedsRefresh
  for (const name of excludedPackages) {
    for (const dependencyMap of [dependencies, optionalDependencies, devDependencies]) {
      if (dependencyMap === undefined) continue
      if (Object.hasOwn(dependencyMap, name)) {
        delete dependencyMap[name]
        changed = true
      }
    }
    if (existsSync(managedSourcePath(profileDir, name)) || existsSync(join(profileDir, 'node_modules', ...packageDirSegments(name)))) {
      changed = true
    }
  }
  if (!changed) return false

  const updateDir = mkdtempSync(join(profileDir, '.release-policy-'))
  try {
    const candidate = join(updateDir, 'package.json')
    const hubCandidate = join(updateDir, 'omnimux')
    if (hubNeedsRefresh) cpSync(packagedHub, hubCandidate, { recursive: true, dereference: true })
    writeFileSync(candidate, `${JSON.stringify({
      ...manifest,
      dependencies,
      ...(optionalDependencies === undefined ? {} : { optionalDependencies }),
      ...(devDependencies === undefined ? {} : { devDependencies }),
      dsh: {
        ...manifest.dsh,
        profile: {
          ...manifest.dsh?.profile,
          bundles,
        },
      },
    }, undefined, 2)}\n`)
    writeFileSync(join(profileDir, PROFILE_MATERIALIZATION_PENDING), `${String(seedVersion)}\n`)
    renameSync(candidate, manifestPath)
    if (hubNeedsRefresh) replaceManagedHub(installedHub, hubCandidate)
  } finally {
    rmSync(updateDir, { recursive: true, force: true })
  }
  for (const name of excludedPackages) {
    rmSync(managedSourcePath(profileDir, name), { recursive: true, force: true })
    rmSync(join(profileDir, 'node_modules', ...packageDirSegments(name)), { recursive: true, force: true })
  }
  if (hubNeedsRefresh) {
    rmSync(join(profileDir, 'node_modules', 'omnimux'), { recursive: true, force: true })
  }
  return true
}

function filesEqual(left: string, right: string): boolean {
  if (!existsSync(left) || !existsSync(right)) return existsSync(left) === existsSync(right)
  return readFileSync(left).equals(readFileSync(right))
}

export function replaceManagedHub(installedHub: string, candidateHub: string, rename: typeof renameSync = renameSync): void {
  // Keep recovery data outside the disposable release-policy staging directory.
  const backupRoot = mkdtempSync(join(dirname(installedHub), '.omnimux-previous-'))
  const backup = join(backupRoot, 'omnimux')
  let retainBackup = false
  try {
    rename(installedHub, backup)
    try {
      rename(candidateHub, installedHub)
    } catch (error) {
      try { rename(backup, installedHub) }
      catch (rollbackError) {
        retainBackup = true
        throw new Error(`hub policy update failed (${String(error)}); rollback also failed; previous hub retained at ${backup}: ${String(rollbackError)}`)
      }
      throw error
    }
  } finally {
    if (!retainBackup) rmSync(backupRoot, { recursive: true, force: true })
  }
}

export function readOwnedPackages(presetDir: string, pluginsDir: string = join(presetDir, 'plugins')): string[] {
  const listed = join(presetDir, OWNED_PACKAGES_FILENAME)
  if (existsSync(listed)) {
    const parsed = JSON.parse(readFileSync(listed, 'utf8')) as unknown
    if (!Array.isArray(parsed) || parsed.some(entry => typeof entry !== 'string' || entry === '')) {
      throw new Error(`desktop preset ${OWNED_PACKAGES_FILENAME} must be a JSON array of package names`)
    }
    return parsed
  }
  return listPackageNames(pluginsDir)
}

/** Package directory segments: `omnimux` or `@scope/name`. */
export function packageDirSegments(name: string): string[] {
  if (name === '' || name.includes('\\') || name === '.' || name === '..' || isAbsolute(name)) {
    throw new Error(`desktop preset package name is invalid: ${JSON.stringify(name)}`)
  }
  const segments = name.split('/')
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`desktop preset package name is invalid: ${JSON.stringify(name)}`)
  }
  return segments
}

/**
 * Discover package names under a node_modules-like tree, including scoped packages.
 * @param root - directory that holds package folders.
 * @returns package names in directory order.
 */
export function listPackageNames(root: string): string[] {
  if (!existsSync(root)) return []
  const names: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.bin' || entry.name === '.pnpm') continue
    if (entry.name.startsWith('@')) {
      for (const child of readdirSync(join(root, entry.name), { withFileTypes: true })) {
        if (!child.isDirectory()) continue
        if (existsSync(join(root, entry.name, child.name, 'package.json'))) {
          names.push(`${entry.name}/${child.name}`)
        }
      }
      continue
    }
    if (existsSync(join(root, entry.name, 'package.json'))) names.push(entry.name)
  }
  return names
}
