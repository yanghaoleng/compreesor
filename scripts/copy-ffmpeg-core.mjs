import { copyFile, cp, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(projectRoot, 'node_modules/@ffmpeg/core/dist/esm')
const targetRoot = resolve(projectRoot, 'public/ffmpeg')

// A dependency update must update the reviewed notice/version record too.
const manifest = JSON.parse(await readFile(resolve(projectRoot, 'node_modules/@ffmpeg/core/package.json'), 'utf8'))
const inventory = JSON.parse(await readFile(resolve(projectRoot, 'licenses/DEPENDENCIES.json'), 'utf8'))
const reviewedCore = inventory.packages.find(({ name }) => name === '@ffmpeg/core')
if (manifest.version !== reviewedCore?.version) {
  throw new Error('Review FFmpeg licenses and source delivery before updating licenses/DEPENDENCIES.json')
}

await mkdir(targetRoot, { recursive: true })
await Promise.all([
  copyFile(resolve(sourceRoot, 'ffmpeg-core.js'), resolve(targetRoot, 'ffmpeg-core.js')),
  copyFile(resolve(sourceRoot, 'ffmpeg-core.wasm'), resolve(targetRoot, 'ffmpeg-core.wasm')),
])

// Vite copies public/ into both the website and desktop web-dist output.
await cp(resolve(projectRoot, 'licenses'), resolve(projectRoot, 'public/licenses'), { recursive: true })
await copyFile(resolve(projectRoot, 'licenses/ffmpeg/GPL-2.0.txt'), resolve(targetRoot, 'COPYING.GPLv2'))
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'DISTRIBUTION_COMPLIANCE.md']) {
  await copyFile(resolve(projectRoot, name), resolve(projectRoot, 'public', name))
}
const cliNoticeTarget = resolve(projectRoot, 'public/packages/cli')
await mkdir(cliNoticeTarget, { recursive: true })
await cp(resolve(projectRoot, 'packages/cli/licenses'), resolve(cliNoticeTarget, 'licenses'), { recursive: true })
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'DISTRIBUTION_COMPLIANCE.md']) {
  await copyFile(resolve(projectRoot, 'packages/cli', name), resolve(cliNoticeTarget, name))
}
