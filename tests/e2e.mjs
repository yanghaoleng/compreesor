import { chromium } from 'playwright'
import { readFile, stat } from 'node:fs/promises'

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const baseUrl = process.env.COMPREESOR_BASE_URL ?? 'http://127.0.0.1:5173/'
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

await page.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: '输出偏好' }).waitFor()
if ((await page.locator('.preferences select').count()) !== 3) throw new Error('Output preferences or compression preset are missing before upload')
if (await page.locator('.preferences select').nth(0).inputValue() !== 'balanced') throw new Error('Compression should default to Balanced')
if ((await page.locator('.preferences select').nth(1).locator('option[value="original"]').innerText()).trim() !== '压缩为原格式') {
  throw new Error('Original image output copy is incorrect')
}
if (await page.locator('.preferences select').nth(2).inputValue() !== 'mp3') throw new Error('Video output should default to MP3 extraction')
const preferenceHeadingBox = await page.getByRole('heading', { name: '输出偏好' }).boundingBox()
const firstPreferenceBox = await page.locator('.preferences label').first().boundingBox()
if (!preferenceHeadingBox || !firstPreferenceBox || firstPreferenceBox.x - (preferenceHeadingBox.x + preferenceHeadingBox.width) > 28) {
  throw new Error('Output preferences should form a compact left-aligned group')
}
if ((await page.locator('.topbar-actions button').count()) < 2) throw new Error('Language or theme controls are missing')
await page.locator('input[type="file"]').setInputFiles([
  '/tmp/compreesor-fixture.png',
  '/tmp/compreesor-animation.gif',
  '/tmp/compreesor-video.mp4',
])

if (await page.locator('.drop-zone').count()) throw new Error('Drop zone should hide after files are added')
await page.getByRole('button', { name: '继续上传' }).waitFor()
await page.getByRole('button', { name: '清空' }).waitFor()
await page.getByRole('button', { name: '打包下载' }).waitFor()

const processingRow = page.locator('.job-row.status-processing').first()
await processingRow.waitFor({ timeout: 20_000 })
const processingCopyBox = await processingRow.locator('.job-copy').boundingBox()
const processingStateBox = await processingRow.locator('.job-state').boundingBox()
if (!processingCopyBox || !processingStateBox || processingStateBox.x <= processingCopyBox.x) {
  throw new Error('Loading state is not right aligned')
}

await page.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 3,
  undefined,
  { timeout: 180_000 },
)

const failed = await page.locator('.job-row.status-error').count()
if (failed) throw new Error(`Compression failed: ${await page.locator('.job-list').innerText()}`)

const rows = await page.locator('.job-row').allInnerTexts()
if (!rows.some((row) => row.includes('GIF'))) throw new Error('GIF did not finish')
if (!rows.some((row) => row.includes('MP3'))) throw new Error('Video did not default to MP3 extraction')
if ((await page.locator('.thumbnail img').count()) !== 3) throw new Error('Expected thumbnails for every file')
const firstThumbnail = await page.locator('.thumbnail').first().boundingBox()
if (!firstThumbnail || firstThumbnail.width > 44 || firstThumbnail.height > 44) throw new Error('Thumbnails are not compact')
if (!(await page.locator('.job-copy p').first().innerText()).includes('→')) throw new Error('Compression details should show original and result sizes')
if ((await page.locator('.job-progress').count()) !== 3) throw new Error('Every file should expose a progress bar')
if (await page.locator('.job-progress').first().getAttribute('aria-valuenow') !== '100') throw new Error('Completed progress should reach 100')
if (!/^\d+%$/.test((await page.locator('.job-row').first().locator('.job-state').innerText()).trim())) {
  throw new Error('Image result ratio is missing beside the green check')
}
const rowBorders = await page.locator('.job-row').first().evaluate((element) => {
  const style = getComputedStyle(element)
  return { top: style.borderTopWidth, right: style.borderRightWidth, bottom: style.borderBottomWidth, radius: style.borderRadius }
})
if (rowBorders.top !== '0px' || rowBorders.right !== '0px' || rowBorders.bottom === '0px' || rowBorders.radius !== '0px') {
  throw new Error(`File rows should use separators only: ${JSON.stringify(rowBorders)}`)
}
const donateTrigger = page.getByRole('button', { name: '打赏作者' })
await donateTrigger.waitFor()
if (await page.locator('.donate-popover').count()) throw new Error('Donation popover should stay closed before ZIP download')
const footerLinkBoxes = await Promise.all([
  page.getByRole('button', { name: '使用说明' }).boundingBox(),
  page.getByRole('link', { name: '作者主页' }).boundingBox(),
  page.getByRole('button', { name: 'CLI 命令行' }).boundingBox(),
  donateTrigger.boundingBox(),
])
if (footerLinkBoxes.some((box) => !box)) throw new Error('Footer links are missing')
if (Math.max(...footerLinkBoxes.map((box) => box.y)) - Math.min(...footerLinkBoxes.map((box) => box.y)) > 2) {
  throw new Error('Donation trigger should share the footer baseline')
}
if (!(footerLinkBoxes[3].x > footerLinkBoxes[2].x)) throw new Error('Donation trigger should sit at the bottom right')

