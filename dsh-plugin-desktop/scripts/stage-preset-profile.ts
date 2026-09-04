/** Materialize offline OmniMux profile plugins into preset/plugins. */

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listPackageNames } from '../src/preset-profile.ts'

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const presetDir = join(desktopRoot, 'preset')
const pluginsDir = join(presetDir, 'plugins')

/**
 * Product-tree plugins staged into the preset. The profile stays on `link:`
 * during development; packaging reads the same source trees (the link
 * targets) and materializes offline copies here — one structure, no
 * switching. The source root is required via OMNIMUX_PLUGINS_DIR so the
 * desktop deploy root never embeds a host machine's absolute path.
 */
const PRODUCT_PLUGINS = [
  'omnimux',
  'omnimux-accounts',
  'omnimux-assets',
  'omnimux-workflow',
] as const
const REQUIRED_PACKAGES = [...PRODUCT_PLUGINS, 'dsh-better-sidebar']
interface Manifest {
  readonly name?: string
  readonly dependencies?: Readonly<Record<string, string>>
}

/**
 * Stage plugin snapshots the desktop seed copies into the user profile.
 * @returns the number of package directories written under preset/plugins.
 */
export function stagePresetProfile(): number {
  mkdirSync(presetDir, { recursive: true })
  const pluginsRoot = process.env.OMNIMUX_PLUGINS_DIR
  if (pluginsRoot === undefined || pluginsRoot === '') {
    throw new Error('OMNIMUX_PLUGINS_DIR is required (absolute path to the omnimux-dsh product-tree plugins directory)')
  }
  for (const name of PRODUCT_PLUGINS) {
    if (!existsSync(join(pluginsRoot, name, 'package.json'))) {
      throw new Error(`product plugin source is missing: ${join(pluginsRoot, name)} (set OMNIMUX_PLUGINS_DIR)`)
    }
  }
  const staging = mkdtempSync(join(tmpdir(), 'omnimux-preset-'))
  try {
    const dependencies: Record<string, string> = {
      'dsh-better-sidebar': process.env.DSH_BETTER_SIDEBAR_SPEC ?? '0.14.0',
    }
    for (const name of PRODUCT_PLUGINS) {
      copyPluginSources(join(pluginsRoot, name), join(staging, name))
      dependencies[name] = `file:./${name}`
    }
    writeFileSync(join(staging, 'package.json'), `${JSON.stringify({
      private: true,
      dependencies,
    }, undefined, 2)}\n`)
    writeFileSync(join(staging, 'pnpm-workspace.yaml'), `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n`)
    const installed = installStaging(staging)
    rmSync(pluginsDir, { recursive: true, force: true })
    mkdirSync(pluginsDir, { recursive: true })
    if (installed) copyHoistedModules(join(staging, 'node_modules'), pluginsDir)
    else copyFromFallback(pluginsRoot, pluginsDir)
    const owned = listPackageNames(pluginsDir)
    for (const required of REQUIRED_PACKAGES) {
      if (!owned.includes(required)) {
        throw new Error(`staged preset is missing required plugin ${required}: ${owned.join(', ')}`)
      }
    }
    patchBetterSidebarSettingsNamespace(join(pluginsDir, 'dsh-better-sidebar'))
    patchBetterSidebarDragReleaseBounce(join(pluginsDir, 'dsh-better-sidebar'))
    writeFileSync(join(presetDir, 'owned-packages.json'), `${JSON.stringify(owned, undefined, 2)}\n`)
    if (!existsSync(join(presetDir, 'seed-version'))) writeFileSync(join(presetDir, 'seed-version'), '1\n')
    return owned.length
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

function copyPluginSources(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true })
  cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter: (path) => {
      const relative = path.slice(source.length)
      if (relative.includes(`${join('node_modules')}`)) return false
      if (relative.endsWith('.test.js') || relative.endsWith('.spec.js')) return false
      return true
    },
  })
}

