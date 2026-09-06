import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertRuntimeProvenanceMatch, validateRuntimeProvenance } from './sync-vendored-runtime.mjs'

const provenance = {
  repository: 'https://github.com/omnimux-ai/omnimux-dsh.git',
  commit: '25cd8b4d8bd4ca85b583f506afd0e98005ff977b',
  patchPath: 'patches/dsh-0.1.2-alpha.3/ui-commands-client-action.patch',
  patchSha256: '2d32f7eef33020b2fcb9e0fa8172a9f6d851eccc7759861aee3754c02613db9f',
  patchArtifact: 'ui-commands-client-action.patch',
}

test('vendored runtime requires a complete immutable product provenance record', () => {
  assert.deepEqual(validateRuntimeProvenance(provenance), provenance)
})

test('vendored runtime rejects a tampered persistent provenance digest', () => {
  assert.throws(
    () => assertRuntimeProvenanceMatch(provenance, { ...provenance, patchSha256: `0${provenance.patchSha256.slice(1)}` }),
    /patchSha256 differs from the persisted expectation/,
  )
})