const clearBox = await page.getByRole('button', { name: '清空' }).boundingBox()
const addBox = await page.getByRole('button', { name: '继续上传' }).boundingBox()
const zipBox = await page.getByRole('button', { name: '打包下载' }).boundingBox()
if (!clearBox || !addBox || !zipBox || !(clearBox.x < addBox.x && addBox.x < zipBox.x)) {
  throw new Error('Queue action order is incorrect')
}
if (Math.max(clearBox.y, addBox.y, zipBox.y) - Math.min(clearBox.y, addBox.y, zipBox.y) > 2) {
  throw new Error('Queue actions should stay in a single row')
}
const singlePreviewButton = page.locator('.job-action button').first()
const singleDownloadButton = page.locator('.job-action button').nth(1)
if (await singlePreviewButton.getAttribute('title') !== '预览') throw new Error('Preview button should appear before download')
if ((await singleDownloadButton.innerText()).trim() !== '') throw new Error('Single download should be icon only')
const singleDownloadColor = await singleDownloadButton.evaluate((element) => getComputedStyle(element).color)
if (singleDownloadColor !== 'rgb(255, 255, 255)') throw new Error(`Download icon should be white, received ${singleDownloadColor}`)
const singleDownloadBackground = await singleDownloadButton.evaluate((element) => getComputedStyle(element).backgroundColor)
if (singleDownloadBackground !== 'rgba(0, 0, 0, 0)') {
  throw new Error(`Download button should have no background, received ${singleDownloadBackground}`)
}

await singlePreviewButton.click()
await page.locator('.result-preview .image-preview-stage img').waitFor()
const previewBox = await page.locator('.result-preview').boundingBox()
if (!previewBox || previewBox.x < 16 || previewBox.x > 26 || 1050 - (previewBox.y + previewBox.height) < 8 || 1050 - (previewBox.y + previewBox.height) > 26) {
  throw new Error(`Preview should float near the bottom-left: ${JSON.stringify(previewBox)}`)
}
if ((await page.locator('.result-preview .preview-page').count()) !== 2) throw new Error('Image preview paging controls are missing')
await page.locator('.result-preview > header button').click()

const singleDownload = page.waitForEvent('download')
await singleDownloadButton.click()
const single = await singleDownload
if (single.suggestedFilename() !== 'compreesor-fixture-压缩.png') {
  throw new Error(`Single download should use Chinese compression suffix: ${single.suggestedFilename()}`)
}

await page.evaluate(() => {
  const panel = document.querySelector('.tool-panel')
  if (panel instanceof HTMLElement) panel.style.minHeight = '1500px'
  Math.random = () => 0
  window.scrollTo(0, 0)
})

