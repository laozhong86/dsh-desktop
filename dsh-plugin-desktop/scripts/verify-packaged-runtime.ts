/** Fail-loud verification of the runtime entries sealed into Electron's app.asar. */

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, sep, parse } from 'node:path'
import { Worker } from 'node:worker_threads'
import { listPackage } from '@electron/asar'
import AdmZip from 'adm-zip'
import {
  FORBIDDEN_MACOS_UNIVERSAL_ENTRIES,
  MACOS_UNIVERSAL_NATIVE_ENTRIES,
} from './mac-universal.ts'

/** Resolve a package root even when its exports hide `package.json`. */
export function resolveRuntimePackageRoot(
  packageName: string,
  resolveEntry: (specifier: string) => string = createRequire(import.meta.url).resolve,
  readManifest: (filename: string) => string = filename => readFileSync(filename, 'utf8'),
): string {
  let manifestCause: unknown
  try {
    return dirname(resolveEntry(`${packageName}/package.json`))
  } catch (cause) {
    manifestCause = cause
  }

  let directory = dirname(resolveEntry(packageName))
  const root = parse(directory).root
  while (true) {
    try {
      const manifest: unknown = JSON.parse(readManifest(join(directory, 'package.json')))
      if (manifest !== null
        && typeof manifest === 'object'
        && (manifest as { name?: unknown }).name === packageName) {
        return directory
      }
    } catch {
      // Continue toward the filesystem root until the owning manifest is found.
    }
    if (directory === root) {
      throw new Error(`dsh-plugin-desktop: cannot locate package root for ${packageName}`, {
        cause: manifestCause,
      })
    }
    directory = dirname(directory)
  }
}

const DSH_PACKAGE_ROOT = resolveRuntimePackageRoot('@deepseek-ai/dsh')
const PNPM_PACKAGE_ROOT = resolveRuntimePackageRoot('pnpm')


