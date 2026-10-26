#!/usr/bin/env node
/**
 * Generate the OmniMux plugin market index.
 *
 * The official DSH market index is a community-maintained JSON file served over
 * jsDelivr. This script builds our own, so plugin discovery does not depend on a
 * third-party repository staying online or accepting our entries.
 *
 * Output shape mirrors the official `format: 1` schema so the same client code
 * reads both.
 *
 * Usage:
 *   node scripts/build-plugin-index.mjs                 # write dist/dsh-index.json
 *   node scripts/build-plugin-index.mjs --check         # verify only, exit 1 on drift
 *   node scripts/build-plugin-index.mjs --out <path>    # custom output path
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Plugins we publish. Keep this list explicit so nothing ships unreviewed. */
const PUBLISHED_PLUGINS = [
  {
    dir: 'omnimux',
    category: 'core',
    title: { en: 'OmniMux', zh: 'OmniMux' },
    description: {
      en: 'The OmniMux hub: apps, taskboard, expert gallery and the shell entries every other OmniMux plugin attaches to.',
      zh: 'OmniMux 中枢：应用、任务看板、专家馆，以及其他 OmniMux 插件依附的壳入口。',
    },
  },
  {
    dir: 'omnimux-market',
    category: 'market',
    title: { en: 'OmniMux Market', zh: 'OmniMux 市场' },
    description: {
      en: 'Browse and install OmniMux plugins from the market index.',
      zh: '从市场索引浏览并安装 OmniMux 插件。',
    },
  },
]

function readManifest(pluginsRoot, dir) {
  const path = join(pluginsRoot, dir, 'package.json')
  if (!existsSync(path)) throw new Error(`missing plugin manifest: ${path}`)
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
    throw new Error(`${path} must declare string name and version`)
  }
  if (manifest.private === true) throw new Error(`${path} is private and cannot be published`)
  return manifest
}

function entryFor(pluginsRoot, spec) {
  const manifest = readManifest(pluginsRoot, spec.dir)
  const repositoryUrl = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
  const entry = {
    name: manifest.name,
    title: spec.title,
    description: spec.description,
    author: 'OmniMux',
    metadata: {
      category: spec.category,
      keywords: ['dsh', 'deepseek-harness', 'bundle', 'cordis', 'omnimux'],
    },
    versions: [
      {
        version: manifest.version,
        source: repositoryUrl ? { type: 'git', url: repositoryUrl } : { type: 'npm', name: manifest.name },
      },
    ],
  }
  if (typeof manifest.homepage === 'string') entry.homepage = manifest.homepage
  if (repositoryUrl) entry.repository = { url: repositoryUrl }
  return entry
}

function buildIndex(pluginsRoot) {
  return {
    format: 1,
    title: { en: 'OmniMux Plugin Market', zh: 'OmniMux 插件市场' },
    description: {
      en: 'Plugins reviewed and published by the OmniMux team.',
      zh: '由 OmniMux 团队审核并发布的插件。',
    },
    plugins: PUBLISHED_PLUGINS.map(spec => entryFor(pluginsRoot, spec)),
  }
}

function main() {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const outIndex = args.indexOf('--out')
  const outPath = outIndex === -1 ? join(ROOT_DIR, 'dist', 'dsh-index.json') : resolve(args[outIndex + 1])

  // Plugin sources live either in the sibling product tree (day-to-day work) or in
  // the staged preset copy (packaging and CI). Walk up from the repo root so a
  // worktree under .worktrees/ resolves the same siblings as the main checkout.
  const ancestors = []
  for (let dir = ROOT_DIR; dir !== dirname(dir); dir = dirname(dir)) ancestors.push(dir)
  const candidates = [
    process.env.OMNIMUX_PLUGINS_DIR,
    ...ancestors.map(dir => join(dir, 'dsh-plugin', 'product', 'omnimux-dsh', 'plugins')),
    join(ROOT_DIR, 'dsh-plugin-desktop', 'preset', 'plugins'),
  ].filter(Boolean)
  const pluginsRoot = candidates.find(dir => existsSync(dir))
  if (!pluginsRoot) throw new Error(`cannot locate the plugin sources; tried:\n  ${candidates.join('\n  ')}`)

  const index = buildIndex(pluginsRoot)
  const serialized = `${JSON.stringify(index, null, 2)}\n`

  if (check) {
    if (!existsSync(outPath)) throw new Error(`index not found at ${outPath}; run without --check first`)
    const current = readFileSync(outPath, 'utf8')
    if (current !== serialized) throw new Error(`${outPath} is stale; regenerate it`)
    console.log(`plugin index is current: ${String(index.plugins.length)} plugins`)
    return
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, serialized)
  console.log(`wrote ${outPath} (${String(index.plugins.length)} plugins from ${pluginsRoot})`)
  for (const plugin of index.plugins) console.log(`  - ${plugin.name}@${plugin.versions[0].version}`)
}

main()
