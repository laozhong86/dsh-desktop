/** Reuse the signed universal DMG verifier with Next's application identity. */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { macSmokeArchitecture, macSmokeExecutableSlices, type MacUniversalArch } from '../../dsh-plugin-desktop/scripts/mac-universal.ts'
import { macReleaseArchitecture } from '../../dsh-plugin-desktop/scripts/release-mac.ts'
import { verifyMacRelease } from '../../dsh-plugin-desktop/scripts/verify-mac-release.ts'
import { NEXT_MAC_NATIVE_ENTRIES } from './mac-runtime.ts'
import { verifyNextMacEntitlements } from './verify-mac-entitlements.ts'
import { verifyNextMacRuntime } from './verify-mac-runtime.ts'

export function verifyNextMac(signed: boolean): void {
  const smokeSlices = signed ? undefined : macSmokeExecutableSlices(macSmokeArchitecture(process.env))
  // A signed release packages one architecture unless it is explicitly universal; the
  // mounted executable must carry exactly those slices, not the universal pair.
  const releaseArch = macReleaseArchitecture(process.env)
  const archSlices = releaseArch === 'universal' ? ['x86_64', 'arm64']
    : [releaseArch === 'arm64' ? 'arm64' : 'x86_64']
  verifyMacRelease({ distDir: resolve(process.argv[2] ?? `dist/${signed ? 'mac-release' : 'mac-smoke'}`), productName: 'OmniMux', nativeEntries: NEXT_MAC_NATIVE_ENTRIES, archSlices,
    // Next archives its application; native files live beside the archive.
    unpackedRoot: appPath => join(appPath, 'Contents', 'Resources', 'app.asar.unpacked'),
    listDmgs: path => readdirSync(path).filter(name => name.endsWith('.dmg')).map(name => join(path, name)).filter(path => statSync(path).isFile()),
    makeMountPoint: () => mkdtempSync(join(tmpdir(), 'dsh-next-release-')), removeMountPoint: path => rmdirSync(path),
    // The interpreter payloads beside the archive: both CPUs present, the host's CPU executed, release signatures checked.
    verifyRuntime: appPath => verifyNextMacRuntime(appPath, signed),
    run: (command, args) => {
      if (!signed && ['codesign', 'spctl', 'xcrun'].includes(command)) return
      if (smokeSlices !== undefined && command === 'lipo' && args[1] === '-verify_arch' && args[0]?.includes('/Contents/MacOS/') && !smokeSlices.includes(args[2] as MacUniversalArch)) return
      const result = spawnSync(command, args, { stdio: 'inherit' })
      if (result.error || result.status !== 0) throw result.error ?? new Error(`Artifact verification failed: ${command}`)
      if (signed && command === 'codesign' && args.includes('--verify')) verifyNextMacEntitlements(args.at(-1)!)
    } })
}
if (process.argv[1]?.endsWith('/verify-mac-release.ts')) verifyNextMac(true)
