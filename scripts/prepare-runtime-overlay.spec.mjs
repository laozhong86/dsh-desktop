import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { freezeProductPatch, validateRuntimeOverlayInputs } from './prepare-runtime-overlay.mjs'

const root = mkdtempSync(join(tmpdir(), 'runtime-overlay-test-'))

test('managed runtime overlay rejects missing inputs before any build operation', () => {
  const source = join(root, 'missing-source')
  assert.throws(() => validateRuntimeOverlayInputs({ source, commit: 'deadbeef' }), /source is missing/)
})

test('managed runtime overlay freezes the product patch from the explicit commit', () => {
  const productRoot = join(root, 'product')
  const patchPath = join(productRoot, 'patches', 'runtime.patch')
  mkdirSync(join(productRoot, 'patches'), { recursive: true })
  execFileSync('git', ['init'], { cwd: productRoot })
  execFileSync('git', ['config', 'user.email', 'runtime-test@example.invalid'], { cwd: productRoot })
  execFileSync('git', ['config', 'user.name', 'Runtime Test'], { cwd: productRoot })
  execFileSync('git', ['remote', 'add', 'origin', 'https://example.invalid/omnimux-dsh.git'], { cwd: productRoot })
  writeFileSync(patchPath, 'frozen patch bytes\n')
  execFileSync('git', ['add', '.'], { cwd: productRoot })
  execFileSync('git', ['commit', '-m', 'freeze patch'], { cwd: productRoot })
  const productCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: productRoot, encoding: 'utf8' }).trim()
  writeFileSync(patchPath, 'dirty working tree bytes\n')

  const frozen = freezeProductPatch({ productRoot, productCommit, patchPath })

  assert.equal(frozen.patch.toString(), 'frozen patch bytes\n')
  assert.equal(frozen.provenance.commit, productCommit)
  assert.equal(frozen.provenance.patchPath, 'patches/runtime.patch')
  assert.match(frozen.provenance.patchSha256, /^[0-9a-f]{64}$/u)
})

test.after(() => rmSync(root, { recursive: true, force: true }))