/** Every generated JavaScript file shipped by the installed DSH CLI package. */
export const REQUIRED_DSH_CLI_RUNTIME_ENTRIES = Object.freeze(
  readdirSync(join(DSH_PACKAGE_ROOT, 'lib'), { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => `node_modules/@deepseek-ai/dsh/lib/${entry.name}`)
    .sort(),
)

/** AfterPack fields consumed without importing Electron Builder's incomplete declaration graph. */
export interface PackagedRuntimeContext {
  /** Completed platform application directory. */
  readonly appOutDir: string
  /** Electron Builder target architecture (`4` is its stable universal enum value). */
  readonly arch?: number
  /** Electron target platform selected by the packager. */
  readonly electronPlatformName: string
  /** Product metadata used to locate the macOS application bundle. */
  readonly packager: {
    readonly executableName?: string
    readonly appInfo: {
      readonly productFilename: string
    }
  }
}

/** Exact archive entries required by the desktop launcher on every supported platform. */
export const REQUIRED_PACKAGED_RUNTIME_ENTRIES = [
  'package.json',
  'lib/main.js',
  'lib/client.js',
  'lib/native-ui/profile-create.html',
  'lib/native-ui/recovery.html',
  'lib/native-ui/setup-wizard.html',
  'lib/profile.js',
  'lib/profile-manager.js',
  'lib/profile-service.js',
  'lib/pnpm.js',
  'lib/profiles.js',
  'lib/diagnostics.js',
  'lib/diagnostic-export-worker.js',
  'lib/desktop-cli.js',
  'lib/desktop-runtime-environment.js',
  'lib/desktop-terminal.js',
  'lib/terminal.js',
  'lib/update-checker.js',
  'lib/update-download.js',
  'lib/updates.js',
  'lib/windows-acl-runner.js',
  ...REQUIRED_DSH_CLI_RUNTIME_ENTRIES,
  'node_modules/@deepseek-ai/dsh-subprocess-local/lib/index.js',
  'node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html',
  'node_modules/@deepseek-ai/dsh-app-boot/lib/index.js',
  'node_modules/open/index.js',
  'node_modules/pnpm/bin/pnpm.mjs',
] as const

/** Physical entries required because profile fallback symlinks cannot target ASAR paths. */
export const REQUIRED_UNPACKED_RUNTIME_ENTRIES = [
  'package.json',
  'cordis.patch.yml',
  'build/app-icon.png',
  'build/app-icon-mac.png',
  'build/tray-iconTemplate.png',
  'build/tray-icon-blue.png',
  'lib/main.js',
  'lib/client.js',
  'lib/native-ui/profile-create.html',
  'lib/native-ui/recovery.html',
  'lib/native-ui/setup-wizard.html',
  'lib/index.js',
  'lib/profile.js',
  'lib/profile-manager.js',
  'lib/profile-service.js',
  'lib/pnpm.js',
  'lib/profiles.js',
  'lib/diagnostics.js',
  'lib/diagnostic-export-worker.js',
  'lib/terminal.js',
  'lib/update-download.js',
  'lib/updates.js',
  'lib/windows-pwsh-sandbox.js',
  'node_modules/@deepseek-ai/dsh/package.json',
  'node_modules/@deepseek-ai/dsh-agent-presets/package.json',
  'node_modules/@deepseek-ai/dsh-agent-presets/presets/cordis/agent.cordis.yml',
  'node_modules/@deepseek-ai/dsh-agent-presets/presets/cordis/skills/cordis-plugin-development/SKILL.md',
  'node_modules/@deepseek-ai/dsh-agent-presets/presets/cordis/skills/editing-cordis-compositions/SKILL.md',
  ...REQUIRED_DSH_CLI_RUNTIME_ENTRIES,
  'node_modules/@deepseek-ai/dsh-subprocess-local/lib/index.js',
  'node_modules/@deepseek-ai/dsh-app-boot/lib/index.js',
  'node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html',
  'node_modules/open/index.js',
  'node_modules/pnpm/bin/pnpm.mjs',
] as const

/** Prebuilt Node-API modules required when the Windows package skips native source rebuilds. */
export const REQUIRED_WINDOWS_X64_NODE_PTY_ENTRIES = [
  'node_modules/node-pty/prebuilds/win32-x64/conpty.node',
  'node_modules/node-pty/prebuilds/win32-x64/conpty_console_list.node',
  'node_modules/node-pty/prebuilds/win32-x64/conpty/OpenConsole.exe',
  'node_modules/node-pty/prebuilds/win32-x64/conpty/conpty.dll',
] as const

/** CPU-specific runtime assets that must coexist in a universal macOS application. */
export const REQUIRED_MACOS_UNIVERSAL_ENTRIES = [
  ...MACOS_UNIVERSAL_NATIVE_ENTRIES.map(entry => entry.path),
] as const

/** Package exports that profile fallback links must resolve from the physical application tree. */
export const REQUIRED_UNPACKED_PACKAGE_SPECIFIERS = [
  'dsh-plugin-desktop',
  'dsh-plugin-desktop/profile',
  'dsh-plugin-desktop/client',
  'dsh-plugin-desktop/terminal',
  'dsh-plugin-desktop/pnpm',
  'dsh-plugin-desktop/profile-service',
  'dsh-plugin-desktop/profiles',
  'dsh-plugin-desktop/diagnostics',
  'dsh-plugin-desktop/notifications',
  'dsh-plugin-desktop/updates',
  'dsh-plugin-desktop/windows-pwsh-sandbox',
  'dsh-plugin-desktop/package.json',
  '@deepseek-ai/dsh-base/package.json',
  '@deepseek-ai/schemastery/package.json',
  '@deepseek-ai/dsh-web-app/package.json',
] as const

/** Injectable archive listing seam used by focused tests. */
export type ArchiveLister = (archivePath: string, options: { isPack: boolean }) => readonly string[]

/** Injectable physical-file probe used by focused tests. */
export type FileProbe = (filename: string) => boolean

/** Injectable Node package resolver used by focused tests. */
export type PackageResolver = (specifier: string) => string

/** Inputs understood by the bundled diagnostics Worker. */
export interface PackagedDiagnosticWorkerData {
  readonly logsDir: string
  readonly userDataDir: string
  readonly appVersion: string
  readonly maxEvidenceBytes: number
  readonly crashDumpsDir: string
}

/** Injectable packaged Worker launcher used by focused tests. */
export type PackagedDiagnosticWorkerLauncher = (
  workerPath: string,
  workerData: PackagedDiagnosticWorkerData,
) => Promise<string>

/** Injectable smoke seam used to verify afterPack ordering. */
export type PackagedDiagnosticWorkerSmoke = (unpackedRoot: string) => Promise<void>

/** Result posted by the bundled diagnostics Worker. */
type PackagedDiagnosticWorkerResult =
  | { readonly ok: true, readonly path: string }
  | { readonly ok: false, readonly error: string }

const PACKAGED_DIAGNOSTIC_WORKER_TIMEOUT_MS = 30_000

/** Start the physical packaged diagnostics Worker and wait for its terminal result. */
async function launchPackagedDiagnosticWorker(
  workerPath: string,
  workerData: PackagedDiagnosticWorkerData,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      name: 'dsh-packaged-diagnostic-smoke',
      workerData,
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    })
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      void worker.terminate()
      reject(new Error(
        `dsh-plugin-desktop: packaged diagnostic worker timed out after ${String(PACKAGED_DIAGNOSTIC_WORKER_TIMEOUT_MS)}ms`,
      ))
    }, PACKAGED_DIAGNOSTIC_WORKER_TIMEOUT_MS)
    const settle = (complete: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      void worker.terminate()
      complete()
    }
    worker.once('message', (result: PackagedDiagnosticWorkerResult) => {
      if (result.ok) settle(() => resolve(result.path))
      else settle(() => reject(new Error(result.error)))
    })
    worker.once('error', cause => settle(() => reject(cause)))
    worker.once('exit', (code) => {
      settle(() => reject(new Error(
        `dsh-plugin-desktop: packaged diagnostic worker exited with code ${String(code)}`,
      )))
    })
  })
}

