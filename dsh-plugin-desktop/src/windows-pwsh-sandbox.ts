/** Electron adapter for the upstream Windows ACL PowerShell executor. */

import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { win32 } from 'node:path'
import type { ShellExecRequest, ShellExecSpec } from '@deepseek-ai/dsh-shell'
import { SandboxPwshExecutor } from '@deepseek-ai/dsh-pwsh-sandbox'
import type { Config as PwshConfig } from '@deepseek-ai/dsh-pwsh-local'
import { createVolatile } from '@deepseek-ai/cosmokit'
import { configValue } from './settings-access.ts'

const RUN_AS_NODE = 'ELECTRON_RUN_AS_NODE'
const UPSTREAM_RUNNER = fileURLToPath(import.meta.resolve('@deepseek-ai/dsh-sandbox-windows-acl/runner'))
const DESKTOP_TRAMPOLINE = fileURLToPath(new URL('./windows-acl-runner.js', import.meta.url))

/** Inputs controlling one exact ACL-runner argv rewrite. */
export interface WindowsAclAdaptation {
  /** Host platform; only Windows is adapted. */
  platform: NodeJS.Platform
  /** Whether the current Host executable is Electron. */
  electron: boolean
  /** Current Electron executable path. */
  execPath: string
  /** Resolved upstream ACL runner path. */
  upstreamRunner: string
  /** Desktop-owned Node-mode trampoline path. */
  trampoline: string
}

/** Adapted execution inputs passed to the ordinary local executor. */
export interface AdaptedWindowsAclExecution {
  /** Spec carrying the runner-only Electron environment. */
  spec: ShellExecSpec
  /** Exact argv, with the desktop trampoline inserted when required. */
  argv: readonly string[]
}

/** Windows PowerShell paths that do not depend on PATH-provided portable runtimes. Built with win32 semantics on every host so results are deterministic off Windows. */
export function desktopWindowsPwshPath(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean = existsSync,
): string | undefined {
  if (platform !== 'win32') return undefined
  const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
  const systemRoot = env.SystemRoot ?? 'C:\\Windows'
  const candidates = [
    win32.join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
    win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ]
  return candidates.find(candidate => exists(candidate))
}

/** Keep explicit user config, otherwise avoid PATH-resolved portable pwsh in the Windows ACL sandbox. */
export function desktopWindowsPwshConfig(
  config: PwshConfig,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean = existsSync,
): PwshConfig {
  const configured = configValue(config.pwshPath)
  if (configured !== undefined && configured.length > 0) return config
  const pwshPath = desktopWindowsPwshPath(env, platform, exists)
  return pwshPath === undefined ? config : { ...config, pwshPath: createVolatile(pwshPath) }
}

/** Executable and runner identities for this Host. */
export function desktopWindowsAclAdaptation(): WindowsAclAdaptation {
  return {
    platform: process.platform,
    electron: process.versions.electron !== undefined,
    execPath: process.execPath,
    upstreamRunner: UPSTREAM_RUNNER,
    trampoline: DESKTOP_TRAMPOLINE,
  }
}

/**
 * Insert the desktop Node-mode trampoline into one confined ACL runner argv.
 * @param argv - argv after the upstream sandbox provider has confined it.
 * @param adaptation - executable and runner identities for this Host.
 * @returns the unchanged argv for every non-runner call, otherwise the trampoline launch.
 */
export function adaptWindowsAclArgv(
  argv: readonly string[],
  adaptation: WindowsAclAdaptation,
): readonly string[] {
  const [program, runner, ...args] = argv
  if (adaptation.platform !== 'win32'
    || !adaptation.electron
    || program !== adaptation.execPath
    || runner !== adaptation.upstreamRunner) {
    return argv
  }
  return [adaptation.execPath, adaptation.trampoline, adaptation.upstreamRunner, ...args]
}

/**
 * Insert the desktop Node-mode trampoline for the exact upstream ACL runner.
 * @param spec - resolved PowerShell execution spec.
 * @param argv - argv after the upstream sandbox provider has confined it.
 * @param adaptation - executable and runner identities for this Host.
 * @returns unchanged inputs for every non-runner call, otherwise the isolated runner launch.
 */
export function adaptWindowsAclExecution(
  spec: ShellExecSpec,
  argv: readonly string[],
  adaptation: WindowsAclAdaptation,
): AdaptedWindowsAclExecution {
  const adapted = adaptWindowsAclArgv(argv, adaptation)
  if (adapted === argv) return { spec, argv }

  const env = { ...spec.env }
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === RUN_AS_NODE) delete env[key]
  }
  env[RUN_AS_NODE] = '1'
  return { spec: { ...spec, env }, argv: adapted }
}

/** PowerShell sandbox executor that repairs only Electron-hosted Windows ACL launches. */
export class DesktopWindowsPwshSandbox extends SandboxPwshExecutor {
  constructor(ctx: ConstructorParameters<typeof SandboxPwshExecutor>[0], config: PwshConfig) {
    super(ctx, desktopWindowsPwshConfig(config, process.env, process.platform))
  }

  override resolve(request: ShellExecRequest): ShellExecSpec {
    const spec = super.resolve(request)
    const adaptation = desktopWindowsAclAdaptation()
    // The trampoline runs after the provider confines the argv, so the Electron
    // environment it needs has to be stamped here, while the spec is still ours to
    // edit. The provider inserts the trampoline itself; this is the env half.
    if (adaptation.platform !== 'win32' || !adaptation.electron) return spec
    if (spec.sandboxPolicy === undefined || spec.sandboxPolicy.mode === 'danger-full-access') return spec
    const env = { ...spec.env }
    for (const key of Object.keys(env)) {
      if (key.toUpperCase() === RUN_AS_NODE) delete env[key]
    }
    env[RUN_AS_NODE] = '1'
    return { ...spec, env }
  }
}

export default DesktopWindowsPwshSandbox
