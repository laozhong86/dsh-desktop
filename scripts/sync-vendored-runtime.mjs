import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const upstreamPath = join(root, 'upstream.json')
const workspacePath = join(root, 'package.json')
const pluginPaths = [
  join(root, 'dsh-plugin-desktop', 'package.json'),
  join(root, 'dsh-community-market', 'package.json'),
]
const mode = process.argv[2]

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const isDshPackage = name => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')
const isDshResolution = selector => selector === '@deepseek-ai/dsh'
  || selector.startsWith('@deepseek-ai/dsh@')
  || selector.startsWith('@deepseek-ai/dsh-')
const fail = message => { throw new Error(`sync-vendored-runtime: ${message}`) }

const upstream = readJson(upstreamPath)
const version = upstream.sourceVersion
if (typeof version !== 'string' || !/^[0-9A-Za-z][0-9A-Za-z.-]*$/u.test(version)) {
  fail(`unsafe source version ${JSON.stringify(version)}`)
}

const vendorRelative = `vendor/dsh-runtime/${version}`
const vendorDirectory = join(root, ...vendorRelative.split('/'))
const manifestPath = join(vendorDirectory, 'manifest.json')
const overlayPatchArtifact = 'ui-commands-client-action.patch'

export function validateRuntimeProvenance(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('runtime provenance must be an object')
  }
  for (const field of ['repository', 'commit', 'patchPath', 'patchSha256', 'patchArtifact']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      fail(`runtime provenance is missing ${field}`)
    }
  }
  if (!/^[0-9a-f]{40}$/iu.test(value.commit)) fail('runtime provenance commit must be a full SHA')
  if (!/^[0-9a-f]{64}$/iu.test(value.patchSha256)) fail('runtime provenance patchSha256 must be a SHA256')
  if (value.patchPath.startsWith('/') || value.patchPath.split('/').includes('..')) {
    fail('runtime provenance patchPath must be repository-relative')
  }
  if (value.patchArtifact !== overlayPatchArtifact) fail(`runtime provenance patchArtifact must be ${overlayPatchArtifact}`)
  return value
}

export function assertRuntimeProvenanceMatch(expected, actual) {
  validateRuntimeProvenance(expected)
  validateRuntimeProvenance(actual)
  for (const field of ['repository', 'commit', 'patchPath', 'patchSha256', 'patchArtifact']) {
    if (expected[field] !== actual[field]) fail(`runtime provenance ${field} differs from the persisted expectation`)
  }
}

