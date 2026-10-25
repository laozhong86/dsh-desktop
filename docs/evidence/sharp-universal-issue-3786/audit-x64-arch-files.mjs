#!/usr/bin/env node
/**
 * Audit the `build.mac.x64ArchFiles` rule against one finished universal build.
 *
 * `@electron/universal` merges the x64 and arm64 app trees. A Mach-O file that
 * is byte-identical in both trees cannot be `lipo`-merged, so it must be named by
 * `x64ArchFiles`; otherwise the merge aborts with "Detected file ... that's the
 * same in both x64 and arm64 builds and not covered by the x64ArchFiles rule".
 *
 * Run it after `yarn workspace dsh-plugin-desktop dist:mac-smoke`, pointing at
 * the two temporary app trees electron-builder leaves behind. A **successful**
 * run deletes them, so in practice this is the diagnostic you reach for once a
 * merge has already aborted: the failed run keeps
 * `dist/mac-smoke/mac-universal-{x64,arm64}-temp/OmniMux.app` in place. It
 * reports every uncovered file, so a new native dependency can be added to the
 * rule before the next packaging run fails.
 *
 * Usage:
 *   node audit-x64-arch-files.mjs \
 *     dsh-plugin-desktop/dist/mac-smoke/mac-universal-x64-temp/OmniMux.app \
 *     dsh-plugin-desktop/dist/mac-smoke/mac-universal-arm64-temp/OmniMux.app \
 *     [dsh-plugin-desktop/package.json]
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, resolve } from 'node:path'

const [x64RootArg, arm64RootArg, manifestArg = 'dsh-plugin-desktop/package.json'] = process.argv.slice(2)
if (x64RootArg === undefined || arm64RootArg === undefined) {
  console.error('usage: audit-x64-arch-files.mjs <x64 .app> <arm64 .app> [manifest]')
  process.exit(2)
}

const manifestPath = resolve(manifestArg)
const require = createRequire(manifestPath)
const minimatchModule = require('minimatch')
const minimatch = minimatchModule.minimatch ?? minimatchModule
const rule = JSON.parse(readFileSync(manifestPath, 'utf8')).build.mac.x64ArchFiles
if (typeof rule !== 'string') throw new Error(`${manifestPath} has no build.mac.x64ArchFiles string`)

const x64Root = resolve(x64RootArg)
const arm64Root = resolve(arm64RootArg)

for (const root of [x64Root, arm64Root]) {
  if (!existsSync(root)) {
    console.error(`missing app tree: ${root}`)
    console.error('a successful dist:mac-smoke removes both temp trees; re-run packaging and audit the failed run')
    process.exit(2)
  }
}

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) walk(path, base, out)
    else out.push(relative(base, path))
  }
  return out
}

const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const isMachO = path => {
  try {
    return execFileSync('file', ['-b', path], { encoding: 'utf8' }).includes('Mach-O')
  } catch {
    return false
  }
}

const arm64Files = new Set(walk(arm64Root))
const uncovered = []
let identical = 0
for (const relativePath of walk(x64Root)) {
  if (!arm64Files.has(relativePath)) continue
  const x64File = join(x64Root, relativePath)
  const arm64File = join(arm64Root, relativePath)
  if (statSync(x64File).size !== statSync(arm64File).size) continue
  if (sha(x64File) !== sha(arm64File)) continue
  identical += 1
  if (!isMachO(x64File)) continue
  if (minimatch(relativePath, rule, { matchBase: true })) continue
  uncovered.push(relativePath)
}

console.log(`identical files across both builds: ${String(identical)}`)
console.log(`Mach-O files identical but not covered by x64ArchFiles: ${String(uncovered.length)}`)
for (const relativePath of uncovered) console.log(`  UNCOVERED: ${relativePath}`)
process.exitCode = uncovered.length === 0 ? 0 : 1
