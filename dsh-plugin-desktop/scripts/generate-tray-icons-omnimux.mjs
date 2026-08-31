/** Generate native tray bitmaps from the OmniMux brand source. */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const buildRoot = join(packageRoot, 'build')

/** Pre-rasterized macOS template source (black/transparent). */
const templateSource = join(buildRoot, 'tray-icon-source-32.png')
/** Pre-rasterized brand-color source (chartreuse #C6F14F (octopus IP)). */
const brandSource = join(buildRoot, 'tray-icon-source-blue-32.png')

const [templateBytes, brandBytes] = await Promise.all([
  readFile(templateSource),
  readFile(brandSource),
])

const variants = [
  ['tray-iconTemplate.png', 16, templateBytes],
  ['tray-iconTemplate@2x.png', 32, templateBytes],
  ['tray-icon-blue.png', 16, brandBytes],
  ['tray-icon-blue@1.25x.png', 20, brandBytes],
  ['tray-icon-blue@1.5x.png', 24, brandBytes],
  ['tray-icon-blue@2x.png', 32, brandBytes],
]

await Promise.all(variants.map(async ([filename, size, source]) => {
  await sharp(source)
    .resize({ width: size, height: size, fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toFile(join(buildRoot, filename))
}))