function readWriteProvenance() {
  const raw = process.env.DSH_RUNTIME_PRODUCT_PROVENANCE
  if (raw === undefined) fail('managed overlay write requires DSH_RUNTIME_PRODUCT_PROVENANCE')
  try {
    const product = validateRuntimeProvenance({ ...JSON.parse(raw), patchArtifact: overlayPatchArtifact })
    const patchSource = process.env.DSH_RUNTIME_PRODUCT_PATCH_PATH
    if (patchSource === undefined || !existsSync(patchSource)) {
      fail('managed overlay write requires DSH_RUNTIME_PRODUCT_PATCH_PATH')
    }
    if (sha256(patchSource) !== product.patchSha256) {
      fail('managed overlay patch bytes differ from DSH_RUNTIME_PRODUCT_PROVENANCE')
    }
    return { product, patchSource }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('sync-vendored-runtime:')) throw error
    fail(`invalid DSH_RUNTIME_PRODUCT_PROVENANCE: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function packageName(filename) {
  const suffix = `-${version}.tgz`
  if (!filename.startsWith('deepseek-ai-') || !filename.endsWith(suffix)) {
    fail(`unexpected upstream tarball name ${JSON.stringify(filename)}`)
  }
  const unscoped = filename.slice('deepseek-ai-'.length, -suffix.length)
  if (unscoped.length === 0) fail(`empty package name in ${JSON.stringify(filename)}`)
  return `@deepseek-ai/${unscoped}`
}

function expectedResolution(entry) {
  const source = `file:${vendorRelative}/${entry.filename}`
  const unscoped = entry.name.slice('@deepseek-ai/'.length)
  const patchRelative = `patches/${unscoped}@${version}.patch`
  return existsSync(join(root, patchRelative))
    ? `patch:${entry.name}@${source.replace(':', '%3A')}#./${patchRelative}`
    : source
}

function writeVendor() {
  const { product, patchSource } = readWriteProvenance()
  const packedDirectory = process.env.DSH_PACKED_RUNTIME_DIR
    ? resolve(process.env.DSH_PACKED_RUNTIME_DIR)
    : join(root, 'deepseek-harness', 'dist', 'npm')
  const orderPath = join(packedDirectory, 'publish-order.txt')
  if (!existsSync(orderPath)) {
    fail('upstream release tarballs are missing; run yarn upstream:prepare-runtime first')
  }
  const filenames = readFileSync(orderPath, 'utf8').trim().split(/\r?\n/u).filter(Boolean)
  if (filenames.length === 0 || new Set(filenames).size !== filenames.length) {
    fail('upstream publish order is empty or contains duplicate tarballs')
  }

  mkdirSync(vendorDirectory, { recursive: true })
  copyFileSync(patchSource, join(vendorDirectory, overlayPatchArtifact))
  const packages = filenames.map((filename) => {
    if (basename(filename) !== filename) fail(`tarball path escapes its directory: ${JSON.stringify(filename)}`)
    const source = join(packedDirectory, filename)
    if (!existsSync(source) || !statSync(source).isFile()) fail(`missing packed tarball ${filename}`)
    const target = join(vendorDirectory, filename)
    copyFileSync(source, target)
    return {
      name: packageName(filename),
      version,
      filename,
      size: statSync(source).size,
      sha256: sha256(source),
    }
  })
  const names = packages.map(entry => entry.name)
  if (new Set(names).size !== names.length) fail('two tarballs map to the same package name')

  const expectedFiles = new Set([...filenames, 'manifest.json', overlayPatchArtifact])
  for (const entry of readdirSync(vendorDirectory, { withFileTypes: true })) {
    if (expectedFiles.has(entry.name)) continue
    if (!entry.isFile()) fail(`unexpected directory in vendored runtime: ${entry.name}`)
    unlinkSync(join(vendorDirectory, entry.name))
  }

  const manifest = {
    formatVersion: 2,
    repository: upstream.repository,
    commit: upstream.commit,
    version,
    buildProfile: 'official',
    provenance: {
      upstream: { repository: upstream.repository, commit: upstream.commit },
      product,
    },
    packages,
  }
  writeJson(manifestPath, manifest)

  upstream.runtimePackageVersion = version
  upstream.runtimeSource = `${vendorRelative}/manifest.json`
  upstream.runtimeOverlay = { product }
  writeJson(upstreamPath, upstream)

  const workspace = readJson(workspacePath)
  const resolutions = Object.fromEntries(Object.entries(workspace.resolutions ?? {})
    .filter(([selector]) => !isDshResolution(selector)))
  for (const entry of packages) resolutions[entry.name] = expectedResolution(entry)
  workspace.resolutions = resolutions
  writeJson(workspacePath, workspace)

  const packageNames = new Set(packages.map(entry => entry.name))
  for (const path of pluginPaths) {
    const plugin = readJson(path)
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const name of Object.keys(plugin[field] ?? {})) {
        if (isDshPackage(name) && packageNames.has(name)) plugin[field][name] = version
      }
    }
    writeJson(path, plugin)
  }
}