const zipDownload = page.waitForEvent('download')
await page.getByRole('button', { name: '打包下载' }).click()
const archive = await zipDownload
await page.locator('.donate-popover').waitFor()
await page.locator('.donate-popover.is-viewport-pinned').waitFor()
await page.waitForFunction(() => document.querySelector('.spring-scale-word')?.getAnimations().length)
const firstDonatePraise = (await page.locator('.donate-praise-line').innerText()).trim()
if (firstDonatePraise !== '认真整理文件的人，做事通常也很靠谱。愿你今天一路顺手。') {
  throw new Error(`Unexpected first donation praise: ${firstDonatePraise}`)
}
const springScaleTiming = await page.locator('.spring-scale-word').evaluateAll((units) => units.slice(0, 2).map((unit) => {
  const timing = unit.getAnimations()[0]?.effect?.getTiming()
  return timing ? { delay: timing.delay, duration: timing.duration, easing: timing.easing } : null
}))
if (
  springScaleTiming.length < 2
  || springScaleTiming.some((timing) => !timing || timing.duration !== 259 || timing.easing !== 'cubic-bezier(0.34, 1.56, 0.64, 1)')
  || springScaleTiming[1].delay - springScaleTiming[0].delay !== 68
) {
  throw new Error(`spring-scale-in timing does not match the NCM effect: ${JSON.stringify(springScaleTiming)}`)
}
await page.waitForFunction(() => Array.from(document.querySelectorAll('.spring-scale-word')).every(
  (unit) => unit.getAnimations().every((animation) => animation.playState === 'finished'),
))
const pinnedPopoverBox = await page.locator('.donate-popover').boundingBox()
const pinnedPosition = await page.locator('.donate-popover').evaluate((element) => getComputedStyle(element).position)
if (!pinnedPopoverBox || pinnedPosition !== 'fixed' || Math.abs(1440 - (pinnedPopoverBox.x + pinnedPopoverBox.width) - 16) > 3) {
  throw new Error(`Offscreen donation popover should stay near the viewport bottom-right: ${JSON.stringify(pinnedPopoverBox)}`)
}
if (Math.abs(1050 - (pinnedPopoverBox.y + pinnedPopoverBox.height) - 16) > 3) {
  throw new Error('Pinned donation popover should keep a 16px bottom margin')
}
if (archive.suggestedFilename() !== 'compr、compr等3个文件的压缩.zip') {
  throw new Error(`ZIP name should summarize up to two five-character file names: ${archive.suggestedFilename()}`)
}
await page.screenshot({ path: '/tmp/compreesor-donate-pinned.png' })
await donateTrigger.scrollIntoViewIfNeeded()
await page.waitForFunction(() => !document.querySelector('.donate-popover')?.classList.contains('is-viewport-pinned'))
const popoverBox = await page.locator('.donate-popover').boundingBox()
const triggerBox = await donateTrigger.boundingBox()
if (!popoverBox || !triggerBox || popoverBox.y + popoverBox.height >= triggerBox.y) {
  throw new Error('Donation popover should float above its footer trigger')
}
const openAnimation = await page.locator('.donate-popover').evaluate((element) => getComputedStyle(element).animationName)
if (!openAnimation.includes('donate-pop-in')) throw new Error('Donation popover entrance animation is missing')
if ((await page.locator('.donate-qr-frame img').count()) !== 1) throw new Error('Donation QR code is missing')
await page.getByRole('tab', { name: '支付宝' }).click()
if ((await page.locator('.donate-praise-line').innerText()).trim() !== firstDonatePraise) {
  throw new Error('Switching donation methods should not replace the praise')
}
if (!(await page.locator('.donate-qr-frame img').getAttribute('src')).includes('alipay-qr.webp')) {
  throw new Error('Alipay QR code did not activate')
}
await page.getByRole('tab', { name: '微信' }).click()
await page.locator('.tool-panel').click({ position: { x: 6, y: 6 } })
await page.locator('.donate-popover.is-closing').waitFor({ state: 'attached' })
const closeAnimation = await page.locator('.donate-popover').evaluate((element) => getComputedStyle(element).animationName)
if (!closeAnimation.includes('donate-pop-out')) throw new Error('Donation popover closing animation is missing')
await page.locator('.donate-popover').waitFor({ state: 'detached' })
await page.evaluate(() => {
  const panel = document.querySelector('.tool-panel')
  if (panel instanceof HTMLElement) panel.style.minHeight = ''
  window.scrollTo(0, document.body.scrollHeight)
})
await donateTrigger.click()
await page.locator('.donate-popover').waitFor()
await page.waitForFunction(() => document.querySelector('.spring-scale-word')?.getAnimations().length)
const secondDonatePraise = (await page.locator('.donate-praise-line').innerText()).trim()
if (secondDonatePraise !== '你的效率感很漂亮，愿任务越变越小，成就感越攒越大。' || secondDonatePraise === firstDonatePraise) {
  throw new Error(`Donation praise should change without repeating when reopened: ${secondDonatePraise}`)
}
await page.waitForFunction(() => Array.from(document.querySelectorAll('.spring-scale-word')).every(
  (unit) => unit.getAnimations().every((animation) => animation.playState === 'finished'),
))

