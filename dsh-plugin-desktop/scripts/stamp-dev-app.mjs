#!/usr/bin/env node
/**
 * Stamp an unpacked macOS app bundle with Dev channel identity in its Info.plist.
 *
 * Usage:
 *   node scripts/stamp-dev-app.mjs [path-to-app-bundle]
 * Default target:
 *   dsh-plugin-desktop/dist/mac-arm64/OmniMux.app or OmniMux Dev.app
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function findCandidateApp() {
  const custom = process.argv[2]
  if (custom) return custom

  const armDir = join(packageRoot, 'dist', 'mac-arm64')
  if (existsSync(armDir)) {
    for (const name of readdirSync(armDir)) {
      if (name.endsWith('.app')) return join(armDir, name)
    }
  }
  const macDir = join(packageRoot, 'dist', 'mac')
  if (existsSync(macDir)) {
    for (const name of readdirSync(macDir)) {
      if (name.endsWith('.app')) return join(macDir, name)
    }
  }
  return null
}

const appPath = findCandidateApp()
if (!appPath || !existsSync(appPath)) {
  process.stderr.write(`stamp-dev-app: target app bundle not found (${appPath ?? 'none'})\n`)
  process.exit(1)
}

const plistPath = join(appPath, 'Contents', 'Info.plist')
if (!existsSync(plistPath)) {
  process.stderr.write(`stamp-dev-app: Info.plist not found at ${plistPath}\n`)
  process.exit(1)
}

try {
  // 1. Ensure LSEnvironment dict exists
  execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :LSEnvironment dict', plistPath], { stdio: 'ignore' })
} catch {}

try {
  // 2. Set OMNIMUX_CHANNEL = dev
  execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Set :LSEnvironment:OMNIMUX_CHANNEL dev', plistPath], { stdio: 'ignore' })
} catch {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :LSEnvironment:OMNIMUX_CHANNEL string dev', plistPath], { stdio: 'ignore' })
}

try {
  // 3. Set CFBundleDisplayName to OmniMux Dev
  execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleDisplayName OmniMux Dev', plistPath], { stdio: 'ignore' })
} catch {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :CFBundleDisplayName string OmniMux Dev', plistPath], { stdio: 'ignore' })
}

process.stdout.write(`✓ Successfully stamped Dev identity into ${plistPath}\n`)