function checkVendor() {
  if (!existsSync(manifestPath)) fail(`missing ${relative(root, manifestPath)}`)
  const manifest = readJson(manifestPath)
  if (manifest.formatVersion !== 2) fail('unsupported vendored runtime manifest format')
  for (const field of ['repository', 'commit']) {
    if (manifest[field] !== upstream[field]) fail(`manifest ${field} differs from upstream.json`)
  }
  if (manifest.version !== version || upstream.runtimePackageVersion !== version) {
    fail('source, runtime, and manifest versions must match')
  }
  if (manifest.buildProfile !== 'official') fail('vendored runtime must use the official client build profile')
  if (manifest.provenance === null || typeof manifest.provenance !== 'object' || Array.isArray(manifest.provenance)) {
    fail('vendored runtime manifest has no provenance')
  }
  const provenanceUpstream = manifest.provenance.upstream
  if (provenanceUpstream === null || typeof provenanceUpstream !== 'object' || Array.isArray(provenanceUpstream)
    || provenanceUpstream.repository !== upstream.repository || provenanceUpstream.commit !== upstream.commit) {
    fail('vendored runtime provenance upstream differs from upstream.json')
  }
  if (upstream.runtimeOverlay === null || typeof upstream.runtimeOverlay !== 'object' || Array.isArray(upstream.runtimeOverlay)) {
    fail('upstream.json has no persisted runtime overlay expectation')
  }
  assertRuntimeProvenanceMatch(upstream.runtimeOverlay.product, manifest.provenance.product)
  const overlayPatchPath = join(vendorDirectory, manifest.provenance.product.patchArtifact)
  if (!existsSync(overlayPatchPath) || !statSync(overlayPatchPath).isFile()) {
    fail(`missing frozen overlay patch ${manifest.provenance.product.patchArtifact}`)
  }
  if (sha256(overlayPatchPath) !== manifest.provenance.product.patchSha256) {
    fail('frozen overlay patch integrity differs from manifest provenance')
  }
  if (upstream.runtimeSource !== `${vendorRelative}/manifest.json`) {
    fail('upstream.json points at the wrong runtime manifest')
  }
  if (!Array.isArray(manifest.packages) || manifest.packages.length === 0) fail('runtime manifest has no packages')

  const workspace = readJson(workspacePath)
  const resolutions = workspace.resolutions ?? {}
  const expectedFiles = new Set(['manifest.json', manifest.provenance.product.patchArtifact])
  const names = new Set()
  for (const entry of manifest.packages) {
    if (entry.version !== version || packageName(entry.filename) !== entry.name || names.has(entry.name)) {
      fail(`invalid manifest package ${JSON.stringify(entry.name)}`)
    }
    names.add(entry.name)
    expectedFiles.add(entry.filename)
    const path = join(vendorDirectory, entry.filename)
    if (!existsSync(path) || !statSync(path).isFile()) fail(`missing vendored tarball ${entry.filename}`)
    if (statSync(path).size !== entry.size || sha256(path) !== entry.sha256) {
      fail(`vendored tarball integrity differs for ${entry.filename}`)
    }
    if (resolutions[entry.name] !== expectedResolution(entry)) {
      fail(`workspace resolution differs for ${entry.name}`)
    }
  }
  for (const name of Object.keys(resolutions).filter(isDshResolution)) {
    if (!names.has(name)) fail(`workspace has a stale DSH resolution for ${name}`)
  }
  for (const entry of readdirSync(vendorDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !expectedFiles.has(entry.name)) fail(`unexpected vendored runtime entry ${entry.name}`)
  }

  for (const path of pluginPaths) {
    const plugin = readJson(path)
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries(plugin[field] ?? {})) {
        if (!isDshPackage(name)) continue
        if (!names.has(name)) fail(`${relative(root, path)} references absent runtime package ${name}`)
        if (range !== version) fail(`${relative(root, path)} ${field}.${name} must use ${version}`)
      }
    }
  }
  process.stdout.write(
    `sync-vendored-runtime: ${String(manifest.packages.length)} packages from ${manifest.commit.slice(0, 10)} are verified\n`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  if (mode !== '--write' && mode !== '--check') {
    throw new Error('usage: node scripts/sync-vendored-runtime.mjs <--write|--check>')
  }
  if (mode === '--write') writeVendor()
  checkVendor()
}
