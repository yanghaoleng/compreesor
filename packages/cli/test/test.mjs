import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import sharp from 'sharp'
import {
  QUALITY_PRESETS,
  collectMediaFiles,
  compressFile,
  compressImageVariants,
  normalizeQualityPreset,
  resolveCompressionSettings,
} from '../src/core.js'

assert.deepEqual(Object.keys(QUALITY_PRESETS), ['extreme', 'balanced', 'lossless'])
assert.equal(normalizeQualityPreset('极限'), 'extreme')
assert.equal(normalizeQualityPreset('够用'), 'balanced')
assert.equal(normalizeQualityPreset('无损'), 'lossless')
assert.throws(() => normalizeQualityPreset('unknown'), /未知质量预设/)

const defaults = resolveCompressionSettings()
assert.equal(defaults.preset, 'balanced')
assert.equal(defaults.image.quality, 80)
assert.equal(defaults.image.maxDimension, 2560)
assert.equal(defaults.svg.floatPrecision, 3)
assert.equal(defaults.gif.fps, 12)
assert.equal(defaults.gif.maxWidth, 960)
assert.equal(defaults.video.maxHeight, 720)
assert.equal(defaults.video.h264Crf, 28)
assert.equal(defaults.video.h264Preset, 'veryfast')
assert.equal(defaults.mp3.bitrate, '160k')

const extreme = resolveCompressionSettings({ preset: 'extreme' })
assert.equal(extreme.image.quality, 55)
assert.equal(extreme.image.maxDimension, 1600)
assert.equal(extreme.png.palette, true)
assert.equal(extreme.svg.floatPrecision, 2)
assert.equal(extreme.gif.maxColors, 64)
assert.equal(extreme.video.maxHeight, 480)
assert.equal(extreme.video.h264Crf, 32)
assert.equal(extreme.mp3.bitrate, '96k')

const lossless = resolveCompressionSettings({ preset: 'lossless' })
assert.equal(lossless.image.lossless, true)
assert.equal(lossless.image.maxDimension, null)
assert.equal(lossless.svg.preserveGeometry, true)
assert.equal(lossless.gif.copy, true)
assert.equal(lossless.video.copy, true)
assert.equal(lossless.mp3.bitrate, '320k')
assert.equal(lossless.mp3.inherentlyLossy, true)

const legacy = resolveCompressionSettings({ quality: 72 })
assert.equal(legacy.preset, 'balanced')
assert.equal(legacy.image.quality, 72)
assert.equal(legacy.image.avifQuality, 52)
assert.equal(legacy.video.h264Crf, 22)
assert.equal(legacy.video.vp9Crf, 28)

const directory = await mkdtemp(join(tmpdir(), 'compreesor-test-'))
const svgPath = join(directory, 'fixture.svg')
await writeFile(svgPath, `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><!-- remove --><rect width="600" height="400" fill="#0b68ff"/><script>alert(1)</script></svg>`)

const svgResult = await compressFile(svgPath, { format: 'original' })
const optimizedSvg = await readFile(svgResult.outputPath, 'utf8')
assert.ok(!optimizedSvg.includes('<script'))
assert.ok((await stat(svgResult.outputPath)).size > 0)

const pngPath = join(directory, 'sample.png')
await sharp({ create: { width: 900, height: 600, channels: 4, background: '#d3f1ff' } }).png().toFile(pngPath)
const batchPath = join(directory, 'batch.png')
await sharp({ create: { width: 1200, height: 800, channels: 4, background: '#bde8ff' } }).png().toFile(batchPath)
const batchResults = await compressImageVariants(batchPath, [
  { preset: 'extreme', format: 'webp', outputName: 'batch-极限-压缩.webp' },
  { preset: 'balanced', format: 'webp', outputName: 'batch-够用-压缩.webp' },
  { preset: 'lossless', format: 'webp', outputName: 'batch-无损-压缩.webp' },
])
assert.equal(batchResults.length, 3)
assert.ok(batchResults.every((result) => result.sourceRemoved === false && result.outputBytes > 0))
assert.ok((await stat(batchPath)).size > 0)
const webpResult = await compressFile(pngPath, { format: 'webp', replace: true })
assert.equal(webpResult.outputPath, join(directory, 'sample.webp'))
assert.ok((await stat(webpResult.outputPath)).size > 0)
await assert.rejects(access(pngPath))

const jpegPath = join(directory, 'lossless.jpg')
await sharp({ create: { width: 320, height: 240, channels: 3, background: '#8cc8ff' } }).jpeg({ quality: 83 }).toFile(jpegPath)
const jpegBefore = await readFile(jpegPath)
const jpegResult = await compressFile(jpegPath, { preset: 'lossless' })
assert.equal(jpegResult.unchanged, true)
assert.deepEqual(await readFile(jpegResult.outputPath), jpegBefore)

const uppercaseJpegPath = join(directory, 'UPPER.JPG')
await writeFile(uppercaseJpegPath, jpegBefore)
const uppercaseJpegResult = await compressFile(uppercaseJpegPath, { preset: 'lossless', replace: true })
assert.equal(uppercaseJpegResult.outputPath, uppercaseJpegPath)
assert.deepEqual(await readFile(uppercaseJpegPath), jpegBefore)

const ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
if (ffmpegAvailable) {
  const gifPath = join(directory, 'animated.gif')
  const gifFixture = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=8:duration=0.5',
    gifPath,
  ])
  assert.equal(gifFixture.status, 0, gifFixture.stderr?.toString())
  const gifResult = await compressFile(gifPath, { preset: 'lossless' })
  assert.equal(gifResult.unchanged, true)
  assert.deepEqual(await readFile(gifResult.outputPath), await readFile(gifPath))
  const compressedGifResult = await compressFile(gifPath, { preset: 'extreme' })
  assert.ok((await stat(compressedGifResult.outputPath)).size > 0)

  const videoPath = join(directory, 'clip.mp4')
  const videoFixture = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=0.6',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    videoPath,
  ])
  assert.equal(videoFixture.status, 0, videoFixture.stderr?.toString())

  const videoResult = await compressFile(videoPath, { format: 'mp4', preset: 'balanced' })
  assert.ok((await stat(videoResult.outputPath)).size > 0)
  const remuxedVideoResult = await compressFile(videoPath, { format: 'mov', preset: 'lossless' })
  assert.ok((await stat(remuxedVideoResult.outputPath)).size > 0)
  const mp3Result = await compressFile(videoPath, { format: 'mp3', preset: 'lossless' })
  assert.ok((await stat(mp3Result.outputPath)).size > 0)
}

const collected = await collectMediaFiles([directory])
assert.ok(collected.some((path) => path.endsWith('fixture.svg')))
assert.ok(collected.some((path) => path.endsWith('sample.webp')))

console.log(`CLI core tests passed${ffmpegAvailable ? ' (including GIF/video/MP3)' : ' (FFmpeg integration skipped)'}`)
