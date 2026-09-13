import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hashDirectory } from '../src/managed-profile.ts'
import {
  parseArguments,
  readDistribution,
  verifyDistribution,
  verifyPreset,
  verifyProfile,
} from '../scripts/verify-distribution.ts'

const ITEMS = ['omnimux', '@scope/helper'] as const

describe('verify-distribution', () => {
  it('accepts a staged preset that matches its own record', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      const result = verifyPreset(presetDir)
      expect(result).toEqual({
        target: 'preset',
        directory: presetDir,
        channel: 'development',
        verified: 2,
        extra: [],
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when a recorded package is missing from the preset', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      rmSync(join(presetDir, 'plugins', '@scope', 'helper'), { recursive: true, force: true })
      expect(() => verifyPreset(presetDir))
        .toThrowError('preset is missing 1 recorded package(s): @scope/helper')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when the preset ships a package the record never listed', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      writePackage(join(presetDir, 'plugins'), 'omnimux-extra')
      expect(() => verifyPreset(presetDir))
        .toThrowError('preset ships 1 package(s) the record does not list: omnimux-extra')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when recorded bytes no longer match', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      writeFileSync(join(presetDir, 'plugins', 'omnimux', 'index.js'), 'module.exports = "tampered"\n')
      expect(() => verifyPreset(presetDir)).toThrowError(/^verify-distribution: omnimux digest is /u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when a recorded version no longer matches', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      writePackage(join(presetDir, 'plugins'), 'omnimux', { version: '9.9.9' })
      expect(() => verifyPreset(presetDir))
        .toThrowError('omnimux is version "9.9.9", the record says "1.0.0"')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when a staged manifest cannot resolve after relocation', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      writePackage(join(presetDir, 'plugins'), 'omnimux', {
        dependencies: { '@scope/helper': 'workspace:*' },
      })
      // Record the artifact as it now stands: this is the producer-regression
      // case, where the record honestly describes a payload that cannot install.
      writeRecord(presetDir, ITEMS)
      expect(() => verifyPreset(presetDir))
        .toThrowError('omnimux dependency @scope/helper uses workspace:*, which cannot resolve inside a relocated preset')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when owned-packages.json disagrees with the staged plugins', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      writeFileSync(join(presetDir, 'owned-packages.json'), `${JSON.stringify(['omnimux'], undefined, 2)}\n`)
      expect(() => verifyPreset(presetDir))
        .toThrowError('owned-packages.json and preset/plugins disagree')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when the preset carries no record at all', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      rmSync(join(presetDir, 'distribution.json'))
      expect(() => verifyPreset(presetDir))
        .toThrowError('no distribution record at')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts a Profile that holds every recorded package, and reports extras', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      const profileDir = createProfile(root, ITEMS, ['omnimux-synced-later'])
      const result = verifyProfile(profileDir, join(presetDir, 'distribution.json'))
      expect(result.verified).toBe(2)
      expect(result.extra).toEqual(['omnimux-synced-later'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects unrecorded Profile packages only when asked to be strict', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      const profileDir = createProfile(root, ITEMS, ['omnimux-synced-later'])
      expect(() => verifyProfile(profileDir, join(presetDir, 'distribution.json'), true))
        .toThrowError('Profile holds 1 package(s) the record does not list: omnimux-synced-later')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when a Profile is missing a recorded package', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      const profileDir = createProfile(root, ['omnimux'])
      expect(() => verifyProfile(profileDir, join(presetDir, 'distribution.json')))
        .toThrowError('Profile is missing 1 recorded package(s): @scope/helper')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('requires a Profile requirement to point at its managed source', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      const profileDir = createProfile(root, ITEMS)
      writeFileSync(join(profileDir, 'package.json'), `${JSON.stringify({
        name: 'dsh-profile-omnimux',
        private: true,
        dependencies: { omnimux: 'file:../elsewhere/omnimux' },
      }, undefined, 2)}\n`)
      expect(() => verifyProfile(profileDir, join(presetDir, 'distribution.json')))
        .toThrowError('Profile dependency omnimux must be')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a Profile requirement without an explicit expectation', () => {
    const root = fixture()
    try {
      const profileDir = createProfile(root, ITEMS)
      expect(() => verifyDistribution({ profileDir }))
        .toThrowError('--profile requires --expect')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects records whose own shape cannot be trusted', () => {
    const root = fixture()
    try {
      const presetDir = createPreset(root, ITEMS)
      const path = join(presetDir, 'distribution.json')
      expect(() => readDistribution(path)).not.toThrow()

      writeFileSync(path, '[]\n')
      expect(() => readDistribution(path)).toThrowError('distribution record must be an object')

      writeFileSync(path, '{"schema":2,"channel":"development","items":[]}\n')
      expect(() => readDistribution(path)).toThrowError('unsupported distribution schema 2')

      writeFileSync(path, '{"schema":1,"channel":"development","items":[{}]}\n')
      expect(() => readDistribution(path)).toThrowError('has unsupported kind')

      writeFileSync(path, '{"schema":1,"channel":"development","items":[{"kind":"plugin","id":"a","tier":"product","version":null,"digest":"nope"}]}\n')
      expect(() => readDistribution(path)).toThrowError('has invalid digest')

      const duplicate = {
        schema: 1,
        channel: 'development',
        items: [
          { kind: 'plugin', id: 'a', tier: 'product', version: null, digest: 'a'.repeat(64) },
          { kind: 'plugin', id: 'a', tier: 'product', version: null, digest: 'a'.repeat(64) },
        ],
      }
      writeFileSync(path, `${JSON.stringify(duplicate)}\n`)
      expect(() => readDistribution(path)).toThrowError('lists "a" twice')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects ambiguous command lines instead of guessing', () => {
    expect(parseArguments(['--preset', '/tmp/preset'])).toEqual({ presetDir: '/tmp/preset', strict: false })
    expect(parseArguments(['--strict', '--preset', '/tmp/preset']).strict).toBe(true)
    expect(() => parseArguments([])).toThrowError('usage:')
    expect(() => parseArguments(['--preset', '/tmp/a', '--profile', '/tmp/b'])).toThrowError('usage:')
    expect(() => parseArguments(['--preset'])).toThrowError('--preset needs a value')
    expect(() => parseArguments(['--wat'])).toThrowError('unknown argument')
  })
})

function fixture(): string {
  return mkdtempSync(join(tmpdir(), 'verify-distribution-'))
}

function writePackage(pluginsDir: string, name: string, extra: Record<string, unknown> = {}): void {
  const directory = join(pluginsDir, ...name.split('/'))
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify({
    name,
    version: '1.0.0',
    ...extra,
  }, undefined, 2)}\n`)
  writeFileSync(join(directory, 'index.js'), `module.exports = ${JSON.stringify(name)}\n`)
}

/** Build a staged preset shaped exactly like the producer's output. */
function createPreset(root: string, names: readonly string[]): string {
  const presetDir = join(root, 'preset')
  const pluginsDir = join(presetDir, 'plugins')
  mkdirSync(pluginsDir, { recursive: true })
  for (const name of names) writePackage(pluginsDir, name)
  writeFileSync(join(presetDir, 'owned-packages.json'), `${JSON.stringify(names, undefined, 2)}\n`)
  writeFileSync(join(presetDir, 'seed-version'), '4\n')
  writeRecord(presetDir, names)
  return presetDir
}

/** Record the preset's current bytes, the way the producer does after staging. */
function writeRecord(presetDir: string, names: readonly string[]): void {
  const pluginsDir = join(presetDir, 'plugins')
  writeFileSync(join(presetDir, 'distribution.json'), `${JSON.stringify({
    schema: 1,
    channel: 'development',
    generatedFrom: { appVersion: '2.0.9', desktopCommit: null },
    items: names.map(id => ({
      kind: 'plugin',
      id,
      tier: 'product',
      version: '1.0.0',
      digest: hashDirectory(join(pluginsDir, ...id.split('/'))),
    })),
  }, undefined, 2)}\n`)
}

/** Build an installed Profile whose managed sources carry the recorded bytes. */
function createProfile(root: string, names: readonly string[], extra: readonly string[] = []): string {
  const profileDir = join(root, 'profile')
  const snapshots = join(profileDir, '.materialize-snapshots', 'plugins')
  mkdirSync(snapshots, { recursive: true })
  for (const name of [...names, ...extra]) writePackage(snapshots, name)
  writeFileSync(join(profileDir, 'package.json'), `${JSON.stringify({
    name: 'dsh-profile-omnimux',
    private: true,
    dependencies: Object.fromEntries(names.map(name => [name, `file:.materialize-snapshots/plugins/${name}`])),
  }, undefined, 2)}\n`)
  return profileDir
}
