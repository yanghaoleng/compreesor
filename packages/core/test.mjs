import assert from 'node:assert/strict'
import {
  QUALITY_PRESET_ORDER,
  QUALITY_PRESETS,
  baseName,
  classifyName,
  extensionOf,
  normalizeQualityPreset,
  qualityPresetFor,
  targetBytesForPreset,
} from './index.js'

assert.deepEqual(QUALITY_PRESET_ORDER, ['extreme', 'balanced', 'lossless'])
assert.equal(QUALITY_PRESETS.extreme.image.maxDimension, 1600)
assert.equal(QUALITY_PRESETS.balanced.video.h264Crf, 28)
assert.equal(normalizeQualityPreset('够用'), 'balanced')
assert.equal(qualityPresetFor('target-100k'), 'extreme')
assert.equal(qualityPresetFor('target-5m'), 'balanced')
assert.equal(targetBytesForPreset('target-500k'), 500 * 1024)
assert.equal(targetBytesForPreset('lossless'), null)
assert.equal(extensionOf('PHOTO.JPEG'), 'jpeg')
assert.equal(baseName('a/b:c?.png'), 'a-b-c-')
assert.equal(classifyName('scan.PDF'), 'pdf')
assert.equal(classifyName('clip.mov'), 'video')
assert.equal(classifyName('poster.jxl'), 'image')
assert.equal(classifyName('notes.txt'), null)

console.log('Shared core tests passed')