function installStaging(staging: string): boolean {
  const result = spawnSync('pnpm', ['install', '--prod', '--ignore-scripts', '--config.confirmModulesPurge=false'], {
    cwd: staging,
    encoding: 'utf8',
    env: { ...process.env, CI: 'true' },
  })
  if (result.status === 0 && existsSync(join(staging, 'node_modules', 'dsh-better-sidebar', 'package.json'))) {
    return true
  }
  process.stderr.write(
    `stage-preset-profile: pnpm install failed (${result.status === null ? String(result.error) : result.status}); falling back to a local copy\n`,
  )
  if (result.stderr !== '') process.stderr.write(result.stderr)
  return false
}

function copyHoistedModules(source: string, destination: string): void {
  for (const name of listPackageNames(source)) {
    const from = join(source, ...name.split('/'))
    const to = join(destination, ...name.split('/'))
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true, dereference: true })
    // pnpm materializes nested `node_modules/.bin` entries whose relative
    // targets pointed into the (now deleted) staging tree. electron-builder
    // stats every packaged file, so a dangling link fails the whole build,
    // while runtime code never invokes these CLI shims.
    removeDanglingBinLinks(to)
  }
}

function removeDanglingBinLinks(packageDir: string): void {
  const queue = [join(packageDir, 'node_modules')]
  while (queue.length > 0) {
    const dir = queue.pop()!
    const binDir = join(dir, '.bin')
    if (existsSync(binDir)) rmSync(binDir, { recursive: true, force: true })
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== '.bin' && !entry.name.startsWith('.')) {
        queue.push(join(dir, entry.name, 'node_modules'))
      }
    }
  }
}

function copyFromFallback(pluginsRoot: string, destination: string): void {
  for (const name of PRODUCT_PLUGINS) {
    copyPluginSources(join(pluginsRoot, name), join(destination, name))
  }
  const aigc = join(pluginsRoot, 'omnimux', 'node_modules', 'aigc-provider-runtime-kit')
  if (existsSync(join(aigc, 'package.json'))) {
    cpSync(aigc, join(destination, 'aigc-provider-runtime-kit'), { recursive: true, dereference: true })
  }
  const sidebarRoot = process.env.DSH_BETTER_SIDEBAR_DIR
    ?? join(homedir(), '.dsh', 'profiles', 'web', 'node_modules')
  const sidebarPackage = process.env.DSH_BETTER_SIDEBAR_DIR === undefined
    ? join(sidebarRoot, 'dsh-better-sidebar')
    : sidebarRoot
  if (!existsSync(join(sidebarPackage, 'package.json'))) {
    throw new Error(
      `cannot stage dsh-better-sidebar: pnpm install failed and ${sidebarPackage} is missing (set DSH_BETTER_SIDEBAR_DIR)`,
    )
  }
  const hoistedRoot = process.env.DSH_BETTER_SIDEBAR_DIR === undefined
    ? sidebarRoot
    : dirname(sidebarPackage)
  copyClosure(hoistedRoot, ['dsh-better-sidebar'], destination)
}

function copyClosure(hoistedRoot: string, entries: readonly string[], destination: string): void {
  const queue = [...entries]
  const seen = new Set<string>()
  while (queue.length > 0) {
    const name = queue.pop()
    if (name === undefined || seen.has(name)) continue
    seen.add(name)
    const from = join(hoistedRoot, ...name.split('/'))
    if (!existsSync(join(from, 'package.json'))) continue
    const to = join(destination, ...name.split('/'))
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true, dereference: true })
    const manifest = JSON.parse(readFileSync(join(from, 'package.json'), 'utf8')) as Manifest
    for (const dep of Object.keys(manifest.dependencies ?? {})) queue.push(dep)
  }
}


/**
 * alpha.3 removed `settingsNamespace()`; the published sidebar still calls it
 * and Host boot then fails to import the plugin. Rewrite the staged copy so
 * packaged Dev/Prod apps boot without a live npm republish.
 */