await page.screenshot({ path: '/tmp/compreesor-desktop.png', fullPage: true })

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await mobile.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await mobile.getByRole('heading', { name: '输出偏好' }).waitFor()
const bodyWidth = await mobile.evaluate(() => document.body.scrollWidth)
if (bodyWidth > 390) throw new Error(`Mobile layout overflows: ${bodyWidth}px`)
await mobile.screenshot({ path: '/tmp/compreesor-mobile.png', fullPage: true })

await mobile.locator('input[type="file"]').setInputFiles('/tmp/compreesor-fixture.png')
await mobile.waitForFunction(() => document.querySelectorAll('.job-row.status-done').length === 1, undefined, { timeout: 180_000 })
const mobileListWidth = await mobile.evaluate(() => document.body.scrollWidth)
if (mobileListWidth > 390) throw new Error(`Mobile list layout overflows: ${mobileListWidth}px`)
if (await mobile.locator('.job-progress').first().evaluate((element) => getComputedStyle(element).display) !== 'none') {
  throw new Error('Progress bar should hide when mobile space is limited')
}
const mobileDonateTrigger = mobile.getByRole('button', { name: '打赏作者' })
await mobileDonateTrigger.click()
await mobile.locator('.donate-popover').waitFor()
await mobile.waitForFunction(() => Array.from(document.querySelectorAll('.spring-scale-word')).every(
  (unit) => unit.getAnimations().every((animation) => animation.playState === 'finished'),
))
const mobilePopoverBox = await mobile.locator('.donate-popover').boundingBox()
const mobileTriggerBox = await mobileDonateTrigger.boundingBox()
if (!mobilePopoverBox || !mobileTriggerBox || mobilePopoverBox.x < 0 || mobilePopoverBox.x + mobilePopoverBox.width > 390) {
  throw new Error('Mobile donation popover is clipped by the viewport')
}
if (mobilePopoverBox.y + mobilePopoverBox.height >= mobileTriggerBox.y) {
  throw new Error('Mobile donation popover should float above its trigger')
}
await mobile.screenshot({ path: '/tmp/compreesor-mobile-list.png', fullPage: true })

await mobile.locator('.topbar-actions .language-button').click()
await mobile.getByRole('menuitemradio', { name: 'English' }).click()
await mobile.getByRole('heading', { name: 'Output preferences' }).waitFor()
const themeBefore = await mobile.evaluate(() => document.documentElement.dataset.theme)
await mobile.locator('.topbar-actions > .icon-button').click()
if (await mobile.evaluate(() => document.documentElement.dataset.theme) === themeBefore) throw new Error('Theme did not toggle')
await mobile.waitForTimeout(250)
await mobile.screenshot({ path: '/tmp/compreesor-mobile-dark.png', fullPage: true })

const guidePage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await guidePage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await guidePage.getByRole('button', { name: '使用说明' }).click()
await guidePage.getByRole('dialog').waitFor()
await guidePage.getByRole('link', { name: '作者主页' }).waitFor()
await guidePage.getByRole('button', { name: '关闭使用说明' }).click()
await guidePage.getByRole('button', { name: 'CLI 命令行' }).click()
await guidePage.getByRole('dialog', { name: '安装 CLI 批量压缩' }).waitFor()
await guidePage.getByRole('button', { name: '复制安装命令' }).click()
await guidePage.getByText('已复制安装命令', { exact: true }).waitFor()
if (!(await guidePage.getByRole('dialog').innerText()).includes('--preset extreme')) throw new Error('CLI preset instructions are missing')

const dropPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await dropPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await dropPage.locator('input[type="file"]').setInputFiles('/tmp/compreesor-fixture.png')
await dropPage.waitForFunction(() => document.querySelectorAll('.job-row.status-done').length === 1, undefined, { timeout: 180_000 })
const transfer = await dropPage.evaluateHandle(() => new DataTransfer())
const fixtureBase64 = (await readFile('/tmp/compreesor-fixture.png')).toString('base64')
await transfer.evaluate((dataTransfer, base64) => {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  dataTransfer.items.add(new File([bytes], 'drop-test.png', { type: 'image/png' }))
}, fixtureBase64)
await dropPage.locator('.queue-section').dispatchEvent('dragenter', { dataTransfer: transfer })
await dropPage.locator('.queue-drop-overlay').waitFor()
await dropPage.locator('.queue-section').dispatchEvent('drop', { dataTransfer: transfer })
await dropPage.waitForFunction(() => document.querySelectorAll('.job-row.status-done').length === 2, undefined, { timeout: 180_000 })

const audioPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await audioPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
if (!(await audioPage.locator('.preferences select').nth(2).locator('option[value="mp3"]').innerText()).includes('提取 MP3')) {
  throw new Error('MP3 option label is incorrect')
}
await audioPage.locator('.preferences select').nth(2).selectOption('mp3')
if (await audioPage.locator('.alpha-switch').count()) throw new Error('Alpha switch should be removed')
await audioPage.locator('input[type="file"]').setInputFiles('/tmp/compreesor-video.mp4')
await audioPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await audioPage.locator('.job-row.status-error').count()) {
  throw new Error(`MP3 extraction failed: ${await audioPage.locator('.job-list').innerText()}`)
}
const audioRow = await audioPage.locator('.job-row').first().innerText()
if (!audioRow.includes('MP3')) throw new Error(`Expected MP3 output, received: ${audioRow}`)
await audioPage.locator('.job-action button').first().click()
await audioPage.locator('.result-preview audio').waitFor()
await audioPage.locator('.result-preview > header button').click()
const audioDownload = audioPage.waitForEvent('download')
await audioPage.locator('.job-action button').nth(1).click()
const extractedAudio = await audioDownload
if (extractedAudio.suggestedFilename() !== 'compreesor-video-压缩.mp3') {
  throw new Error(`MP3 download should use Chinese compression suffix: ${extractedAudio.suggestedFilename()}`)
}

const alphaPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await alphaPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await alphaPage.locator('.preferences select').nth(2).selectOption('mov-alpha')
await alphaPage.locator('input[type="file"]').setInputFiles('/tmp/compreesor-alpha.mov')
await alphaPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await alphaPage.locator('.job-row.status-error').count()) {
  throw new Error(`Alpha video compression failed: ${await alphaPage.locator('.job-list').innerText()}`)
}
const alphaRow = await alphaPage.locator('.job-row').first().innerText()
if (!alphaRow.includes('MOV · Alpha')) throw new Error(`Expected alpha MOV output, received: ${alphaRow}`)
const alphaDownload = alphaPage.waitForEvent('download')
await alphaPage.locator('.job-action button').nth(1).click()
const alphaVideo = await alphaDownload
if (alphaVideo.suggestedFilename() !== 'compreesor-alpha-压缩.mov') {
  throw new Error(`MOV download should use Chinese compression suffix: ${alphaVideo.suggestedFilename()}`)
}

const jpegPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await jpegPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await jpegPage.locator('.preferences select').nth(0).selectOption('extreme')
await jpegPage.locator('.preferences select').nth(1).selectOption('jpeg')
await jpegPage.locator('input[type="file"]').setInputFiles('/tmp/compreesor-fixture.png')
await jpegPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await jpegPage.locator('.job-row.status-error').count()) {
  throw new Error(`JPG conversion failed: ${await jpegPage.locator('.job-list').innerText()}`)
}
const jpegRow = await jpegPage.locator('.job-row').first().innerText()
if ((await jpegPage.locator('.job-state span[title="JPEG"]').count()) !== 1) throw new Error(`Expected JPEG output, received: ${jpegRow}`)
const jpegDownload = jpegPage.waitForEvent('download')
await jpegPage.locator('.job-action button').nth(1).click()
const jpegImage = await jpegDownload
if (jpegImage.suggestedFilename() !== 'compreesor-fixture-压缩.jpg') {
  throw new Error(`JPG download should use Chinese compression suffix: ${jpegImage.suggestedFilename()}`)
}

const svgPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await svgPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await svgPage.locator('input[type="file"]').setInputFiles('tests/fixture.svg')
await svgPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await svgPage.locator('.job-row.status-error').count()) {
  throw new Error(`SVG compression failed: ${await svgPage.locator('.job-list').innerText()}`)
}
if ((await svgPage.locator('.thumbnail img').count()) !== 1) throw new Error('SVG thumbnail is missing')
const svgRatio = svgPage.locator('.result-ratio')
if (await svgRatio.getAttribute('data-animation') !== 'count-up') throw new Error('Result ratio count-up animation is missing')
const targetRatio = Number(await svgRatio.getAttribute('data-target-ratio'))
const animatedValues = []
for (let index = 0; index < 6; index += 1) {
  animatedValues.push(Number((await svgRatio.innerText()).replace('%', '')))
  await svgPage.waitForTimeout(110)
}
await svgPage.waitForFunction(
  (target) => document.querySelector('.result-ratio')?.textContent?.trim() === `${target}%`,
  targetRatio,
)
if (new Set(animatedValues).size < 2 || animatedValues.at(-1) <= animatedValues[0]) {
  throw new Error(`Result ratio did not visibly count up: ${animatedValues.join(', ')}`)
}
const svgDownload = svgPage.waitForEvent('download')
await svgPage.locator('.job-action button').nth(1).click()
const optimizedSvg = await svgDownload
if (optimizedSvg.suggestedFilename() !== 'fixture-压缩.svg') throw new Error('Optimized SVG did not use its Chinese suffix')
const optimizedSvgPath = await optimizedSvg.path()
if (!optimizedSvgPath) throw new Error('Optimized SVG download path is missing')
const sourceSvgSize = (await stat('tests/fixture.svg')).size
const optimizedSvgSize = (await stat(optimizedSvgPath)).size
if (optimizedSvgSize >= sourceSvgSize) throw new Error(`SVG was not compressed: ${sourceSvgSize} -> ${optimizedSvgSize}`)
const optimizedSvgText = await readFile(optimizedSvgPath, 'utf8')
if (!optimizedSvgText.startsWith('<svg') || optimizedSvgText.includes('<metadata')) throw new Error('Optimized SVG output is invalid')
await svgPage.screenshot({ path: '/tmp/compreesor-svg.png', fullPage: true })

const svgPngPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await svgPngPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await svgPngPage.locator('.preferences select').nth(1).selectOption('png')
await svgPngPage.locator('input[type="file"]').setInputFiles('tests/fixture.svg')
await svgPngPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await svgPngPage.locator('.job-row.status-error').count()) {
  throw new Error(`SVG to PNG conversion failed: ${await svgPngPage.locator('.job-list').innerText()}`)
}
const svgPngDownload = svgPngPage.waitForEvent('download')
await svgPngPage.locator('.job-action button').nth(1).click()
const svgPng = await svgPngDownload
if (svgPng.suggestedFilename() !== 'fixture-压缩.png') throw new Error('SVG to PNG did not use its Chinese suffix')

const reducedMotionPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await reducedMotionPage.emulateMedia({ reducedMotion: 'reduce' })
await reducedMotionPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await reducedMotionPage.getByRole('button', { name: '打赏作者' }).click()
await reducedMotionPage.locator('.donate-praise-line').waitFor()
const reducedMotionWords = await reducedMotionPage.locator('.spring-scale-word').evaluateAll((units) => units.map((unit) => ({
  animationCount: unit.getAnimations().length,
  opacity: getComputedStyle(unit).opacity,
})))
if (reducedMotionWords.length === 0 || reducedMotionWords.some((word) => word.animationCount !== 0 || word.opacity !== '1')) {
  throw new Error(`Reduced-motion donation copy should stay visible without WAAPI: ${JSON.stringify(reducedMotionWords)}`)
}

await browser.close()
if (errors.length > 0) throw new Error(errors.join('\n'))

console.log(JSON.stringify({
  rows,
  singleDownload: single.suggestedFilename(),
  zipDownload: archive.suggestedFilename(),
  audioDownload: extractedAudio.suggestedFilename(),
  alphaDownload: alphaVideo.suggestedFilename(),
  jpegDownload: jpegImage.suggestedFilename(),
  svgDownload: optimizedSvg.suggestedFilename(),
  svgCompression: [sourceSvgSize, optimizedSvgSize],
  svgPngDownload: svgPng.suggestedFilename(),
  animatedValues,
  svgScreenshot: '/tmp/compreesor-svg.png',
  bodyWidth,
  actionOrder: [clearBox.x, addBox.x, zipBox.x],
  desktopScreenshot: '/tmp/compreesor-desktop.png',
  pinnedDonateScreenshot: '/tmp/compreesor-donate-pinned.png',
  mobileScreenshot: '/tmp/compreesor-mobile.png',
  mobileListScreenshot: '/tmp/compreesor-mobile-list.png',
  mobileDarkScreenshot: '/tmp/compreesor-mobile-dark.png',
}))