/** Exercise the physical Worker emitted beside app.asar with a minimal archive. */
export async function smokePackagedDiagnosticWorker(
  unpackedRoot: string,
  launch: PackagedDiagnosticWorkerLauncher = launchPackagedDiagnosticWorker,
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'dsh-packaged-diagnostics-'))
  const logsDir = join(root, 'logs')
  const userDataDir = join(root, 'user-data')
  const crashDumpsDir = join(root, 'Crashpad')
  mkdirSync(logsDir)
  mkdirSync(userDataDir)
  mkdirSync(join(crashDumpsDir, 'pending'), { recursive: true })
  writeFileSync(join(logsDir, 'dsh-2000-01-01.log'), 'packaged worker smoke\n')
  writeFileSync(join(crashDumpsDir, 'pending', 'packaged-smoke.dmp'), 'packaged crash dump smoke\n')
  try {
    const output = await launch(
      join(unpackedRoot, 'lib', 'diagnostic-export-worker.js'),
      { logsDir, userDataDir, appVersion: 'packaged-smoke', maxEvidenceBytes: 1024, crashDumpsDir },
    )
    if (!existsSync(output)) {
      throw new Error(`dsh-plugin-desktop: packaged diagnostic worker produced no archive at ${output}`)
    }
    const crashEntry = 'crash-dumps/pending/packaged-smoke.dmp'
    if (new AdmZip(output).getEntry(crashEntry) === null) {
      throw new Error(`dsh-plugin-desktop: packaged diagnostic worker omitted ${crashEntry}`)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

/** Electron Builder architecture enum value for universal macOS packages. */
const ELECTRON_BUILDER_UNIVERSAL_ARCH = 4

/**
 * Resolve the macOS Resources directory for a packaged application.
 * @param context - completed application directory and product metadata.
 * @returns absolute path to Contents/Resources.
 */
function resolveMacResourcesDir(context: PackagedRuntimeContext): string {
  return join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    'Contents',
    'Resources',
  )
}

/**
 * Resolve every archive Electron Builder seals for the completed target.
 *
 * Universal macOS with `mergeASARs: false` may keep `app-arm64.asar` /
 * `app-x64.asar`, or emit one sealed `app.asar` when the remaining archives are
 * identical after `x64ArchFiles`. Detect the layout that actually exists.
 * @param context - completed application directory and target platform.
 * @param exists - physical-file probe for archive detection.
 * @returns absolute archive paths that must pass the packaged-runtime gate.
 */
export function resolvePackagedAsarPaths(
  context: PackagedRuntimeContext,
  exists: FileProbe = existsSync,
): readonly string[] {
  if (context.electronPlatformName === 'darwin') {
    const resourcesDir = resolveMacResourcesDir(context)
    if (context.arch === ELECTRON_BUILDER_UNIVERSAL_ARCH) {
      const splitArchives = [
        join(resourcesDir, 'app-arm64.asar'),
        join(resourcesDir, 'app-x64.asar'),
      ] as const
      if (splitArchives.every(archivePath => exists(archivePath))) {
        return [...splitArchives]
      }
    }
    return [join(resourcesDir, 'app.asar')]
  }
  if (context.electronPlatformName === 'win32' || context.electronPlatformName === 'linux') {
    return [join(context.appOutDir, 'resources', 'app.asar')]
  }
  throw new Error(
    `dsh-plugin-desktop: unsupported Electron afterPack platform ${JSON.stringify(context.electronPlatformName)}`,
  )
}

/**
 * Resolve the primary archive path used by single-architecture packages.
 * @param context - completed application directory and target platform.
 * @param exists - physical-file probe for archive detection.
 * @returns absolute path to the packaged app.asar (or arm64 slice for universal).
 */
export function resolvePackagedAsarPath(
  context: PackagedRuntimeContext,
  exists: FileProbe = existsSync,
): string {
  return resolvePackagedAsarPaths(context, exists)[0]!
}

/**
 * Resolve every physical dependency tree emitted beside the sealed archives.
 * @param context - completed application directory and target platform.
 * @param exists - physical-file probe for archive detection.
 * @returns absolute paths to each app*.asar.unpacked tree.
 */
export function resolvePackagedUnpackedRoots(
  context: PackagedRuntimeContext,
  exists: FileProbe = existsSync,
): readonly string[] {
  return resolvePackagedAsarPaths(context, exists).map(archivePath => `${archivePath}.unpacked`)
}

/**
 * Resolve the primary physical dependency tree for smoke checks.
 * @param context - completed application directory and target platform.
 * @param exists - physical-file probe for archive detection.
 * @returns absolute path to the preferred app.asar.unpacked tree.
 */
export function resolvePackagedUnpackedRoot(
  context: PackagedRuntimeContext,
  exists: FileProbe = existsSync,
): string {
  return resolvePackagedUnpackedRoots(context, exists)[0]!
}

/** Normalize the host-specific separators emitted by the ASAR reader. */
function normalizeArchiveEntry(entry: string): string {
  return entry.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

/**
 * Inspect one archive and reject an incomplete packaged runtime.
 * @param archivePath - resolved app.asar path.
 * @param list - ASAR listing implementation.
 * @returns The normalized archive entry set for physical mirror verification.
 */
export function verifyPackagedAsar(
  archivePath: string,
  list: ArchiveLister = listPackage,
): ReadonlySet<string> {
  let entries: readonly string[]
  try {
    entries = list(archivePath, { isPack: false })
  } catch (cause) {
    throw new Error(
      `dsh-plugin-desktop: failed to inspect packaged runtime at ${archivePath}`,
      { cause },
    )
  }

  const present = new Set(entries.map(normalizeArchiveEntry))
  const missing = REQUIRED_PACKAGED_RUNTIME_ENTRIES.filter(entry => !present.has(entry))
  if (missing.length > 0) {
    throw new Error(
      `dsh-plugin-desktop: packaged runtime at ${archivePath} is missing required ASAR entries: ${missing.join(', ')}`,
    )
  }
  return present
}

/**
 * Require every ASAR header entry to have a physical counterpart.
 *
 * The Desktop packaging contract unpacks every included application file so
 * profile fallback links and Node ESM resolution never target virtual paths.
 * Checking the complete header closes the gap left by a curated entry list:
 * a collector regression cannot silently omit transitive packages such as
 * yaml, zod, or typebox from app.asar.unpacked.
 */
export function verifyUnpackedArchiveMirror(
  archiveEntries: ReadonlySet<string>,
  unpackedRoot: string,
  exists: FileProbe = existsSync,
): void {
  const missing = [...archiveEntries]
    .filter(entry => entry.length > 0 && !exists(join(unpackedRoot, entry)))
  if (missing.length > 0) {
    throw new Error(
      `dsh-plugin-desktop: unpacked runtime at ${unpackedRoot} is missing ASAR-declared physical entries: ${missing.join(', ')}`,
    )
  }
}

/**
 * Verify package exports resolve through the physical tree instead of the build workspace.
 * @param unpackedRoot - absolute path to app.asar.unpacked.
 * @param resolvePackage - package resolver anchored at the physical root manifest.
 * @returns Nothing; failure rejects missing exports and paths outside app.asar.unpacked.
 */
export function verifyUnpackedPackageResolution(
  unpackedRoot: string,
  resolvePackage: PackageResolver = createRequire(join(unpackedRoot, 'package.json')).resolve,
): void {
  for (const specifier of REQUIRED_UNPACKED_PACKAGE_SPECIFIERS) {
    let resolvedPath: string
    try {
      resolvedPath = resolvePackage(specifier)
    } catch (cause) {
      throw new Error(
        `dsh-plugin-desktop: packaged runtime at ${unpackedRoot} cannot resolve required package export ${specifier}`,
        { cause },
      )
    }

    const relativePath = relative(unpackedRoot, resolvedPath)
    if (
      !isAbsolute(resolvedPath)
      || relativePath === '..'
      || relativePath.startsWith(`..${sep}`)
      || isAbsolute(relativePath)
    ) {
      throw new Error(
        `dsh-plugin-desktop: required package export ${specifier} resolved outside ${unpackedRoot}: ${resolvedPath}`,
      )
    }
  }
}

/**
 * Verify Electron Builder's completed application before signing begins.
 * @param context - Electron Builder's afterPack context.
 * @param list - ASAR listing implementation.
 * @param exists - physical-file probe for the unpacked CLI dependency tree.
 * @param resolvePackage - package resolver anchored at the physical root manifest.
 * @returns Nothing; failure rejects the package before signing.
 */
export function verifyPackagedRuntime(
  context: PackagedRuntimeContext,
  list: ArchiveLister = listPackage,
  exists: FileProbe = existsSync,
  resolvePackage?: PackageResolver,
): void {
  const archivePaths = resolvePackagedAsarPaths(context, exists)
  const unpackedRoots = resolvePackagedUnpackedRoots(context, exists)
  const isUniversalMac = context.electronPlatformName === 'darwin'
    && context.arch === ELECTRON_BUILDER_UNIVERSAL_ARCH
  const usesSplitArchives = archivePaths.length > 1

  for (const [index, archivePath] of archivePaths.entries()) {
    const archiveEntries = verifyPackagedAsar(archivePath, list)
    const unpackedRoot = unpackedRoots[index]!
    const requiredPhysicalEntries = context.electronPlatformName === 'win32'
      ? [...REQUIRED_UNPACKED_RUNTIME_ENTRIES, ...REQUIRED_WINDOWS_X64_NODE_PTY_ENTRIES]
      : isUniversalMac
        ? [
            ...REQUIRED_UNPACKED_RUNTIME_ENTRIES,
            ...(usesSplitArchives
              ? REQUIRED_MACOS_UNIVERSAL_ENTRIES.filter(entry => (
                  archivePath.endsWith('app-arm64.asar')
                    ? entry.includes('darwin-arm64') || entry.includes('darwin_arm64')
                    : entry.includes('darwin-x64') || entry.includes('darwin_x64')
                ))
              : REQUIRED_MACOS_UNIVERSAL_ENTRIES),
          ]
        : REQUIRED_UNPACKED_RUNTIME_ENTRIES
    const missing = requiredPhysicalEntries.filter(entry => !exists(join(unpackedRoot, entry)))
    if (missing.length > 0) {
      throw new Error(
        `dsh-plugin-desktop: packaged runtime at ${unpackedRoot} is missing required physical entries: ${missing.join(', ')}`,
      )
    }
    if (isUniversalMac) {
      const forbidden = FORBIDDEN_MACOS_UNIVERSAL_ENTRIES
        .filter(entry => exists(join(unpackedRoot, entry)))
      if (forbidden.length > 0) {
        throw new Error(
          `dsh-plugin-desktop: universal macOS runtime at ${unpackedRoot} contains host-architecture build output: ${forbidden.join(', ')}`,
        )
      }
    }
    verifyUnpackedArchiveMirror(archiveEntries, unpackedRoot, exists)
    verifyUnpackedPackageResolution(unpackedRoot, resolvePackage)
  }
}

/**
 * Run the static packaged-runtime check as Electron Builder's afterPack hook.
 * @param context - Electron Builder's afterPack context.
 * @returns A promise that rejects before signing when the runtime is incomplete.
 */
export async function afterPack(
  context: PackagedRuntimeContext,
  verify: typeof verifyPackagedRuntime = verifyPackagedRuntime,
  smoke: PackagedDiagnosticWorkerSmoke = smokePackagedDiagnosticWorker,
): Promise<void> {
  verify(context)
  await smoke(resolvePackagedUnpackedRoot(context))
}

export default afterPack

function packageVersion(packageRoot: string): string {
  return (JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as { version: string }).version
}

const DSH_RUNTIME_VERSION = packageVersion(DSH_PACKAGE_ROOT)
const PNPM_RUNTIME_VERSION = packageVersion(PNPM_PACKAGE_ROOT)

/** Result surface required from one packaged Electron child. */
export interface PackagedElectronResult {
  readonly error?: Error
  readonly signal?: NodeJS.Signals | null
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
}

/** Injectable packaged Electron process seam used by focused tests. */
export type PackagedElectronRunner = (
  executable: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
) => PackagedElectronResult

/** Injectable ASAR/CLI/native smoke seam used by the post-fuse artifact hook. */
export type PackagedElectronSmoke = (context: PackagedRuntimeContext) => void

/** Resolve the packaged Electron executable created beside the application resources. */
export function resolvePackagedExecutablePath(context: PackagedRuntimeContext): string {
  const filename = context.packager.appInfo.productFilename
  if (context.electronPlatformName === 'darwin') {
    return join(context.appOutDir, `${filename}.app`, 'Contents', 'MacOS', filename)
  }
  if (context.electronPlatformName === 'win32') return join(context.appOutDir, `${filename}.exe`)
  if (context.electronPlatformName === 'linux') {
    return join(context.appOutDir, context.packager.executableName ?? filename)
  }
  throw new Error(
    `dsh-plugin-desktop: unsupported Electron afterPack platform ${JSON.stringify(context.electronPlatformName)}`,
  )
}

function runPackagedElectron(
  executable: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): PackagedElectronResult {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    env: environment,
    shell: false,
    timeout: 60_000,
    windowsHide: true,
  })
  return {
    ...(result.error === undefined ? {} : { error: result.error }),
    signal: result.signal,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function packagedRuntimeRunnable(context: PackagedRuntimeContext): boolean {
  if (context.electronPlatformName !== process.platform) return false
  const { arch } = context
  if (arch === undefined || arch === 4) return true
  if (arch === 1) return process.arch === 'x64'
  if (arch === 3) return process.arch === 'arm64'
  if (arch === 0) return process.arch === 'ia32'
  return false
}

/**
 * Execute the real packaged runtime through Electron's supported RunAsNode
 * path using the physical CLI and Worker dependency tree.
 */
export function smokePackagedElectronRuntime(
  context: PackagedRuntimeContext,
  run: PackagedElectronRunner = runPackagedElectron,
): void {
  // A universal executable runs natively on either macOS CPU. Per-architecture
  // intermediate apps are only executable on the matching packaging host.
  if (!packagedRuntimeRunnable(context)) return
  const executable = resolvePackagedExecutablePath(context)
  const asarRoot = resolvePackagedUnpackedRoot(context)
  const smokeHome = mkdtempSync(join(tmpdir(), 'dsh-packaged-cli-'))
  const environment = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    DSH_HOME: smokeHome,
    DSH_TELEMETRY_DISABLED: '1',
  }
  const checks = [
    {
      label: 'DSH CLI',
      entry: join(asarRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
      args: ['--version'],
      accepts: (stdout: string) => stdout.trim() === DSH_RUNTIME_VERSION,
    },
    {
      label: 'pnpm CLI',
      entry: join(asarRoot, 'node_modules', 'pnpm', 'bin', 'pnpm.mjs'),
      args: ['--version'],
      accepts: (stdout: string) => stdout.trim() === PNPM_RUNTIME_VERSION,
    },
    {
      label: 'ASAR/Profile/CJS/ripgrep',
      entry: join(asarRoot, 'lib', 'packaged-runtime-smoke.js'),
      args: [],
      accepts: (stdout: string) => stdout.trim() === 'DSH_PACKAGED_RUNTIME_OK',
    },
    {
      label: 'Desktop CLI config composition',
      entry: join(asarRoot, 'lib', 'desktop-cli.js'),
      args: ['--profile', 'headless', '--dump-config'],
      accepts: (stdout: string) => stdout.includes('# == ') && stdout.includes('name:'),
    },
    {
      // This is deliberately the Desktop wrapper rather than DSH's bin.js:
      // a child RunAsNode process cannot inherit main's resolver hook.
      label: 'Desktop CLI Loader boot',
      entry: join(asarRoot, 'lib', 'desktop-cli.js'),
      args: ['--profile', 'headless', '--help'],
      accepts: (stdout: string) => stdout.includes('dsh --profile headless'),
    },
  ] as const
  try {
    for (const check of checks) {
      const result = run(executable, ['--expose-internals', check.entry, ...check.args], environment)
      if (result.error !== undefined) {
        throw new Error(`dsh-plugin-desktop: packaged ${check.label} smoke could not start`, {
          cause: result.error,
        })
      }
      if (result.status !== 0 || !check.accepts(result.stdout)) {
        throw new Error(
          `dsh-plugin-desktop: packaged ${check.label} smoke failed with status ${String(result.status)}; `
          + `signal=${String(result.signal ?? null)}; `
          + `stdout=${JSON.stringify(result.stdout.trim())}; stderr=${JSON.stringify(result.stderr.trim())}`,
        )
      }
    }
  } finally {
    rmSync(smokeHome, { recursive: true, force: true })
  }
}

