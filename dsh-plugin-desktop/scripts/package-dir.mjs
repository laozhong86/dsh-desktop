/** Build an unsigned unpacked application for the current host platform. */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { writeAppBuildInfo } from './build-info.mjs'

const require = createRequire(import.meta.url)
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const builderCli = require.resolve('electron-builder/cli.js')
const result = spawnSync(process.execPath, [builderCli, '--dir'], {
  cwd: packageRoot,
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  },
  stdio: 'inherit',
})

if (result.error !== undefined) throw result.error
if (result.status !== 0) {
  throw new Error(`electron-builder --dir exited with ${String(result.status)}`)
}

// Record build provenance so any agent can identify the source tree of this app.
if (process.platform === 'darwin') {
  const appDir = join(packageRoot, 'dist', process.arch === 'arm64' ? 'mac-arm64' : 'mac')
  for (const name of readdirSync(appDir)) {
    if (!name.endsWith('.app')) continue
    const appPath = join(appDir, name)
    const markerPath = join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'preset', 'plugins', 'omnimux', 'src', 'release-channel.json')
    const { channel } = JSON.parse(readFileSync(markerPath, 'utf8'))
    writeAppBuildInfo(appPath, channel === 'development' ? 'package-dev' : 'package-dir')
  }
}
