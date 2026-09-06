import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const upstream = JSON.parse(readFileSync(join(root, 'upstream.json'), 'utf8'))

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
}

function gitText(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}`)
  return result.stdout.trim()
}

function gitBytes(args, cwd) {
  const result = spawnSync('git', args, { cwd })
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}`)
  return result.stdout
}

function desktopRoot() {
  const commonGitDirectory = resolve(root, gitText(['rev-parse', '--git-common-dir'], root))
  return dirname(commonGitDirectory)
}

function defaultProductRoot() {
  return resolve(desktopRoot(), '../dsh-plugin/product/omnimux-dsh')
}

function sourceCommit(source) {
  return gitText(['-C', source, 'rev-parse', 'HEAD'], root)
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function requireFullCommit(commit) {
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/iu.test(commit)) {
    throw new Error('runtime overlay requires an explicit full --product-commit SHA')
  }
}

export function validateRuntimeOverlayInputs({ source, commit }) {
  if (!existsSync(source)) throw new Error(`runtime overlay source is missing: ${source}`)
  if (sourceCommit(source) !== commit) throw new Error(`runtime overlay source SHA does not match pinned upstream ${commit}`)
}

export function freezeProductPatch({ productRoot, productCommit, patchPath }) {
  requireFullCommit(productCommit)
  if (!existsSync(productRoot)) throw new Error(`runtime overlay product source is missing: ${productRoot}`)
  const productRepositoryRoot = gitText(['-C', productRoot, 'rev-parse', '--show-toplevel'], root)
  const relativePatchPath = relative(resolve(productRoot), resolve(patchPath)).replaceAll('\\', '/')
  if (!relativePatchPath || relativePatchPath.startsWith('../') || isAbsolute(relativePatchPath)) {
    throw new Error(`runtime overlay patch must stay inside the product repository: ${patchPath}`)
  }
  const resolvedCommit = gitText(['-C', productRepositoryRoot, 'rev-parse', '--verify', `${productCommit}^{commit}`], root)
  if (resolvedCommit !== productCommit) {
    throw new Error(`runtime overlay product commit must resolve exactly to ${productCommit}`)
  }
  const patch = gitBytes(['-C', productRepositoryRoot, 'show', `${productCommit}:${relativePatchPath}`], root)
  if (patch.length === 0) throw new Error(`runtime overlay patch is empty at ${productCommit}:${relativePatchPath}`)
  return {
    patch,
    provenance: {
      repository: gitText(['-C', productRepositoryRoot, 'remote', 'get-url', 'origin'], root),
      commit: productCommit,
      patchPath: relativePatchPath,
      patchSha256: sha256(patch),
    },
  }
}

function managedOverlayDirectory(workDir) {
  if (workDir === undefined) {
    const supportRoot = mkdtempSync(join(tmpdir(), 'omnimux-runtime-overlay-'))
    return { supportRoot, overlaySource: join(supportRoot, 'source'), retainSource: false }
  }
  if (!isAbsolute(workDir)) throw new Error('--work-dir must be an absolute path')
  const overlaySource = resolve(workDir)
  if (existsSync(overlaySource)) throw new Error(`--work-dir already exists: ${overlaySource}`)
  mkdirSync(dirname(overlaySource), { recursive: true })
  return {
    supportRoot: mkdtempSync(join(tmpdir(), 'omnimux-runtime-overlay-support-')),
    overlaySource,
    retainSource: true,
  }
}

export function prepareRuntimeOverlay({
  source = join(root, 'deepseek-harness'),
  productRoot = defaultProductRoot(),
  productCommit,
  patchPath = join(productRoot, 'patches', `dsh-${upstream.sourceVersion}`, 'ui-commands-client-action.patch'),
  workDir,
} = {}) {
  validateRuntimeOverlayInputs({ source, commit: upstream.commit })
  const { patch, provenance } = freezeProductPatch({ productRoot, productCommit, patchPath })
  const { supportRoot, overlaySource, retainSource } = managedOverlayDirectory(workDir)
  try {
    const frozenPatch = join(supportRoot, 'ui-commands-client-action.patch')
    writeFileSync(frozenPatch, patch)
    run('git', ['clone', '--no-hardlinks', source, overlaySource], root)
    run('git', ['-C', overlaySource, 'checkout', '--detach', upstream.commit], root)
    run('git', ['-C', overlaySource, 'apply', '--check', frozenPatch], root)
    run('git', ['-C', overlaySource, 'apply', frozenPatch], root)
    const pnpmBin = join(supportRoot, 'bin')
    const pnpmShim = join(pnpmBin, 'pnpm')
    mkdirSync(pnpmBin, { recursive: true })
    writeFileSync(pnpmShim, '#!/usr/bin/env bash\nexec corepack pnpm@11.7.0 \"$@\"\n')
    chmodSync(pnpmShim, 0o755)
    const upstreamEnv = { ...process.env, CI: 'true', COREPACK_ENABLE_STRICT: '0', PATH: `${pnpmBin}:${process.env.PATH ?? ''}` }
    run('corepack', ['pnpm@11.7.0', 'install', '--frozen-lockfile'], overlaySource, upstreamEnv)
    run('corepack', ['pnpm@11.7.0', 'run', 'build'], overlaySource, { ...upstreamEnv, DSH_BUILD_CLIENT_PROFILE: 'official' })
    run('corepack', ['pnpm@11.7.0', 'run', 'release:pack', '--family', 'dsh', '--out', join(overlaySource, 'dist', 'npm')], overlaySource, upstreamEnv)
    run(process.execPath, ['scripts/sync-vendored-runtime.mjs', '--write'], root, {
      ...process.env,
      DSH_PACKED_RUNTIME_DIR: join(overlaySource, 'dist', 'npm'),
      DSH_RUNTIME_PRODUCT_PROVENANCE: JSON.stringify(provenance),
      DSH_RUNTIME_PRODUCT_PATCH_PATH: frozenPatch,
    })
    run('corepack', ['yarn', 'install'], root)
    run('corepack', ['yarn', 'check:vendored-runtime'], root)
    return { overlaySource: retainSource ? overlaySource : undefined, provenance }
  } finally {
    rmSync(supportRoot, { recursive: true, force: true })
  }
}

function parseCliArguments(args) {
  let productCommit
  let workDir
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]
    if (option === '--product-commit') productCommit = args[++index]
    else if (option === '--work-dir') workDir = args[++index]
    else throw new Error('usage: yarn omnimux:runtime-overlay --product-commit <full-sha> [--work-dir <absolute-path>]')
    if (args[index] === undefined) throw new Error(`${option} requires a value`)
  }
  requireFullCommit(productCommit)
  return { productCommit, workDir }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const result = prepareRuntimeOverlay({
    source: process.env.DSH_SRC ? resolve(process.env.DSH_SRC) : undefined,
    productRoot: process.env.OMNIMUX_PRODUCT_DIR ? resolve(process.env.OMNIMUX_PRODUCT_DIR) : undefined,
    ...parseCliArguments(process.argv.slice(2)),
  })
  if (result.overlaySource !== undefined) {
    process.stdout.write(`managed runtime overlay retained for isolated L2 QA: DSH_SRC=${result.overlaySource}\n`)
  }
}