function patchBetterSidebarSettingsNamespace(root: string): void {
  if (!existsSync(join(root, 'package.json'))) return
  const replacements: ReadonlyArray<readonly [string, string]> = [
    [
      "import { SettingsConflictError, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'",
      "import { SettingsConflictError, type SettingsNamespace } from '@deepseek-ai/dsh-settings'",
    ],
    [
      'import { SettingsConflictError, settingsNamespace } from "@deepseek-ai/dsh-settings";',
      'import { SettingsConflictError } from "@deepseek-ai/dsh-settings";',
    ],
    [
      'const ns: SettingsNamespace = settingsNamespace(SIDEBAR_PREFS_NS)',
      'const ns: SettingsNamespace = SIDEBAR_PREFS_NS',
    ],
    [
      'const ns = settingsNamespace(SIDEBAR_PREFS_NS);',
      'const ns = SIDEBAR_PREFS_NS;',
    ],
  ]
  for (const rel of ['src/index.ts', 'lib/index.js'] as const) {
    const path = join(root, rel)
    if (!existsSync(path)) continue
    let text = readFileSync(path, 'utf8')
    for (const [from, to] of replacements) text = text.replaceAll(from, to)
    writeFileSync(path, text)
  }
}


/**
 * Drag-release bounce: layout-push effect cleanup used to removeProperty
 * `--dsh-sidebar-width` on every dependency change. On pointer-up the store
 * commits a new width AND dragging ends in the same React turn, so cleanup
 * briefly drops the CSS var to the 0 fallback while
 * `data-dsh-sidebar-dragging` is cleared (transitions re-enabled). The
 * conversation column then animates in (collapse) and back out (final width)
 * — visible center-pane jitter. Keep the var sticky across width updates;
 * only release it on true unmount (issue #31 still covered). Also flush the
 * final drag size into the DOM before clearing the dragging flag so the
 * committed store width and the live CSS var never disagree for a frame.
 */
