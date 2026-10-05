#!/usr/bin/env node
/**
 * Verify every hunk of every DSH runtime patch against freshly built upstream tarballs.
 *
 * Usage: node rca-verify-patches.mjs <repoRoot> <sourceVersion> <targetVersion> [outJson]
 * Env:   RCA_PACKED_DIR  directory holding deepseek-ai-<pkg>-<targetVersion>.tgz
 *
 * Oracle: BSD/GNU `patch -p1 --dry-run --forward --fuzz=0` — the same context-search
 * semantics Yarn's `patch:` applier uses, with fuzz disabled so a shifted or partial
 * context match fails. `git apply --check` is recorded alongside as a stricter
 * cross-check, but it rejects zero-context hunks (unidiff-zero) that patch(1), Yarn and
 * pnpm all accept, so it is NOT the pass/fail oracle.
 *
 * Exit 0 only when every patch and every hunk applies cleanly.
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const [repoRoot, sourceVersion, targetVersion, outJson] = process.argv.slice(2)
if (!repoRoot || !sourceVersion || !targetVersion) {
  process.stderr.write('usage: rca-verify-patches.mjs <repoRoot> <sourceVersion> <targetVersion> [outJson]\n')
  process.exit(2)
}

const patchesDir = join(repoRoot, 'patches')
const packedDir =
  process.env.RCA_PACKED_DIR !== undefined && process.env.RCA_PACKED_DIR !== ''
    ? process.env.RCA_PACKED_DIR
    : join(repoRoot, 'deepseek-harness', 'dist', 'npm')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  }
}

/** Split a unified diff into file sections, each carrying its own header + hunks. */
function splitPatch(text) {
  const lines = text.split('\n')
  const files = []
  let current = null
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      current = { header: [line], hunks: [], path: line.slice('diff --git '.length) }
      files.push(current)
      continue
    }
    if (current === null) continue
    if (line.startsWith('@@')) {
      current.hunks.push({ header: line, body: [line] })
      current.inHunk = true
      continue
    }
    if (current.inHunk === true && current.hunks.length > 0) {
      current.hunks[current.hunks.length - 1].body.push(line)
      continue
    }
    current.header.push(line)
  }
  return files
}

let probeCounter = 0
function probeFile(directory, patchText) {
  probeCounter += 1
  const path = join(directory, `probe-${String(probeCounter)}.patch`)
  writeFileSync(path, patchText)
  return path
}

/** Context-search oracle: patch(1) with fuzz disabled. */
function checkWithPatchTool(packageRoot, scratchDir, patchText) {
  const file = probeFile(scratchDir, patchText)
  const result = run('patch', ['-p1', '--dry-run', '--forward', '--fuzz=0', '-i', file], { cwd: packageRoot })
  const combined = `${result.stdout}${result.stderr}`.trim()
  return { ok: result.status === 0, status: result.status, output: combined }
}

/** Stricter cross-check; rejects zero-context hunks by design. */
function checkWithGitApply(packageRoot, scratchDir, patchText) {
  const file = probeFile(scratchDir, patchText)
  const result = run('git', ['apply', '--check', '-p1', file], { cwd: packageRoot })
  const combined = `${result.stdout}${result.stderr}`.trim()
  return { ok: result.status === 0, status: result.status, output: combined }
}

const patchNames = readdirSync(patchesDir)
  .filter(name => name.endsWith(`@${sourceVersion}.patch`))
  .sort()

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  sourceVersion,
  targetVersion,
  packedDir,
  oracle: 'patch -p1 --dry-run --forward --fuzz=0',
  crossCheck: 'git apply --check -p1 (stricter; rejects zero-context hunks)',
  patchCount: patchNames.length,
  patches: [],
  totals: {
    patches: patchNames.length,
    patchesPass: 0,
    patchesFail: 0,
    hunks: 0,
    hunksPass: 0,
    hunksFail: 0,
    gitApplyWholePatchPass: 0,
    gitApplyWholePatchFail: 0,
  },
}

