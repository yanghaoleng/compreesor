import { chromium } from 'playwright'
import { PDFDocument } from 'pdf-lib'
import { readFile, stat, writeFile } from 'node:fs/promises'

const fixturePath = '/tmp/compreesor-pdf-e2e.pdf'
const sourceIcon = await readFile(new URL('../docs/assets/robot-paper-icon-source.png', import.meta.url))
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
  if (!thumbnail || thumbnail.width < 70) throw new Error(`Spacious thumbnail is too small: ${JSON.stringify(thumbnail)}`)
  if ((await page.locator('.variant-size-strip span').count()) !== 3) throw new Error('Three result sizes are missing')
  if ((await page.locator('.variant-download-menu').count()) !== 1) throw new Error('Per-quality list download menu is missing')

  await page.getByRole('button', { name: `预览 compreesor-pdf-e2e.pdf` }).click()
  if ((await page.locator('.comparison-card').count()) !== 3) throw new Error('Comparison preview should show three cards')
  if ((await page.locator('.comparison-card iframe').count()) !== 3) throw new Error('PDF comparison should show three PDF previews')
  if ((await page.locator('.comparison-card header button').count()) !== 3) throw new Error('Comparison downloads are missing')
  await page.locator('.result-preview > header button').click()

  await page.getByRole('button', { name: '打包下载' }).click()
  const choices = await page.locator('.package-choice-grid button').allInnerTexts()
  if (choices.length !== 4 || !choices.at(-1)?.includes('我都要')) throw new Error(`Unexpected package choices: ${choices.join(' | ')}`)
  await page.locator('.package-choice-dialog > header button').click()

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
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('PDF and all-quality E2E passed')
} finally {
  await browser.close()
}
