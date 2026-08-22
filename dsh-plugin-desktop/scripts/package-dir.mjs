/** Build an unsigned unpacked application for the current host platform. */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readdirSync } from 'node:fs'
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
const appDir = join(packageRoot, 'dist', 'mac-arm64')
for (const name of readdirSync(appDir)) {
  if (name.endsWith('.app')) writeAppBuildInfo(join(appDir, name), 'package-dir')
}