for (const name of patchNames) {
  const unscoped = name.slice(0, -`@${sourceVersion}.patch`.length)
  const pkg = `@deepseek-ai/${unscoped}`
  const tgzName = `deepseek-ai-${unscoped}-${targetVersion}.tgz`
  const tgzPath = join(packedDir, tgzName)
  const entry = {
    patch: `patches/${name}`,
    package: pkg,
    tarball: tgzName,
    tarballPresent: existsSync(tgzPath),
    hunks: [],
  }

  if (!entry.tarballPresent) {
    entry.result = 'FAIL'
    entry.reason = `missing built tarball ${tgzName}`
    report.patches.push(entry)
    report.totals.patchesFail += 1
    continue
  }

  const work = mkdtempSync(join(tmpdir(), 'rca-patch-'))
  const scratchDir = join(work, 'scratch')
  const extracted = join(work, 'pkg')
  mkdirSync(scratchDir, { recursive: true })
  mkdirSync(extracted, { recursive: true })
  const untar = run('tar', ['-xzf', tgzPath, '-C', extracted])
  if (untar.status !== 0) {
    entry.result = 'FAIL'
    entry.reason = `tar failed: ${untar.stderr.trim()}`
    report.patches.push(entry)
    report.totals.patchesFail += 1
    rmSync(work, { recursive: true, force: true })
    continue
  }
  const packageRoot = join(extracted, 'package')

  const patchText = readFileSync(join(patchesDir, name), 'utf8')
  const files = splitPatch(patchText)

  const whole = checkWithPatchTool(packageRoot, scratchDir, patchText)
  const wholeGit = checkWithGitApply(packageRoot, scratchDir, patchText)
  entry.wholePatchApplies = whole.ok
  entry.wholePatchOutput = whole.ok ? '' : whole.output
  entry.gitApplyWholePatch = wholeGit.ok
  entry.gitApplyWholePatchOutput = wholeGit.ok ? '' : wholeGit.output
  if (wholeGit.ok) report.totals.gitApplyWholePatchPass += 1
  else report.totals.gitApplyWholePatchFail += 1

  let patchOk = whole.ok
  for (const file of files) {
    for (const [index, hunk] of file.hunks.entries()) {
      const single = `${file.header.join('\n')}\n${hunk.body.join('\n')}\n`
      const result = checkWithPatchTool(packageRoot, scratchDir, single)
      const gitResult = checkWithGitApply(packageRoot, scratchDir, single)
      entry.hunks.push({
        file: file.path,
        hunk: index + 1,
        header: hunk.header,
        ok: result.ok,
        output: result.ok ? '' : result.output,
        gitApplyOk: gitResult.ok,
        gitApplyOutput: gitResult.ok ? '' : gitResult.output,
      })
      report.totals.hunks += 1
      if (result.ok) report.totals.hunksPass += 1
      else {
        report.totals.hunksFail += 1
        patchOk = false
      }
    }
  }

  entry.hunkCount = entry.hunks.length
  entry.result = patchOk ? 'PASS' : 'FAIL'
  if (patchOk) report.totals.patchesPass += 1
  else report.totals.patchesFail += 1
  report.patches.push(entry)
  rmSync(work, { recursive: true, force: true })
}

if (outJson !== undefined && outJson !== '') writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`)

for (const entry of report.patches) {
  const bad = entry.hunks.filter(hunk => !hunk.ok).length
  const gitBad = entry.hunks.filter(hunk => !hunk.gitApplyOk).length
  process.stdout.write(
    `${entry.result.padEnd(4)} ${entry.patch} hunks=${String(entry.hunkCount ?? 0)} failedHunks=${String(bad)} gitApplyFailedHunks=${String(gitBad)}\n`,
  )
}
process.stdout.write(
  `TOTAL patches ${String(report.totals.patchesPass)}/${String(report.totals.patches)} pass; hunks ${String(report.totals.hunksPass)}/${String(report.totals.hunks)} pass; git-apply whole-patch ${String(report.totals.gitApplyWholePatchPass)}/${String(report.totals.patches)} pass\n`,
)
process.exit(report.totals.patchesFail === 0 && report.totals.hunksFail === 0 ? 0 : 1)
