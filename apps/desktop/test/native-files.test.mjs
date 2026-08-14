import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  mimeTypeForPath,
  normalizeOutputExtension,
  readResultFile,
  replaceFileWithData,
  writeVariantFiles,
} from '../native-files.js'
import { resolveWebAssetPath } from '../web-protocol.js'

assert.equal(normalizeOutputExtension('.JPEG'), 'jpg')
assert.equal(mimeTypeForPath('photo.webp'), 'image/webp')
assert.throws(() => normalizeOutputExtension('../sh'), /不支持的输出后缀/)
assert.equal(
  resolveWebAssetPath('/tmp/compreesor-web', 'compreesor://app/assets/index.js'),
  '/tmp/compreesor-web/assets/index.js',
)
assert.throws(
  () => resolveWebAssetPath('/tmp/compreesor-web', 'compreesor://other/index.html'),
  /无效的桌面资源地址/,
)
assert.throws(
  () => resolveWebAssetPath('/tmp/compreesor-web', 'compreesor://app/%2e%2e%2fsecret'),
  /桌面资源路径越界/,
)

const directory = await mkdtemp(join(tmpdir(), 'compreesor-desktop-files-'))
const sameFormatSource = join(directory, 'same.png')
await writeFile(sameFormatSource, Buffer.from('original'))
const sameFormat = await replaceFileWithData(sameFormatSource, 'png', new Uint8Array([1, 2, 3, 4]))
assert.equal(sameFormat.outputPath, sameFormatSource)
assert.equal(sameFormat.sourceRemoved, false)
assert.deepEqual(await readFile(sameFormatSource), Buffer.from([1, 2, 3, 4]))

const convertedSource = join(directory, 'convert.png')
await writeFile(convertedSource, Buffer.from('source'))
const converted = await replaceFileWithData(convertedSource, 'webp', new Uint8Array([5, 6, 7]))
assert.equal(converted.outputPath, join(directory, 'convert.webp'))
assert.equal(converted.sourceRemoved, true)
await assert.rejects(readFile(convertedSource))
assert.deepEqual(await readFile(converted.outputPath), Buffer.from([5, 6, 7]))

const readBack = await readResultFile(converted.outputPath)
assert.equal(readBack.mimeType, 'image/webp')
assert.equal(readBack.size, 3)
assert.deepEqual(readBack.data, new Uint8Array([5, 6, 7]))

const collisionSource = join(directory, 'collision.png')
const collisionTarget = join(directory, 'collision.webp')
await writeFile(collisionSource, Buffer.from('keep-source'))
await writeFile(collisionTarget, Buffer.from('keep-target'))
await assert.rejects(
  replaceFileWithData(collisionSource, 'webp', new Uint8Array([9])),
  /目标文件已存在/,
)
assert.equal((await readFile(collisionSource)).toString(), 'keep-source')
assert.equal((await readFile(collisionTarget)).toString(), 'keep-target')
assert.ok(!(await readdir(directory)).some((name) => name.includes('compreesor-')))

const variantSource = join(directory, 'variants.png')
await writeFile(variantSource, Buffer.from('source-stays'))
const variants = await writeVariantFiles(variantSource, [
  { outputName: 'variants-极限-压缩.png', data: new Uint8Array([1, 1]) },
  { outputName: 'variants-够用-压缩.png', data: new Uint8Array([2, 2, 2]) },
  { outputName: 'variants-无损-压缩.png', data: new Uint8Array([3, 3, 3, 3]) },
])
assert.equal(variants.length, 3)
assert.equal((await readFile(variantSource)).toString(), 'source-stays')
assert.deepEqual(await readFile(variants[1].outputPath), Buffer.from([2, 2, 2]))
await assert.rejects(
  writeVariantFiles(variantSource, [{ outputName: 'variants-够用-压缩.png', data: new Uint8Array([9]) }]),
  /目标文件已存在/,
)

console.log('Desktop native file tests passed')
