import { chromium } from 'playwright'
import { PDFDocument } from 'pdf-lib'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const fixturePath = '/tmp/compreesor-pdf-e2e.pdf'
const sourceIconUrl = new URL('../docs/assets/robot-paper-icon-source.png', import.meta.url)
const sourceIconPath = fileURLToPath(sourceIconUrl)
const sourceIcon = await readFile(sourceIconUrl)
const fixture = await PDFDocument.create()
for (let index = 0; index < 3; index += 1) {
  const image = await fixture.embedPng(sourceIcon)
  const page = fixture.addPage([595, 842])
  page.drawImage(image, { x: 40, y: 120, width: 515, height: 515 })
}
await writeFile(fixturePath, await fixture.save({ useObjectStreams: false }))

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1280, height: 780 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  const baseUrl = process.env.COMPREESOR_BASE_URL ?? 'http://127.0.0.1:5173/'
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const preset = page.locator('.preferences select').first()
  if (await preset.inputValue() !== 'all') throw new Error('All-quality mode is not the default')
  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  await page.locator('.job-row.status-done').waitFor({ timeout: 120_000 })
  if (!(await page.locator('.queue-section').getAttribute('class'))?.includes('is-spacious')) throw new Error('Small queue should use spacious layout')
  const thumbnail = await page.locator('.thumbnail').boundingBox()
  if (!thumbnail || thumbnail.width < 64) throw new Error(`Spacious thumbnail should remain legible in the compact row: ${JSON.stringify(thumbnail)}`)
  if ((await page.locator('.variant-results .variant-result-item').count()) !== 3) throw new Error('Three right-aligned results are missing')
  if (!/^\d+%–\d+%$/.test((await page.locator('.result-ratio-range').getAttribute('aria-label')) ?? '')) throw new Error('Three-quality ratio range is missing')

  await page.locator('.job-row').first().click()
  if ((await page.locator('.comparison-card').count()) !== 3) throw new Error('Comparison preview should show three cards')
  if ((await page.locator('.comparison-card iframe').count()) !== 3) throw new Error('PDF comparison should show three PDF previews')
  if ((await page.locator('.comparison-card header button').count()) !== 3) throw new Error('Comparison downloads are missing')
  const pdfZoomSelect = page.locator('.comparison-toolbar select')
  if ((await pdfZoomSelect.inputValue()) !== '1') throw new Error('PDF comparison should default to 100%')
  await pdfZoomSelect.selectOption('2')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.comparison-card iframe')).every(
    (frame) => frame.getAttribute('src')?.includes('zoom=200'),
  ))
  await page.locator('.job-row').first().focus()
  await page.keyboard.press('-')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.comparison-card iframe')).every(
    (frame) => frame.getAttribute('src')?.includes('zoom=175'),
  ))
  await pdfZoomSelect.selectOption('fit')
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.comparison-card iframe')).every(
    (frame) => frame.getAttribute('src')?.includes('zoom=page-fit'),
  ))
  await page.locator('.result-preview > header button').click()

  const zipEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: '打包下载' }).click()
  await zipEvent
  if (await page.locator('.package-choice-dialog').count()) throw new Error('ZIP download should not ask for a quality')

  await page.getByRole('button', { name: '清空' }).click()
  await preset.selectOption('target-100k')
  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  await page.locator('.job-row.status-done').waitFor({ timeout: 120_000 })
  const resultText = await page.locator('.job-copy p').innerText()
  if (!resultText.includes('→')) throw new Error('PDF before/after size is missing')
  const downloadEvent = page.waitForEvent('download')
  await page.locator('.job-action > button').last().click()
  const result = await downloadEvent
  const savedPath = '/tmp/compreesor-pdf-target-result.pdf'
  await result.saveAs(savedPath)
  const resultStat = await stat(savedPath)
  if (result.suggestedFilename() !== 'compreesor-pdf-e2e-压缩.pdf') throw new Error(`Unexpected PDF name: ${result.suggestedFilename()}`)
  if (resultStat.size > 100 * 1024) throw new Error(`100 KB target was missed: ${resultStat.size}`)

  await page.getByRole('button', { name: '清空' }).click()
  await preset.selectOption('balanced')
  const imageOutput = page.locator('.preferences select').nth(1)
  await imageOutput.selectOption('pdf')
  await page.locator('input[type="file"]').setInputFiles(sourceIconPath)
  await page.locator('.job-row.status-done').waitFor({ timeout: 120_000 })
  const imagePdfDownload = page.waitForEvent('download')
  await page.locator('.job-action button').first().click()
  const imagePdf = await imagePdfDownload
  const imagePdfPath = '/tmp/compreesor-image-to-pdf.pdf'
  await imagePdf.saveAs(imagePdfPath)
  if (!imagePdf.suggestedFilename().endsWith('-压缩.pdf')) throw new Error(`Image to PDF filename is incorrect: ${imagePdf.suggestedFilename()}`)
  if ((await readFile(imagePdfPath, { encoding: 'utf8' })).slice(0, 4) !== '%PDF') throw new Error('Image to PDF result is invalid')
  await page.locator('.job-row').first().click()
  if ((await page.locator('.result-preview iframe').count()) !== 1) throw new Error('Image to PDF should use the PDF preview')
  await page.locator('.result-preview > header button').click()

  await page.getByRole('button', { name: '清空' }).click()
  await imageOutput.selectOption('jpeg')
  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  await page.waitForFunction(() => document.querySelectorAll('.job-row.status-done').length === 3, undefined, { timeout: 120_000 })
  const splitNames = await page.locator('.job-copy > strong').allInnerTexts()
  if (!splitNames.every((name, index) => name.includes(`第${index + 1}页`))) throw new Error(`PDF pages were not expanded into rows: ${splitNames.join(' | ')}`)
  const pageDownloadEvent = page.waitForEvent('download')
  await page.locator('.job-row').first().locator('.job-action button').first().click()
  const pageDownload = await pageDownloadEvent
  const pageImagePath = '/tmp/compreesor-pdf-page.jpg'
  await pageDownload.saveAs(pageImagePath)
  const pageBytes = await readFile(pageImagePath)
  if (pageBytes[0] !== 0xff || pageBytes[1] !== 0xd8) throw new Error('PDF page did not become a JPEG image')

  await page.getByRole('button', { name: '清空' }).click()
  await preset.selectOption('all')
  await imageOutput.selectOption('webp')
  await page.locator('input[type="file"]').setInputFiles(sourceIconPath)
  await page.locator('.job-row.status-done').waitFor({ timeout: 120_000 })
  const resultItems = page.locator('.variant-result-item')
  if ((await resultItems.count()) !== 3) throw new Error('Image result chips are missing')
  if (await page.locator('.variant-hover-preview').count()) throw new Error('Quality result hover previews should be removed')
  await page.locator('.job-row').first().hover()
  await page.locator('.result-preview').waitFor()
  if (!(await page.locator('.result-preview').getAttribute('class'))?.includes('is-transient')) throw new Error('Whole-row hover should show a transient preview')
  await page.locator('.job-row').first().click()
  if (!(await page.locator('.result-preview').getAttribute('class'))?.includes('is-pinned')) throw new Error('Whole-row click should pin its preview')
  if ((await page.locator('.comparison-image-stage').count()) !== 3) throw new Error('Image comparison should open three synchronized windows')
  await page.getByRole('button', { name: '放大' }).click()
  await page.waitForTimeout(140)
  const zoomedTransforms = await page.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => getComputedStyle(image).transform))
  if (new Set(zoomedTransforms).size !== 1 || !zoomedTransforms[0].includes('1.25')) throw new Error(`Comparison zoom is not synchronized: ${zoomedTransforms.join(' | ')}`)
  const stageBox = await page.locator('.comparison-image-stage').first().boundingBox()
  if (!stageBox) throw new Error('Comparison stage is missing')
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(stageBox.x + stageBox.width / 2 + 22, stageBox.y + stageBox.height / 2 + 14)
  await page.mouse.up()
  await page.waitForTimeout(140)
  const movedTransforms = await page.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => getComputedStyle(image).transform))
  if (new Set(movedTransforms).size !== 1 || movedTransforms[0] === zoomedTransforms[0]) throw new Error(`Comparison pan is not synchronized: ${movedTransforms.join(' | ')}`)
  await page.locator('.result-preview > header button').click()

  await imageOutput.selectOption('jpeg')
  const reprocess = page.getByRole('button', { name: '全部重新处理' })
  await reprocess.waitFor()
  const reprocessBox = await reprocess.boundingBox()
  const lastPreferenceBox = await page.locator('.preferences label').last().boundingBox()
  if (!reprocessBox || !lastPreferenceBox || reprocessBox.x <= lastPreferenceBox.x + lastPreferenceBox.width) throw new Error('Reprocess button should sit at the far right')
  await reprocess.click()
  if (!(await reprocess.isDisabled())) throw new Error('Reprocess button should disable after it is used')
  await page.locator('.job-row.status-processing, .job-row.status-queued').first().waitFor({ timeout: 20_000 })
  await page.locator('.job-row.status-done').waitFor({ timeout: 120_000 })
  if (!(await reprocess.isDisabled())) throw new Error('Reprocess button should stay disabled until another preference changes')
  await preset.selectOption('extreme')
  if (await reprocess.isDisabled()) throw new Error('Changing a preference should re-enable reprocessing')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('PDF conversion and synchronized all-quality E2E passed')
} finally {
  await browser.close()
}
