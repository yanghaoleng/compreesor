import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import { collectMediaFiles, compressFile } from '../src/core.js'

const directory = await mkdtemp(join(tmpdir(), 'compreesor-test-'))
const svgPath = join(directory, 'fixture.svg')
await writeFile(svgPath, `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><!-- remove --><rect width="600" height="400" fill="#0b68ff"/><script>alert(1)</script></svg>`)

const svgResult = await compressFile(svgPath, { format: 'original' })
const optimizedSvg = await readFile(svgResult.outputPath, 'utf8')
assert.ok(!optimizedSvg.includes('<script'))
assert.ok((await stat(svgResult.outputPath)).size > 0)

const pngPath = join(directory, 'sample.png')
await sharp({ create: { width: 900, height: 600, channels: 4, background: '#d3f1ff' } }).png().toFile(pngPath)
const webpResult = await compressFile(pngPath, { format: 'webp', replace: true })
assert.equal(webpResult.outputPath, join(directory, 'sample.webp'))
assert.ok((await stat(webpResult.outputPath)).size > 0)
await assert.rejects(access(pngPath))

const collected = await collectMediaFiles([directory])
assert.ok(collected.some((path) => path.endsWith('fixture.svg')))
assert.ok(collected.some((path) => path.endsWith('sample.webp')))

console.log('CLI core tests passed')