function patchBetterSidebarDragReleaseBounce(root: string): void {
  if (!existsSync(join(root, 'package.json'))) return

  const srcCleanup = `    return () => {
      document.documentElement.style.removeProperty('--dsh-sidebar-width')
      document.documentElement.style.removeProperty('--dsh-sidebar-height')
    }
  }, [narrow, snapshot.state?.panelOpen, snapshot.state?.width, snapshot.state?.bottomOpen, snapshot.state?.bottomHeight])
  useEffect(() => {
    if (anyDragging) document.body.setAttribute('data-dsh-sidebar-dragging', '')
    else document.body.removeAttribute('data-dsh-sidebar-dragging')
  }, [anyDragging])`

  const srcCleanupFixed = `  }, [narrow, snapshot.state?.panelOpen, snapshot.state?.width, snapshot.state?.bottomOpen, snapshot.state?.bottomHeight])
  // Unmount-only release of the layout push (do not clear on width commits —
  // that re-enables margin transitions against a 0 fallback and jitters the
  // conversation column after a divider drag).
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--dsh-sidebar-width')
      document.documentElement.style.removeProperty('--dsh-sidebar-height')
    }
  }, [])
  useEffect(() => {
    if (anyDragging) document.body.setAttribute('data-dsh-sidebar-dragging', '')
    else document.body.removeAttribute('data-dsh-sidebar-dragging')
  }, [anyDragging])`

  const libCleanup = `				return () => {
					document.documentElement.style.removeProperty("--dsh-sidebar-width");
					document.documentElement.style.removeProperty("--dsh-sidebar-height");
				};
			}, [
				narrow,
				snapshot.state?.panelOpen,
				snapshot.state?.width,
				snapshot.state?.bottomOpen,
				snapshot.state?.bottomHeight
			]);
			(0, react.useEffect)(() => {
				if (anyDragging) document.body.setAttribute("data-dsh-sidebar-dragging", "");
				else document.body.removeAttribute("data-dsh-sidebar-dragging");
			}, [anyDragging]);`

  const libCleanupFixed = `			}, [
				narrow,
				snapshot.state?.panelOpen,
				snapshot.state?.width,
				snapshot.state?.bottomOpen,
				snapshot.state?.bottomHeight
			]);
			(0, react.useEffect)(() => {
				return () => {
					document.documentElement.style.removeProperty("--dsh-sidebar-width");
					document.documentElement.style.removeProperty("--dsh-sidebar-height");
				};
			}, []);
			(0, react.useEffect)(() => {
				if (anyDragging) document.body.setAttribute("data-dsh-sidebar-dragging", "");
				else document.body.removeAttribute("data-dsh-sidebar-dragging");
			}, [anyDragging]);`

  const srcWidthUp = `                stopDragScheduling()
                store.reduce(s => setWidth(s, startWidth + (startX - event.clientX)))
                setDraggingWidth(false)`
  const srcWidthUpFixed = `                stopDragScheduling()
                {
                  const width = clampWidth(startWidth + (startX - event.clientX))
                  const height = state.bottomOpen ? Math.min(state.bottomHeight, window.innerHeight) : 0
                  applyDrag(width, height)
                  store.reduce(s => setWidth(s, width))
                }
                setDraggingWidth(false)`

  const srcCornerUp = `              stopDragScheduling()
              store.reduce(s => setBottomHeight(setWidth(s, startWidth + (startX - event.clientX)), startHeight + (startY - event.clientY)))
              setDraggingCorner(false)`
  const srcCornerUpFixed = `              stopDragScheduling()
              {
                const width = clampWidth(startWidth + (startX - event.clientX))
                const height = clampHeight(startHeight + (startY - event.clientY))
                applyDrag(width, height)
                store.reduce(s => setBottomHeight(setWidth(s, width), height))
              }
              setDraggingCorner(false)`

  const libWidthUp = `								stopDragScheduling();
								store.reduce((s) => setWidth(s, startWidth + (startX - event.clientX)));
								setDraggingWidth(false);`
  const libWidthUpFixed = `								stopDragScheduling();
								{
									const width = clampWidth(startWidth + (startX - event.clientX));
									const height = state.bottomOpen ? Math.min(state.bottomHeight, window.innerHeight) : 0;
									applyDrag(width, height);
									store.reduce((s) => setWidth(s, width));
								}
								setDraggingWidth(false);`

  const libCornerUp = `								stopDragScheduling();
								store.reduce((s) => setBottomHeight(setWidth(s, startWidth + (startX - event.clientX)), startHeight + (startY - event.clientY)));
								setDraggingCorner(false);`
  const libCornerUpFixed = `								stopDragScheduling();
								{
									const width = clampWidth(startWidth + (startX - event.clientX));
									const height = clampHeight(startHeight + (startY - event.clientY));
									applyDrag(width, height);
									store.reduce((s) => setBottomHeight(setWidth(s, width), height));
								}
								setDraggingCorner(false);`

  const targets: Array<{ rel: string; pairs: Array<[string, string]> }> = [
    {
      rel: 'src/client/Sidebar.tsx',
      pairs: [
        [srcCleanup, srcCleanupFixed],
        [srcWidthUp, srcWidthUpFixed],
        [srcCornerUp, srcCornerUpFixed],
      ],
    },
    {
      rel: 'lib/client.js',
      pairs: [
        [libCleanup, libCleanupFixed],
        [libWidthUp, libWidthUpFixed],
        [libCornerUp, libCornerUpFixed],
      ],
    },
    {
      rel: 'lib/client-registry.js',
      pairs: [
        [libCleanup, libCleanupFixed],
        [libWidthUp, libWidthUpFixed],
        [libCornerUp, libCornerUpFixed],
      ],
    },
  ]

  for (const { rel, pairs } of targets) {
    const path = join(root, rel)
    if (!existsSync(path)) continue
    let text = readFileSync(path, 'utf8')
    let changed = false
    for (const [from, to] of pairs) {
      if (!text.includes(from)) continue
      text = text.replaceAll(from, to)
      changed = true
    }
    if (changed) writeFileSync(path, text)
  }
}

function main(): void {
  const count = stagePresetProfile()
  process.stdout.write(`staged ${String(count)} preset packages into ${pluginsDir}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
