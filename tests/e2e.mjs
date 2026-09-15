import { chromium } from 'playwright'
import { readFile, stat } from 'node:fs/promises'
import { unzipSync } from 'fflate'

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
await page.locator('.preferences').waitFor()
const toolPanelPadding = await page.locator('.tool-panel').evaluate((element) => {
  const style = getComputedStyle(element)
  return {
    top: parseFloat(style.paddingTop),
    right: parseFloat(style.paddingRight),
    bottom: parseFloat(style.paddingBottom),
    left: parseFloat(style.paddingLeft),
  }
})
if (toolPanelPadding.top !== 14 || toolPanelPadding.bottom !== 14 || toolPanelPadding.left < 18 || toolPanelPadding.right < 18) {
  throw new Error(`Tool panel should use compact vertical padding without shrinking responsive side spacing: ${JSON.stringify(toolPanelPadding)}`)
}
if (await page.getByRole('heading', { name: '输出偏好' }).count()) throw new Error('The output-preferences heading should be removed')
if (await page.locator('.file-picker-input').getAttribute('data-file-limit') !== '1000') throw new Error('A single file intake should allow up to 1,000 files')
if (await page.locator('.drop-zone button, .drop-zone [role="button"]').count()) throw new Error('The empty drop zone should not show a file-picker button')
if ((await page.locator('.preferences select').count()) !== 3) throw new Error('Output preferences or compression preset are missing before upload')
if (await page.locator('.preferences select').nth(0).inputValue() !== 'all') throw new Error('Compression should default to both parallel qualities')
if ((await page.locator('.preferences select').nth(0).locator('option[value="all"]').innerText()).trim() !== '两档并行') throw new Error('Parallel-quality option copy is incorrect')
if ((await page.locator('.preferences select').nth(0).locator('option').count()) !== 8) throw new Error('Compression presets should include two qualities and five target sizes')
if (await page.locator('.preferences select').nth(0).locator('option[value="lossless"]').count()) throw new Error('Lossless should be removed from the web compression options')
if ((await page.locator('.preference-field').nth(1).locator(':scope > span').innerText()).trim() !== '图片和 PDF') throw new Error('Image and PDF preference label is incorrect')
if ((await page.locator('.preferences select').nth(1).locator('option[value="pdf"]').count()) !== 1) throw new Error('Image to PDF output is missing')
if ((await page.locator('.brand').innerText()).trim() !== '文件压缩大救星\nCompressor Studio') throw new Error('Brand name is incorrect')
if (!(await page.locator('.brand-mark img').getAttribute('src'))?.includes('robot-paper-')) throw new Error('Robot paper icon is missing')
await page.waitForFunction(() => document.querySelector('.brand-mark')?.getAnimations().length === 2)
const initialBrandAnimations = await page.locator('.brand-mark').evaluate((element) => element.getAnimations().map((animation) => animation.animationName))
if (!initialBrandAnimations.includes('brand-mark-drop-in') || !initialBrandAnimations.includes('brand-mark-bounce')) {
  throw new Error(`Brand entrance should include drop-in and bounce: ${initialBrandAnimations.join(', ')}`)
}
await page.locator('.brand-mark img').evaluate((image) => { image.dataset.stableNode = 'true' })
await page.locator('.brand').click()
await page.waitForFunction(() => document.querySelector('.brand-mark')?.classList.contains('brand-mark-bounce-trigger'))
const replayBrand = await page.locator('.brand-mark').evaluate((element) => ({
  animations: element.getAnimations().map((animation) => animation.animationName),
  stableNode: element.querySelector('img')?.dataset.stableNode,
}))
if (
  replayBrand.stableNode !== 'true'
  || replayBrand.animations.some((animation) => animation !== 'brand-mark-bounce')
) {
  throw new Error(`Brand click should replay bounce only on the same image node: ${JSON.stringify(replayBrand)}`)
}
await page.locator('.brand-mark').evaluate(async (element) => {
  await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
})
const settledBrand = await page.locator('.brand-mark').evaluate((element) => ({
  opacity: getComputedStyle(element).opacity,
  transform: getComputedStyle(element).transform,
}))
if (settledBrand.opacity !== '1' || (settledBrand.transform !== 'none' && settledBrand.transform !== 'matrix(1, 0, 0, 1, 0, 0)')) {
  throw new Error(`Brand should settle after the replayed entrance: ${JSON.stringify(settledBrand)}`)
}
await page.locator('.brand').hover()
await page.waitForFunction(() => document.querySelector('.brand-mark')?.classList.contains('brand-mark-bounce-trigger'))
const hoverBrandAnimations = await page.locator('.brand-mark').evaluate((element) => element.getAnimations().map((animation) => animation.animationName))
if (hoverBrandAnimations.some((animation) => animation !== 'brand-mark-bounce')) {
  throw new Error(`Brand hover should trigger bounce only: ${JSON.stringify(hoverBrandAnimations)}`)
}
await page.locator('.preferences').hover()
await page.waitForTimeout(40)
const brandAfterHover = await page.locator('.brand-mark').evaluate((element) => ({
  classes: element.className,
  animations: element.getAnimations().map((animation) => animation.animationName),
}))
if (brandAfterHover.classes.includes('brand-mark-in') || brandAfterHover.animations.includes('brand-mark-drop-in')) {
  throw new Error(`Leaving brand hover must not replay the entrance: ${JSON.stringify(brandAfterHover)}`)
}
const compressionTrigger = page.locator('.preference-compression .custom-select-trigger')
const preferenceBordersAtRest = await page.locator('.preferences .custom-select-trigger').evaluateAll((triggers) => triggers.map((trigger) => getComputedStyle(trigger).borderTopColor))
if (preferenceBordersAtRest.length !== 3 || preferenceBordersAtRest.some((color) => color !== 'rgba(0, 0, 0, 0)')) {
  throw new Error(`Top preference controls should have no resting border: ${preferenceBordersAtRest.join(' | ')}`)
}
await compressionTrigger.hover()
await page.waitForTimeout(180)
if (await compressionTrigger.evaluate((trigger) => getComputedStyle(trigger).borderTopColor) === 'rgba(0, 0, 0, 0)') {
  throw new Error('Top preference control border should appear on hover')
}
const hiddenNativeSelect = await page.locator('.preference-compression .custom-select-native').evaluate((element) => ({
  width: element.getBoundingClientRect().width,
  height: element.getBoundingClientRect().height,
  clipPath: getComputedStyle(element).clipPath,
}))
if (hiddenNativeSelect.width > 1 || hiddenNativeSelect.height > 1 || hiddenNativeSelect.clipPath === 'none') {
  throw new Error(`The browser-native select should not be visible: ${JSON.stringify(hiddenNativeSelect)}`)
}
const compressionTriggerBox = await compressionTrigger.boundingBox()
if (!compressionTriggerBox || compressionTriggerBox.width > 120) throw new Error(`Compression selector should stay compact: ${JSON.stringify(compressionTriggerBox)}`)
await compressionTrigger.click()
await page.locator('.preference-compression .custom-select-menu').waitFor()
await compressionTrigger.click()
await page.locator('.preference-compression .custom-select-menu').waitFor({ state: 'detached' })
await page.mouse.move(compressionTriggerBox.x + compressionTriggerBox.width / 2, compressionTriggerBox.y + compressionTriggerBox.height / 2)
await page.mouse.down()
await page.locator('.preference-compression .custom-select-menu').waitFor()
const draggedOption = page.locator('.preference-compression .custom-select-option[data-value="extreme"]')
const draggedOptionBox = await draggedOption.boundingBox()
if (!draggedOptionBox) throw new Error('Custom compression options did not open')
await page.mouse.move(draggedOptionBox.x + draggedOptionBox.width / 2, draggedOptionBox.y + draggedOptionBox.height / 2, { steps: 4 })
if (!(await draggedOption.getAttribute('class'))?.includes('is-highlighted')) throw new Error('Press-and-hover should highlight the custom option')
await page.mouse.up()
await page.waitForFunction(() => document.querySelector('.preference-compression select')?.value === 'extreme')
await page.locator('.preferences select').nth(0).selectOption('balanced')
if ((await page.locator('.preferences select').nth(1).locator('option[value="original"]').innerText()).trim() !== '保持原格式') {
  throw new Error('Original image output copy is incorrect')
}
if (await page.locator('.preferences select').nth(2).inputValue() !== 'mp3') throw new Error('Video output should default to MP3 extraction')
const preferencesBox = await page.locator('.preferences').boundingBox()
const firstPreferenceBox = await page.locator('.preference-field').first().boundingBox()
const preferenceLabelFont = await page.locator('.preference-field').first().locator(':scope > span').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
const preferenceOptionFont = await page.locator('.preference-field').first().locator('.custom-select-trigger').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
if (!preferencesBox || !firstPreferenceBox || firstPreferenceBox.x - preferencesBox.x > 2 || Math.abs(preferenceLabelFont - preferenceOptionFont) > 0.5) {
  throw new Error('Output preferences should form a compact left-aligned group')
}
if ((await page.locator('.topbar-actions button').count()) < 2) throw new Error('Language or theme controls are missing')
const languageControl = page.locator('.language-button')
await languageControl.hover()
await page.waitForTimeout(220)
const languageHover = await languageControl.evaluate((element) => {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
  return { y: matrix.m42, color: getComputedStyle(element).color }
})
if (languageHover.y > -1.5) throw new Error(`Language control hover lacks lift: ${JSON.stringify(languageHover)}`)
await languageControl.click()
const englishMenuItem = page.getByRole('menuitemradio', { name: 'English' })
await englishMenuItem.hover()
await page.waitForTimeout(200)
const languageItemX = await englishMenuItem.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)
if (languageItemX < 1.5) throw new Error('Language menu item hover lacks horizontal feedback')
await englishMenuItem.click()
if ((await page.locator('.brand-title').getAttribute('aria-label')) !== 'File Compression Lifesaver') throw new Error('English brand title is not translated')
await languageControl.click()
await page.getByRole('menuitemradio', { name: '繁體中文' }).click()
if ((await page.locator('.brand-title').getAttribute('aria-label')) !== '檔案壓縮大救星') throw new Error('Traditional Chinese brand title is not translated')
await languageControl.click()
await page.getByRole('menuitemradio', { name: '日本語' }).click()
if ((await page.locator('.brand-title').getAttribute('aria-label')) !== 'ファイル圧縮の救世主') throw new Error('Japanese brand title is not translated')
await languageControl.click()
await page.getByRole('menuitemradio', { name: '简体中文' }).click()
if ((await page.locator('.brand-title').getAttribute('aria-label')) !== '文件压缩大救星') throw new Error('Simplified Chinese brand title is not translated')
const themeControl = page.locator('.topbar-actions > .icon-button')
await themeControl.hover()
await page.waitForTimeout(220)
const themeHoverY = await themeControl.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42)
if (themeHoverY > -1.5) throw new Error('Theme control hover lacks lift')
await themeControl.click()
await page.waitForFunction(() => document.querySelector('.topbar-actions > .icon-button svg')?.getAnimations().some((animation) => animation.animationName === 'control-icon-in'))
await themeControl.click()
await page.locator('.file-picker-input').setInputFiles([
  '/tmp/compreesor-fixture.png',
  '/tmp/compreesor-animation.gif',
  '/tmp/compreesor-video.mp4',
])

if (await page.locator('.drop-zone').count()) throw new Error('Drop zone should hide after files are added')
await page.getByRole('button', { name: '清空' }).waitFor()

const processingRow = page.locator('.job-row.status-processing').first()
await processingRow.waitFor({ timeout: 20_000 })
if (await page.getByRole('button', { name: '打包下载' }).count()) {
  throw new Error('ZIP download should stay hidden while files are processing')
}
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
const packageButton = page.getByRole('button', { name: '打包下载' })
await packageButton.waitFor()
if (await page.getByRole('button', { name: '选择打包档位' }).count()) throw new Error('Single-quality mode should not show a ZIP quality menu')
const packageEntryAnimation = await packageButton.evaluate((element) => getComputedStyle(element).animationName)
if (!packageEntryAnimation.includes('package-button-spring-in')) {
  throw new Error(`ZIP download entrance animation is missing: ${packageEntryAnimation}`)
}

const rows = await page.locator('.job-row').allInnerTexts()
if (!rows.some((row) => row.includes('GIF'))) throw new Error('GIF did not finish')
if (!rows.some((row) => row.includes('MP3'))) throw new Error('Video did not default to MP3 extraction')
await page.waitForFunction(() => document.querySelectorAll('.thumbnail img').length === 3, undefined, { timeout: 10_000 })
if ((await page.locator('.thumbnail img').count()) !== 3) throw new Error('Expected thumbnails for every file')
const firstThumbnail = await page.locator('.thumbnail').first().boundingBox()
if (!firstThumbnail || firstThumbnail.width > 44 || firstThumbnail.height > 44) throw new Error('Thumbnails are not compact')
if (!(await page.locator('.job-copy p').first().innerText()).includes('→')) throw new Error('Compression details should show original and result sizes')
if ((await page.locator('.job-progress').count()) !== 3) throw new Error('Every file should expose a progress bar')
if (await page.locator('.job-progress').first().getAttribute('aria-valuenow') !== '100') throw new Error('Completed progress should reach 100')
const compactCopyBox = await page.locator('.job-copy').first().boundingBox()
const compactProgressBox = await page.locator('.job-progress').first().boundingBox()
if (!compactCopyBox || !compactProgressBox || Math.abs((compactProgressBox.y + compactProgressBox.height / 2) - (compactCopyBox.y + compactCopyBox.height / 2)) > 3) {
  throw new Error('Compact progress should sit in the vertical middle of the file information')
}
await page.waitForFunction(() => /^\d+%$/.test(document.querySelector('.job-row .job-state')?.textContent?.trim() ?? ''))
if (!/^\d+%$/.test((await page.locator('.job-row').first().locator('.job-state').innerText()).replace(/\s+/g, ''))) {
  throw new Error('Image result ratio is missing beside the green check')
}
const rowBorders = await page.locator('.job-row').first().evaluate((element) => {
  const style = getComputedStyle(element)
  return { top: style.borderTopWidth, right: style.borderRightWidth, bottom: style.borderBottomWidth, radius: style.borderRadius }
})
if (rowBorders.top !== '0px' || rowBorders.right !== '0px' || rowBorders.bottom !== '0px' || rowBorders.radius !== '0px') {
  throw new Error(`File rows should use separators only: ${JSON.stringify(rowBorders)}`)
}
const secondRowBorderTop = await page.locator('.job-row').nth(1).evaluate((element) => getComputedStyle(element).borderTopWidth)
if (secondRowBorderTop === '0px') throw new Error('Adjacent file rows should be separated by a single line')
const listScrollBehavior = await page.locator('.job-list').evaluate((element) => {
  const list = element
  list.style.maxHeight = '96px'
  const style = getComputedStyle(list)
  const result = {
    overflowY: style.overflowY,
    overscrollBehaviorY: style.overscrollBehaviorY,
    hasInternalOverflow: list.scrollHeight > list.clientHeight,
  }
  list.style.maxHeight = ''
  return result
})
if (listScrollBehavior.overflowY !== 'auto' || listScrollBehavior.overscrollBehaviorY !== 'contain' || !listScrollBehavior.hasInternalOverflow) {
  throw new Error(`File list should own its bounded scrolling: ${JSON.stringify(listScrollBehavior)}`)
}
const pageScrollLayout = await page.evaluate(() => {
  const shell = document.querySelector('.app-shell')
  const list = document.querySelector('.job-list')
  if (!(shell instanceof HTMLElement) || !(list instanceof HTMLElement)) return null
  return {
    windowScrollY: window.scrollY,
    documentOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    bodyOverflow: document.body.scrollHeight - document.body.clientHeight,
    shellHeight: shell.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
    listOverflowY: getComputedStyle(list).overflowY,
  }
})
if (
  !pageScrollLayout
  || Math.abs(pageScrollLayout.windowScrollY) > 1
  || pageScrollLayout.documentOverflow > 1
  || pageScrollLayout.bodyOverflow > 1
  || Math.abs(pageScrollLayout.shellHeight - pageScrollLayout.viewportHeight) > 1
  || pageScrollLayout.listOverflowY !== 'auto'
) {
  throw new Error(`The page should stay fixed while only the file list scrolls: ${JSON.stringify(pageScrollLayout)}`)
}
const donateTrigger = page.getByRole('button', { name: '打赏作者' })
await donateTrigger.waitFor()
if (await page.locator('.donate-popover').count()) throw new Error('Donation popover should stay closed before ZIP download')
const footerLinkBoxes = await Promise.all([
  page.getByRole('button', { name: '使用说明' }).boundingBox(),
  page.getByRole('link', { name: '作者主页' }).boundingBox(),
  page.getByRole('button', { name: 'CLI 命令行和客户端' }).boundingBox(),
  donateTrigger.boundingBox(),
])
if (footerLinkBoxes.some((box) => !box)) throw new Error('Footer links are missing')
if (Math.max(...footerLinkBoxes.map((box) => box.y)) - Math.min(...footerLinkBoxes.map((box) => box.y)) > 2) {
  throw new Error('Donation trigger should share the footer baseline')
}
if (!(footerLinkBoxes[3].x > footerLinkBoxes[2].x)) throw new Error('Donation trigger should sit at the bottom right')

await page.waitForFunction(() => document.querySelector('.download-all')?.getAnimations().every(
  (animation) => animation.playState === 'finished',
))
const clearBox = await page.getByRole('button', { name: '清空' }).boundingBox()
const zipBox = await page.getByRole('button', { name: '打包下载' }).boundingBox()
if (!clearBox || !zipBox || !(clearBox.x < zipBox.x)) {
  throw new Error('Queue action order is incorrect')
}
if (Math.abs(clearBox.y - zipBox.y) > 2) {
  throw new Error('Queue actions should stay in a single row')
}
if (await page.locator('.queue-controls .file-picker-menu, .queue-controls .add-more-button').count()) throw new Error('The queue should not show an add-files button')
const singleDownloadButton = page.locator('.job-row').first().locator('.job-action button')
if ((await page.locator('.job-row').first().locator('.job-action button').count()) !== 1) throw new Error('Single-quality rows should only retain the download action')
if ((await singleDownloadButton.innerText()).trim() !== '') throw new Error('Single download should be icon only')
const singleDownloadColor = await singleDownloadButton.evaluate((element) => getComputedStyle(element).color)
if (singleDownloadColor !== 'rgb(255, 255, 255)') throw new Error(`Download icon should be white, received ${singleDownloadColor}`)
const singleDownloadBackground = await singleDownloadButton.evaluate((element) => getComputedStyle(element).backgroundColor)
if (singleDownloadBackground !== 'rgba(0, 0, 0, 0)') {
  throw new Error(`Download button should have no background, received ${singleDownloadBackground}`)
}

const firstRow = page.locator('.job-row').first()
await firstRow.hover()
await page.locator('.result-preview .image-preview-stage img').waitFor()
if (!(await page.locator('.result-preview').getAttribute('class'))?.includes('is-transient')) throw new Error('Row hover should open a transient bottom preview')
const transientPreview = await page.locator('.result-preview').evaluate((preview) => ({
  height: preview.offsetHeight,
  titleDisplay: getComputedStyle(preview.querySelector(':scope > header')).display,
  resizeDisplay: getComputedStyle(preview.querySelector('.preview-resize-handle')).display,
}))
if (Math.abs(transientPreview.height - 220) > 2 || transientPreview.titleDisplay !== 'none' || transientPreview.resizeDisplay !== 'none') {
  throw new Error(`Hover preview should be content-only at the minimum height: ${JSON.stringify(transientPreview)}`)
}
const previewEntrance = await page.locator('.result-preview').evaluate((element) => getComputedStyle(element).animationName)
if (!previewEntrance.includes('preview-in')) throw new Error(`Preview entrance animation is missing: ${previewEntrance}`)
await page.locator('.preferences').hover()
await page.waitForFunction(() => !document.querySelector('.result-preview') || document.querySelector('.result-preview')?.classList.contains('is-exiting'))
if (await page.locator('.result-preview.is-exiting').count()) {
  const previewExit = await page.locator('.result-preview').evaluate((element) => getComputedStyle(element).animationName)
  if (!previewExit.includes('preview-out')) throw new Error(`Preview exit animation is missing: ${previewExit}`)
}
await page.waitForFunction(() => !document.querySelector('.result-preview'))
await firstRow.click()
await page.locator('.result-preview .image-preview-stage img').waitFor()
if (!(await page.locator('.result-preview').getAttribute('class'))?.includes('is-pinned')) throw new Error('Row click should pin the bottom preview')
const selectedRowStyle = await firstRow.evaluate((element) => {
  const style = getComputedStyle(element)
  return { boxShadow: style.boxShadow, radius: style.borderRadius }
})
if (selectedRowStyle.boxShadow !== 'none' || selectedRowStyle.radius !== '4px') {
  throw new Error(`Selected rows should use a 4px background without a left accent bar: ${JSON.stringify(selectedRowStyle)}`)
}
await page.waitForTimeout(260)
const previewBox = await page.locator('.result-preview').boundingBox()
if (!previewBox || Math.abs(previewBox.x) > 2 || Math.abs(previewBox.width - 1440) > 2 || Math.abs(1050 - (previewBox.y + previewBox.height)) > 2) {
  throw new Error(`Preview should span the viewport width at the bottom: ${JSON.stringify(previewBox)}`)
}
await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.job-list')).paddingBottom) > 20)
const previewScrollLayout = await page.locator('.job-list').evaluate((list) => {
  list.scrollTop = list.scrollHeight
  const preview = document.querySelector('.result-preview')
  const lastRow = list.lastElementChild
  if (!(preview instanceof HTMLElement) || !(lastRow instanceof HTMLElement)) return null
  const previewBox = preview.getBoundingClientRect()
  const rowBox = lastRow.getBoundingClientRect()
  return {
    gap: previewBox.top - rowBox.bottom,
    paddingBottom: parseFloat(getComputedStyle(list).paddingBottom),
    previewHeight: previewBox.height,
  }
})
if (
  !previewScrollLayout
  || previewScrollLayout.gap < 16
  || previewScrollLayout.paddingBottom < previewScrollLayout.previewHeight + 18
) {
  throw new Error(`The last file should scroll above the preview with a visible gap: ${JSON.stringify(previewScrollLayout)}`)
}
if ((await page.locator('.result-preview .preview-page').count()) !== 2) throw new Error('Image preview paging controls are missing')
const initialPreviewGeometry = await page.locator('.image-preview-stage').evaluate((stage) => {
  const image = stage.querySelector('img')
  if (!(image instanceof HTMLImageElement)) return null
  const stageBox = stage.getBoundingClientRect()
  const imageBox = image.getBoundingClientRect()
  return {
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    renderedWidth: imageBox.width,
    renderedHeight: imageBox.height,
    horizontalCenterGap: (imageBox.left + imageBox.width / 2) - (stageBox.left + stageBox.width / 2),
    verticalCenterGap: (imageBox.top + imageBox.height / 2) - (stageBox.top + stageBox.height / 2),
  }
})
if (
  !initialPreviewGeometry
  || Math.abs(initialPreviewGeometry.renderedWidth - initialPreviewGeometry.naturalWidth) > 1
  || Math.abs(initialPreviewGeometry.renderedHeight - initialPreviewGeometry.naturalHeight) > 1
  || Math.abs(initialPreviewGeometry.horizontalCenterGap) > 1
  || Math.abs(initialPreviewGeometry.verticalCenterGap) > 1
) {
  throw new Error(`Preview should open at 100% centered on the file: ${JSON.stringify(initialPreviewGeometry)}`)
}
const rememberedResizeHandle = await page.locator('.preview-resize-handle').boundingBox()
const previewHeightBeforeRemembering = await page.locator('.result-preview').boundingBox()
if (!rememberedResizeHandle || !previewHeightBeforeRemembering) throw new Error('Preview resize handle is missing before height-memory verification')
await page.mouse.move(rememberedResizeHandle.x + rememberedResizeHandle.width / 2, rememberedResizeHandle.y + rememberedResizeHandle.height / 2)
await page.mouse.down()
await page.mouse.move(rememberedResizeHandle.x + rememberedResizeHandle.width / 2, rememberedResizeHandle.y - 64, { steps: 5 })
await page.mouse.up()
const rememberedPreviewBox = await page.locator('.result-preview').boundingBox()
if (!rememberedPreviewBox || rememberedPreviewBox.height < previewHeightBeforeRemembering.height + 48) {
  throw new Error(`Preview height should change before it is remembered: ${JSON.stringify({ previewHeightBeforeRemembering, rememberedPreviewBox })}`)
}
const storedPreviewHeight = await page.evaluate(() => Number(window.localStorage.getItem('compreesor-preview-height')))
if (Math.abs(storedPreviewHeight - rememberedPreviewBox.height) > 2) throw new Error(`Preview height was not persisted: ${JSON.stringify({ storedPreviewHeight, rememberedPreviewBox })}`)
await page.locator('.preview-page.next').click()
await page.waitForFunction(() => document.querySelector('.result-preview > header strong')?.textContent?.trim() === 'compreesor-animation.gif')
const nextFilePreviewBox = await page.locator('.result-preview').boundingBox()
if (!nextFilePreviewBox || Math.abs(nextFilePreviewBox.height - rememberedPreviewBox.height) > 2) {
  throw new Error(`Preview height should stay identical across files: ${JSON.stringify({ rememberedPreviewBox, nextFilePreviewBox })}`)
}
await page.keyboard.press('Escape')
await page.waitForFunction(() => !document.querySelector('.result-preview'))
await firstRow.click()
await page.waitForFunction(() => document.querySelector('.result-preview')?.getAnimations().every(
  (animation) => animation.playState === 'finished',
))
const reopenedPreviewBox = await page.locator('.result-preview').boundingBox()
if (!reopenedPreviewBox || Math.abs(reopenedPreviewBox.height - rememberedPreviewBox.height) > 2) {
  throw new Error(`Preview height should survive closing and reopening: ${JSON.stringify({ rememberedPreviewBox, reopenedPreviewBox })}`)
}
await page.locator('.tool-panel').click({ position: { x: 6, y: 6 } })
await page.waitForFunction(() => !document.querySelector('.result-preview'))
if (await page.locator('.job-row.is-selected').count()) throw new Error('Clicking blank space should clear file selection')
await firstRow.hover()
await page.locator('.result-preview').waitFor()
await page.locator('.job-list').evaluate((list) => { list.scrollTop = list.scrollHeight })
const lastRow = page.locator('.job-row').last()
await lastRow.hover()
await page.waitForFunction(() => document.querySelector('.result-preview > header strong')?.textContent?.trim() === 'compreesor-video.mp4')
await page.locator('.preferences').hover()
await page.waitForFunction(() => !document.querySelector('.result-preview'))
await page.locator('.job-list').evaluate((list) => { list.scrollTop = 0 })
const connectedSelectionRadii = await page.locator('.job-row').evaluateAll((rows) => {
  const selectedRows = rows.slice(0, 2)
  selectedRows.forEach((row) => row.classList.add('is-selected'))
  const radii = selectedRows.map((row) => {
    const style = getComputedStyle(row)
    return {
      topLeft: style.borderTopLeftRadius,
      topRight: style.borderTopRightRadius,
      bottomLeft: style.borderBottomLeftRadius,
      bottomRight: style.borderBottomRightRadius,
    }
  })
  selectedRows.forEach((row) => row.classList.remove('is-selected'))
  return radii
})
if (
  connectedSelectionRadii[0]?.topLeft !== '4px'
  || connectedSelectionRadii[0]?.bottomLeft !== '0px'
  || connectedSelectionRadii[1]?.topLeft !== '0px'
  || connectedSelectionRadii[1]?.bottomLeft !== '4px'
) {
  throw new Error(`Connected selections should only round the outer ends: ${JSON.stringify(connectedSelectionRadii)}`)
}
await firstRow.click()
await page.locator('.result-preview').waitFor()
await firstRow.press('ArrowDown')
if ((await page.locator('.result-preview > header strong').innerText()).trim() !== 'compreesor-animation.gif') throw new Error('ArrowDown should select and preview the next file')
await page.locator('.job-row').nth(1).press('ArrowUp')
if ((await page.locator('.result-preview > header strong').innerText()).trim() !== 'compreesor-fixture.png') throw new Error('ArrowUp should select and preview the previous file')
await page.keyboard.press('Escape')
await page.locator('.result-preview.is-exiting').waitFor()
await page.waitForFunction(() => !document.querySelector('.result-preview'))
if (await page.locator('.job-row.is-selected').count()) throw new Error('Escape should clear file selection')

const comparisonPage = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 })
await comparisonPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await comparisonPage.evaluate(() => window.localStorage.setItem('compreesor-preview-height', '520'))
await comparisonPage.reload({ waitUntil: 'networkidle' })
await comparisonPage.locator('.file-picker-input').setInputFiles('/tmp/compreesor-fixture.png')
await comparisonPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await comparisonPage.locator('.job-row.status-error').count()) {
  throw new Error(`Comparison fixture failed: ${await comparisonPage.locator('.job-list').innerText()}`)
}
if (await comparisonPage.locator('.variant-hover-preview').count()) throw new Error('Per-quality hover previews should be removed')
const qualityColumns = await comparisonPage.locator('.variant-result-item').evaluateAll((items) => items.map((item) => {
  const box = item.getBoundingClientRect()
  const style = getComputedStyle(item)
  const value = item.querySelector('small')
  const valueBox = value?.getBoundingClientRect()
  const valueStyle = value ? getComputedStyle(value) : null
  const sizeBox = item.querySelector('.variant-size')?.getBoundingClientRect()
  const ratioBox = item.querySelector('.variant-ratio')?.getBoundingClientRect()
  const outputBytes = Number(item.getAttribute('data-output-bytes'))
  const originalBytes = Number(item.closest('.job-row')?.getAttribute('data-original-bytes'))
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    border: style.borderWidth,
    background: style.backgroundColor,
    textAlign: style.textAlign,
    titleCount: item.querySelectorAll('b').length,
    valueY: valueBox?.y ?? null,
    valueFontSize: valueStyle ? parseFloat(valueStyle.fontSize) : null,
    sizeBottom: sizeBox?.bottom ?? null,
    ratioTop: ratioBox?.top ?? null,
    ratioText: item.querySelector('.variant-ratio')?.textContent?.replace(/\s+/g, '') ?? '',
    expectedRatio: originalBytes > 0 ? `${Math.round((outputBytes / originalBytes) * 100)}%` : '0%',
  }
}))
const compactComparisonRowHeight = await comparisonPage.locator('.job-row').first().evaluate((element) => element.getBoundingClientRect().height)
const qualityHeader = await comparisonPage.locator('.variant-column-headers button').evaluateAll((buttons) => buttons.map((button) => ({
  text: button.textContent?.trim() ?? '',
  width: button.getBoundingClientRect().width,
  fontSize: parseFloat(getComputedStyle(button).fontSize),
  textAlign: getComputedStyle(button).textAlign,
  contentLeftGap: button.firstElementChild ? button.firstElementChild.getBoundingClientRect().left - button.getBoundingClientRect().left : null,
})))
const fileNameHeader = comparisonPage.locator('.job-name-column-header')
if (
  qualityColumns.length !== 2
  || qualityColumns.some((column) => column.border !== '0px' || column.background !== 'rgba(0, 0, 0, 0)')
  || qualityColumns.some((column) => column.textAlign !== 'left' || column.titleCount !== 0)
  || Math.max(...qualityColumns.map((column) => column.y)) - Math.min(...qualityColumns.map((column) => column.y)) > 1
  || Math.max(...qualityColumns.map((column) => column.width)) - Math.min(...qualityColumns.map((column) => column.width)) > 1
  || qualityColumns.some((column) => column.width < 82 || column.width > 93)
  || qualityColumns.some((column) => column.valueY === null || column.valueFontSize === null || column.valueFontSize < 12 || !/^\d+%$/.test(column.ratioText))
  || qualityColumns.some((column) => column.ratioText !== column.expectedRatio)
  || qualityColumns.some((column) => column.sizeBottom === null || column.ratioTop === null || column.ratioTop < column.sizeBottom - 1)
  || Math.max(...qualityColumns.map((column) => column.valueY)) - Math.min(...qualityColumns.map((column) => column.valueY)) > 1
  || qualityHeader.length !== 2
  || qualityHeader.map((column) => column.text).join('|') !== '极限|够用'
  || qualityHeader.some((column) => column.fontSize < 12 || column.width < 82 || column.width > 93 || column.contentLeftGap === null || column.contentLeftGap > 3)
  || (await fileNameHeader.innerText()).trim() !== '文件名'
  || await fileNameHeader.evaluate((button) => button.firstElementChild ? button.firstElementChild.getBoundingClientRect().left - button.getBoundingClientRect().left > 3 : true)
  || compactComparisonRowHeight > 84
) {
  throw new Error(`Quality results should use compact header-aligned columns: ${JSON.stringify({ qualityColumns, qualityHeader, compactComparisonRowHeight })}`)
}
const fileHeaderAlignment = await fileNameHeader.evaluate((button) => {
  const header = button.closest('.job-list-header')?.getBoundingClientRect()
  const filename = document.querySelector('.job-row .job-copy')?.getBoundingClientRect()
  const box = button.getBoundingClientRect()
  return header && filename ? {
    headerLeftGap: box.left - header.left,
    distanceBeforeFilename: filename.left - box.left,
  } : null
})
if (!fileHeaderAlignment || fileHeaderAlignment.headerLeftGap > 9 || fileHeaderAlignment.distanceBeforeFilename < 40) {
  throw new Error(`File-name header should align to the table's left edge: ${JSON.stringify(fileHeaderAlignment)}`)
}
if (await comparisonPage.locator('.variant-saving').count()) throw new Error('Quality results should omit the saved-prefix label')
if ((await comparisonPage.locator('.job-row.has-variants .job-copy p').innerText()).includes('→')) throw new Error('Parallel-quality rows should show only the original file size on the left')
if (await comparisonPage.locator('.queue-summary > p').count()) throw new Error('Parallel-quality summary should not use a separate detail line')
if (!(await comparisonPage.locator('.queue-summary h2').innerText()).includes('1 个已完成')) throw new Error('Completed count should sit beside the file count')
const extremeHeader = comparisonPage.getByRole('button', { name: /按极限结果排序/ })
await extremeHeader.click()
if (await extremeHeader.getAttribute('data-sort-direction') !== 'ascending' || await extremeHeader.getAttribute('data-sort-metric') !== 'size' || !(await extremeHeader.innerText()).includes('体积↑')) throw new Error('First quality-header click should sort size ascending')
const unifiedTableType = await comparisonPage.evaluate(() => {
  const selectors = [
    '.queue-status-inline',
    '.queue-controls button',
    '.variant-column-headers button > span',
    '.variant-column-headers button > small',
    '.variant-size',
    '.variant-ratio',
  ]
  return selectors.map((selector) => ({
    selector,
    size: parseFloat(getComputedStyle(document.querySelector(selector)).fontSize),
  }))
})
if (unifiedTableType.some((item) => item.size !== 12)) {
  throw new Error(`Table, status, controls and sorting labels should share one font size: ${JSON.stringify(unifiedTableType)}`)
}
await extremeHeader.click()
if (await extremeHeader.getAttribute('data-sort-direction') !== 'ascending' || await extremeHeader.getAttribute('data-sort-metric') !== 'ratio' || !(await extremeHeader.innerText()).includes('压缩比↑')) throw new Error('Second quality-header click should sort ratio ascending')
await extremeHeader.click()
if (await extremeHeader.getAttribute('data-sort-direction') !== 'descending' || await extremeHeader.getAttribute('data-sort-metric') !== 'size' || !(await extremeHeader.innerText()).includes('体积↓')) throw new Error('Third quality-header click should sort size descending')
await extremeHeader.click()
if (await extremeHeader.getAttribute('data-sort-direction') !== 'descending' || await extremeHeader.getAttribute('data-sort-metric') !== 'ratio' || !(await extremeHeader.innerText()).includes('压缩比↓')) throw new Error('Fourth quality-header click should sort ratio descending')
if (await comparisonPage.locator('.result-ratio-range').count()) throw new Error('Parallel-quality rows should not show a unified ratio range')
if (await comparisonPage.locator('.job-row.has-variants .job-state svg').count()) throw new Error('Parallel-quality rows should omit the redundant completion icon')
if ((await comparisonPage.locator('.job-row.has-variants .job-state').innerText()).trim() !== '') throw new Error('Parallel-quality rows should omit redundant completion text')
if (await comparisonPage.getByRole('button', { name: '选择打包档位' }).count()) throw new Error('A single file should not show a ZIP quality menu')
const expectedPackageSavings = await comparisonPage.locator('.job-row.has-variants').evaluate((row) => {
  const original = Number(row.getAttribute('data-original-bytes'))
  const outputs = Object.fromEntries(Array.from(row.querySelectorAll('.variant-result-item')).map((item) => [
    item.getAttribute('data-preset'),
    Number(item.getAttribute('data-output-bytes')),
  ]))
  const saved = (result, originalBytes = original) => Math.max(0, Math.round((1 - result / originalBytes) * 100))
  return {
    extreme: saved(outputs.extreme),
    balanced: saved(outputs.balanced),
  }
})
if ((await comparisonPage.locator('.download-all').innerText()).trim() !== `下载 · 够用 · 省${expectedPackageSavings.balanced}%`) throw new Error('A single parallel-quality file should download the balanced result directly')
await comparisonPage.locator('.result-preview.is-pinned').waitFor()
if ((await comparisonPage.locator('.result-preview > header strong').innerText()).trim() !== 'compreesor-fixture.png') throw new Error('The only completed file should open in the preview automatically')
await comparisonPage.setViewportSize({ width: 430, height: 760 })
const smallWindowLayout = await comparisonPage.locator('.job-row.has-variants').evaluate((row) => {
  const rowBox = row.getBoundingClientRect()
  const thumbnail = row.querySelector('.thumbnail')?.getBoundingClientRect()
  const copy = row.querySelector('.job-copy')?.getBoundingClientRect()
  const variants = row.querySelector('.variant-results')?.getBoundingClientRect()
  return thumbnail && copy && variants ? {
    rowRight: rowBox.right,
    rowHeight: rowBox.height,
    copyRight: copy.right,
    variantsLeft: variants.left,
    variantsRight: variants.right,
    variantsWidth: variants.width,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  } : null
})
if (
  !smallWindowLayout
  || smallWindowLayout.copyRight > smallWindowLayout.variantsLeft + 1
  || smallWindowLayout.variantsRight > smallWindowLayout.rowRight + 1
  || smallWindowLayout.variantsWidth > 137
  || smallWindowLayout.rowHeight > 72
  || smallWindowLayout.pageWidth > smallWindowLayout.viewportWidth
) {
  throw new Error(`Small-window quality rows should stay aligned and compact: ${JSON.stringify(smallWindowLayout)}`)
}
await comparisonPage.waitForFunction(() => {
  const preview = document.querySelector('.result-preview')
  const selected = document.querySelector('.job-row.is-selected')
  if (!(preview instanceof HTMLElement) || !(selected instanceof HTMLElement)) return false
  return preview.getBoundingClientRect().top - selected.getBoundingClientRect().bottom >= 15
})
const autoHeightLimit = await comparisonPage.locator('.result-preview').evaluate((preview) => {
  const selected = document.querySelector('.job-row.is-selected')
  if (!(selected instanceof HTMLElement)) return null
  const previewBox = preview.getBoundingClientRect()
  const selectedBox = selected.getBoundingClientRect()
  return { gap: previewBox.top - selectedBox.bottom, previewHeight: previewBox.height }
})
if (!autoHeightLimit || autoHeightLimit.gap < 15) {
  throw new Error(`Automatic preview resizing should stop below the selected file: ${JSON.stringify(autoHeightLimit)}`)
}
await comparisonPage.setViewportSize({ width: 1440, height: 1050 })
await comparisonPage.keyboard.press('Escape')
await comparisonPage.waitForFunction(() => !document.querySelector('.result-preview'))
const comparisonRow = comparisonPage.locator('.job-row').first()
await comparisonRow.hover()
await comparisonPage.locator('.result-preview .comparison-image-stage').first().waitFor()
if (!(await comparisonPage.locator('.result-preview').getAttribute('class'))?.includes('is-transient')) throw new Error('Whole-row hover should open the comparison preview')
const transientComparisonChrome = await comparisonPage.locator('.result-preview').evaluate((preview) => ({
  height: preview.offsetHeight,
  mainHeader: getComputedStyle(preview.querySelector(':scope > header')).display,
  qualityHeaders: Array.from(preview.querySelectorAll('.comparison-card > header')).map((header) => getComputedStyle(header).display),
}))
if (Math.abs(transientComparisonChrome.height - 220) > 2 || transientComparisonChrome.mainHeader !== 'none' || transientComparisonChrome.qualityHeaders.some((display) => display !== 'none')) {
  throw new Error(`Transient comparison should show only file content at minimum height: ${JSON.stringify(transientComparisonChrome)}`)
}
await comparisonPage.waitForFunction(() => Array.from(document.querySelectorAll('.comparison-image-stage img')).every(
  (image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
))
const sourceDimensions = await comparisonPage.locator('.thumbnail img').evaluate((image) => ({
  width: image.naturalWidth,
  height: image.naturalHeight,
}))
const compressedDimensions = await comparisonPage.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => ({
  width: image.naturalWidth,
  height: image.naturalHeight,
  objectFit: getComputedStyle(image).objectFit,
})))
const sourceAspectRatio = sourceDimensions.width / sourceDimensions.height
if (
  compressedDimensions.length !== 3
  || compressedDimensions.some((image) => image.objectFit !== 'none' || Math.abs(image.width / image.height - sourceAspectRatio) > 0.002)
) {
  throw new Error(`Compressed previews should preserve the complete source geometry: ${JSON.stringify({ sourceDimensions, compressedDimensions })}`)
}
await comparisonRow.click()
await comparisonPage.locator('.result-preview .comparison-image-stage').first().waitFor()
if (!(await comparisonPage.locator('.result-preview').getAttribute('class'))?.includes('is-pinned')) throw new Error('Clicking the file row should pin its comparison preview')
await comparisonPage.waitForFunction(() => document.querySelector('.result-preview')?.getAnimations().every(
  (animation) => animation.playState === 'finished',
))
if ((await comparisonPage.locator('.result-preview > header strong').innerText()).trim() !== 'compreesor-fixture.png') {
  throw new Error('Preview header should retain the original filename')
}
const previewTitleLine = await comparisonPage.locator('.preview-title').evaluate((title) => {
  const name = title.querySelector('strong')?.getBoundingClientRect()
  const size = title.querySelector('.preview-source-size')?.getBoundingClientRect()
  return name && size ? {
    sizeText: title.querySelector('.preview-source-size')?.textContent?.trim(),
    baselineGap: Math.abs(name.bottom - size.bottom),
    spanCount: title.querySelectorAll(':scope > span').length,
  } : null
})
if (!previewTitleLine || !previewTitleLine.sizeText || previewTitleLine.baselineGap > 2 || previewTitleLine.spanCount !== 1) {
  throw new Error(`Preview title should show filename and original size on one line: ${JSON.stringify(previewTitleLine)}`)
}
const initialComparisonGeometry = await comparisonPage.locator('.comparison-image-stage').evaluateAll((stages) => stages.map((stage) => {
  const image = stage.querySelector('img')
  if (!(image instanceof HTMLImageElement)) return null
  const stageBox = stage.getBoundingClientRect()
  const imageBox = image.getBoundingClientRect()
  return {
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    renderedWidth: imageBox.width,
    renderedHeight: imageBox.height,
    horizontalCenterGap: (imageBox.left + imageBox.width / 2) - (stageBox.left + stageBox.width / 2),
    verticalCenterGap: (imageBox.top + imageBox.height / 2) - (stageBox.top + stageBox.height / 2),
  }
}))
if (initialComparisonGeometry.some((image) => !image
  || Math.abs(image.renderedWidth - image.naturalWidth) > 1
  || Math.abs(image.renderedHeight - image.naturalHeight) > 1
  || Math.abs(image.horizontalCenterGap) > 1
  || Math.abs(image.verticalCenterGap) > 1)) {
  throw new Error(`All quality previews should open at 100% centered on the file: ${JSON.stringify(initialComparisonGeometry)}`)
}
const comparisonKinds = await comparisonPage.locator('.comparison-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-comparison-kind')))
if (comparisonKinds.join('|') !== 'original|extreme|balanced') throw new Error(`Comparison order should be original, extreme and balanced: ${comparisonKinds.join(' | ')}`)
if ((await comparisonPage.locator('.comparison-card > header button').count()) !== 2) throw new Error('The two compressed comparison downloads are missing')
const originalComparisonHeader = await comparisonPage.locator('.comparison-card.is-original > header').evaluate((header) => {
  const label = header.querySelector('.is-original-label')
  return {
    label: label?.textContent?.trim() ?? '',
    color: label ? getComputedStyle(label).color : '',
    mutedColor: getComputedStyle(document.querySelector('.preview-source-size')).color,
    buttonCount: header.querySelectorAll('button').length,
    iconCount: header.querySelectorAll('.comparison-download-icon').length,
  }
})
if (originalComparisonHeader.label !== '原始文件' || originalComparisonHeader.color !== originalComparisonHeader.mutedColor || originalComparisonHeader.buttonCount !== 0 || originalComparisonHeader.iconCount !== 0) {
  throw new Error(`Original comparison should be a gray, non-downloadable reference: ${JSON.stringify(originalComparisonHeader)}`)
}
const checkerboardBackground = await comparisonPage.locator('.comparison-image-stage').evaluateAll((stages) => stages.map((stage) => ({
  image: getComputedStyle(stage).backgroundImage,
  size: getComputedStyle(stage).backgroundSize,
})))
if (checkerboardBackground.length !== 3 || checkerboardBackground.some((background) => background.image === 'none' || background.size !== '16px 16px, 16px 16px')) {
  throw new Error(`Image previews should use the gray-white transparency grid: ${JSON.stringify(checkerboardBackground)}`)
}
await comparisonPage.locator('.topbar-actions > .icon-button').click()
await comparisonPage.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
const darkCheckerboard = await comparisonPage.locator('.comparison-image-stage').first().evaluate((stage) => {
  const style = getComputedStyle(stage)
  return { color: style.backgroundColor, image: style.backgroundImage }
})
if (darkCheckerboard.color !== 'rgb(34, 38, 45)' || !darkCheckerboard.image.includes('rgb(54, 60, 70)')) {
  throw new Error(`Dark mode should use a subdued transparency grid: ${JSON.stringify(darkCheckerboard)}`)
}
await comparisonPage.locator('.topbar-actions > .icon-button').click()
await comparisonPage.waitForFunction(() => document.documentElement.dataset.theme === 'light')
const previewHeaderLayout = await comparisonPage.locator('.result-preview > header').evaluate((header) => {
  const toolbar = header.querySelector('.comparison-toolbar')?.getBoundingClientRect()
  const close = header.querySelector('.preview-close')?.getBoundingClientRect()
  const closeGlyph = header.querySelector('.preview-close svg > *')
  const headerBox = header.getBoundingClientRect()
  return toolbar && close && closeGlyph ? {
    toolbarBeforeClose: toolbar.right <= close.left,
    actionGap: close.left - toolbar.right,
    closeGlyphOffset: new DOMMatrixReadOnly(getComputedStyle(closeGlyph).transform).m41,
    closeInsideHeader: close.top >= headerBox.top && close.right <= headerBox.right && close.bottom <= headerBox.bottom,
    hintCount: header.querySelectorAll('.comparison-toolbar > span').length,
  } : null
})
if (
  !previewHeaderLayout
  || !previewHeaderLayout.toolbarBeforeClose
  || previewHeaderLayout.actionGap < 10
  || previewHeaderLayout.closeGlyphOffset > -0.5
  || previewHeaderLayout.closeGlyphOffset < -1.5
  || !previewHeaderLayout.closeInsideHeader
  || previewHeaderLayout.hintCount !== 0
) {
  throw new Error(`Zoom controls and close action should share the title bar without helper copy: ${JSON.stringify(previewHeaderLayout)}`)
}
if (await comparisonPage.locator('.preview-height-actions').count()) {
  throw new Error('The resize grip should not have side actions')
}
const zoomChromeAtRest = await comparisonPage.locator('.comparison-toolbar > button, .comparison-toolbar .custom-select-trigger').evaluateAll((controls) => controls.map((control) => ({
  border: getComputedStyle(control).borderTopColor,
  background: getComputedStyle(control).backgroundColor,
})))
if (zoomChromeAtRest.some((control) => control.border !== 'rgba(0, 0, 0, 0)' || control.background !== 'rgba(0, 0, 0, 0)')) {
  throw new Error(`Zoom controls should have no resting chrome: ${JSON.stringify(zoomChromeAtRest)}`)
}
const zoomOutControl = comparisonPage.locator('.comparison-toolbar > button').first()
await zoomOutControl.hover()
await comparisonPage.waitForTimeout(180)
const zoomOutHoverChrome = await zoomOutControl.evaluate((control) => ({
  border: getComputedStyle(control).borderTopColor,
  background: getComputedStyle(control).backgroundColor,
}))
if (zoomOutHoverChrome.border === 'rgba(0, 0, 0, 0)' || zoomOutHoverChrome.background === 'rgba(0, 0, 0, 0)') {
  throw new Error(`Zoom button chrome should appear on hover: ${JSON.stringify(zoomOutHoverChrome)}`)
}
const zoomTrigger = comparisonPage.locator('.comparison-toolbar .custom-select-trigger')
await zoomTrigger.hover()
await comparisonPage.waitForTimeout(180)
const zoomTriggerHoverChrome = await zoomTrigger.evaluate((control) => ({
  border: getComputedStyle(control).borderTopColor,
  background: getComputedStyle(control).backgroundColor,
}))
if (zoomTriggerHoverChrome.border === 'rgba(0, 0, 0, 0)' || zoomTriggerHoverChrome.background === 'rgba(0, 0, 0, 0)') {
  throw new Error(`Zoom selector chrome should appear on hover: ${JSON.stringify(zoomTriggerHoverChrome)}`)
}
const comparisonButtons = await comparisonPage.locator('.comparison-card:not(.is-original) > header').evaluateAll((headers) => headers.map((header) => {
  const buttonElement = header.querySelector('.comparison-download-row')
  const button = buttonElement?.getBoundingClientRect()
  const size = header.querySelector('.comparison-size')
  const ratio = header.querySelector('.comparison-ratio')
  const icon = header.querySelector('.comparison-download-icon')
  const sizeBox = size?.getBoundingClientRect()
  const ratioBox = ratio?.getBoundingClientRect()
  const headerBox = header.getBoundingClientRect()
  const sizeCenter = (sizeBox.top + sizeBox.bottom) / 2
  const ratioCenter = (ratioBox.top + ratioBox.bottom) / 2
  const headerCenter = (headerBox.top + headerBox.bottom) / 2
  return buttonElement && button && size && ratio && icon && sizeBox && ratioBox ? {
    width: button.width,
    height: button.height,
    fillsHeader: Math.abs(button.width - headerBox.width) <= 1 && Math.abs(button.height - headerBox.height) <= 1,
    sizeCenterGap: Math.abs(sizeCenter - headerCenter),
    ratioOffset: ratioCenter - sizeCenter,
    compressedOnly: !size.textContent?.includes('→'),
    ratioAfterSize: ratioBox.left >= sizeBox.right,
    sizeFont: parseFloat(getComputedStyle(size).fontSize),
    ratioFont: parseFloat(getComputedStyle(ratio).fontSize),
    qualityCount: header.querySelectorAll('.comparison-quality').length,
    iconOpacity: getComputedStyle(icon).opacity,
    background: getComputedStyle(buttonElement).backgroundColor,
  } : null
}))
if (comparisonButtons.length !== 2 || comparisonButtons.some((button) => !button || button.height > 35 || !button.fillsHeader || button.sizeCenterGap > 1 || Math.abs(button.ratioOffset - 1) > 0.6 || !button.compressedOnly || !button.ratioAfterSize || Math.abs(button.sizeFont - button.ratioFont) > 0.5 || button.qualityCount !== 0 || button.iconOpacity !== '0' || button.background !== 'rgba(0, 0, 0, 0)')) {
  throw new Error(`Comparison download rows should be compact, label-free and fully clickable: ${JSON.stringify(comparisonButtons)}`)
}
const firstComparisonDownloadRow = comparisonPage.locator('.comparison-card:not(.is-original) .comparison-download-row').first()
await firstComparisonDownloadRow.hover()
await comparisonPage.waitForTimeout(180)
if (Number(await firstComparisonDownloadRow.locator('.comparison-download-icon').evaluate((icon) => getComputedStyle(icon).opacity)) < 0.9) throw new Error('Comparison download icon should appear on hover')
const cardDownloadEvent = comparisonPage.waitForEvent('download')
await firstComparisonDownloadRow.click()
const cardDownload = await cardDownloadEvent
if (cardDownload.suggestedFilename() !== 'compreesor-fixture-极限-压缩.png') throw new Error(`The full comparison info row should download its file: ${cardDownload.suggestedFilename()}`)
await comparisonPage.screenshot({ path: '/tmp/compreesor-pinned-comparison.png', fullPage: false })
const wheelStageBox = await comparisonPage.locator('.comparison-image-stage').first().boundingBox()
const wheelImageBefore = await comparisonPage.locator('.comparison-image-stage img').first().boundingBox()
if (!wheelStageBox || !wheelImageBefore) throw new Error('Comparison wheel-zoom target is missing')
const wheelAnchor = { x: wheelStageBox.x + wheelStageBox.width * 0.72, y: wheelStageBox.y + wheelStageBox.height * 0.34 }
const relativeAnchorBefore = {
  x: (wheelAnchor.x - wheelImageBefore.x) / wheelImageBefore.width,
  y: (wheelAnchor.y - wheelImageBefore.y) / wheelImageBefore.height,
}
await comparisonPage.mouse.move(wheelAnchor.x, wheelAnchor.y)
await comparisonPage.mouse.wheel(0, -120)
await comparisonPage.waitForTimeout(160)
const wheelImageAfter = await comparisonPage.locator('.comparison-image-stage img').first().boundingBox()
if (!wheelImageAfter) throw new Error('Comparison image disappeared after wheel zoom')
const relativeAnchorAfter = {
  x: (wheelAnchor.x - wheelImageAfter.x) / wheelImageAfter.width,
  y: (wheelAnchor.y - wheelImageAfter.y) / wheelImageAfter.height,
}
if (
  Math.abs(wheelImageAfter.width / wheelImageBefore.width - 1.25) > 0.01
  || Math.abs(relativeAnchorAfter.x - relativeAnchorBefore.x) > 0.002
  || Math.abs(relativeAnchorAfter.y - relativeAnchorBefore.y) > 0.002
) {
  throw new Error(`Wheel zoom should keep the pointer anchored to the same file position: ${JSON.stringify({ relativeAnchorBefore, relativeAnchorAfter, wheelImageBefore, wheelImageAfter })}`)
}
await comparisonPage.locator('.comparison-toolbar select').selectOption('1')
await comparisonPage.locator('.comparison-toolbar button').first().click()
const zoomedOutTransforms = await comparisonPage.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => image.getAttribute('style')))
if (zoomedOutTransforms.some((transform) => !transform?.includes('scale(0.75)'))) {
  throw new Error(`Comparison zoom-out should work below the 100% default: ${JSON.stringify(zoomedOutTransforms)}`)
}
const zoomSelect = comparisonPage.locator('.comparison-toolbar select')
const zoomOptions = await zoomSelect.locator('option').allInnerTexts()
if (zoomOptions[0] !== '全部显示' || !zoomOptions.includes('200%')) throw new Error(`Show-all should be the first zoom option: ${zoomOptions.join(' | ')}`)
await zoomSelect.selectOption('2')
const doubledTransforms = await comparisonPage.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => image.getAttribute('style')))
if (doubledTransforms.some((transform) => !transform?.includes('scale(2)'))) throw new Error(`200% zoom should apply to all previews: ${JSON.stringify(doubledTransforms)}`)
await zoomSelect.selectOption('fit')
if ((await comparisonPage.locator('.comparison-image-stage.is-fit').count()) !== 3) throw new Error('Show-all mode should apply to all three previews')
await zoomSelect.selectOption('1')
await comparisonRow.focus()
await comparisonPage.keyboard.press('=')
const keyboardZoomIn = await comparisonPage.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => image.getAttribute('style')))
if (keyboardZoomIn.some((transform) => !transform?.includes('scale(1.25)'))) throw new Error(`= should zoom all previews in: ${JSON.stringify(keyboardZoomIn)}`)
await comparisonPage.keyboard.press('-')
const keyboardZoomOut = await comparisonPage.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => image.getAttribute('style')))
if (keyboardZoomOut.some((transform) => !transform?.includes('scale(1)'))) throw new Error(`- should zoom all previews out: ${JSON.stringify(keyboardZoomOut)}`)
await comparisonPage.locator('.comparison-toolbar button').last().click()
const comparisonTransforms = await comparisonPage.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => image.getAttribute('style')))
if (comparisonTransforms.length !== 3 || comparisonTransforms.some((transform) => !transform?.includes('scale(1.25)'))) {
  throw new Error(`Comparison zoom should apply to all quality previews: ${JSON.stringify(comparisonTransforms)}`)
}
const firstComparisonStage = await comparisonPage.locator('.comparison-image-stage').first().boundingBox()
if (!firstComparisonStage) throw new Error('Comparison drag stage is missing')
await comparisonPage.mouse.move(firstComparisonStage.x + 80, firstComparisonStage.y + 80)
await comparisonPage.mouse.down()
await comparisonPage.mouse.move(firstComparisonStage.x + 112, firstComparisonStage.y + 104)
await comparisonPage.mouse.up()
await comparisonPage.waitForTimeout(120)
const movedComparisonTransforms = await comparisonPage.locator('.comparison-image-stage img').evaluateAll((images) => images.map((image) => image.getAttribute('style')))
if (new Set(movedComparisonTransforms).size !== 1 || movedComparisonTransforms[0] === comparisonTransforms[0]) {
  throw new Error(`Dragging one quality should move all preview views in sync: ${JSON.stringify(movedComparisonTransforms)}`)
}
await comparisonPage.waitForFunction(() => document.querySelector('.result-preview')?.getAnimations().every(
  (animation) => animation.playState === 'finished',
))
const previewBeforeResize = await comparisonPage.locator('.result-preview').boundingBox()
const resizeHandle = await comparisonPage.locator('.preview-resize-handle').boundingBox()
if (!previewBeforeResize || !resizeHandle) throw new Error('Preview resize handle is missing')
const restingGrip = await comparisonPage.locator('.preview-resize-handle').evaluate((handle) => ({
  color: getComputedStyle(handle, '::after').backgroundColor,
  opacity: getComputedStyle(handle, '::after').opacity,
  gap: -(parseFloat(getComputedStyle(handle).top) + parseFloat(getComputedStyle(handle, '::after').top) + parseFloat(getComputedStyle(handle, '::after').height)),
}))
await comparisonPage.mouse.move(resizeHandle.x + resizeHandle.width / 2, resizeHandle.y + resizeHandle.height / 2)
await comparisonPage.waitForFunction(() => document.querySelector('.result-preview')?.classList.contains('is-resize-active'))
await comparisonPage.waitForTimeout(180)
const activeGrip = await comparisonPage.locator('.preview-resize-handle').evaluate((handle) => ({
  color: getComputedStyle(handle, '::after').backgroundColor,
  opacity: getComputedStyle(handle, '::after').opacity,
}))
if (restingGrip.opacity === '0' || restingGrip.color === activeGrip.color || activeGrip.opacity === '0' || restingGrip.gap !== 8) {
  throw new Error(`Resize grip should stay gray and turn blue when activated: ${JSON.stringify({ restingGrip, activeGrip })}`)
}
const headerResizeTarget = await comparisonPage.locator('.result-preview > header').evaluate((header) => {
  const title = header.querySelector('.preview-title')?.getBoundingClientRect()
  const actions = header.querySelector('.preview-header-actions')?.getBoundingClientRect()
  const box = header.getBoundingClientRect()
  if (!title || !actions || actions.left - title.right < 20) return null
  return { x: (title.right + actions.left) / 2, y: (box.top + box.bottom) / 2 }
})
if (!headerResizeTarget) throw new Error('Preview title bar has no blank resize area')
await comparisonPage.mouse.move(headerResizeTarget.x, headerResizeTarget.y)
await comparisonPage.mouse.down()
await comparisonPage.mouse.move(headerResizeTarget.x, headerResizeTarget.y - 80, { steps: 5 })
const draggingTransition = await comparisonPage.locator('.result-preview').evaluate((preview) => ({
  resizing: preview.classList.contains('is-resizing'),
  duration: getComputedStyle(preview).transitionDuration,
}))
if (!draggingTransition.resizing || draggingTransition.duration !== '0s') {
  throw new Error(`Manual resizing should track the pointer without easing: ${JSON.stringify(draggingTransition)}`)
}
await comparisonPage.mouse.up()
const previewAfterResize = await comparisonPage.locator('.result-preview').boundingBox()
if (!previewAfterResize || previewAfterResize.height < previewBeforeResize.height + 60) {
  throw new Error(`Dragging blank title-bar space should increase preview height: ${JSON.stringify({ previewBeforeResize, previewAfterResize })}`)
}
const heightTransition = await comparisonPage.locator('.result-preview').evaluate((preview) => ({
  property: getComputedStyle(preview).transitionProperty,
  duration: getComputedStyle(preview).transitionDuration,
}))
if (!heightTransition.property.includes('height') || heightTransition.duration === '0s') {
  throw new Error(`Height presets should animate smoothly: ${JSON.stringify(heightTransition)}`)
}
let toggleHandle = await comparisonPage.locator('.preview-resize-handle').boundingBox()
if (!toggleHandle) throw new Error('Resize grip disappeared before maximizing')
await comparisonPage.mouse.dblclick(toggleHandle.x + toggleHandle.width / 2, toggleHandle.y + toggleHandle.height / 2)
await comparisonPage.waitForFunction(() => Math.abs(document.querySelector('.result-preview').getBoundingClientRect().height - (window.innerHeight - 48)) <= 2)
const maximizedPreview = await comparisonPage.locator('.result-preview').boundingBox()
if (!maximizedPreview || Math.abs(maximizedPreview.height - (1050 - 48)) > 2) {
  throw new Error(`Double-clicking the grip should maximize the preview: ${JSON.stringify(maximizedPreview)}`)
}
toggleHandle = await comparisonPage.locator('.preview-resize-handle').boundingBox()
if (!toggleHandle) throw new Error('Resize grip disappeared before restoring height')
await comparisonPage.mouse.dblclick(toggleHandle.x + toggleHandle.width / 2, toggleHandle.y + toggleHandle.height / 2)
await comparisonPage.waitForFunction((target) => Math.abs(document.querySelector('.result-preview').getBoundingClientRect().height - target) <= 2, previewAfterResize.height)
const restoredPreview = await comparisonPage.locator('.result-preview').boundingBox()
if (!restoredPreview || Math.abs(restoredPreview.height - previewAfterResize.height) > 2) {
  throw new Error(`A second grip double-click should restore the previous height: ${JSON.stringify({ previewAfterResize, restoredPreview })}`)
}
await comparisonPage.setViewportSize({ width: 1440, height: 760 })
const manualHeightOverride = await comparisonPage.locator('.result-preview').evaluate((preview) => {
  const selected = document.querySelector('.job-row.is-selected')
  if (!(selected instanceof HTMLElement)) return null
  const previewBox = preview.getBoundingClientRect()
  const selectedBox = selected.getBoundingClientRect()
  return { height: previewBox.height, overlap: selectedBox.bottom - previewBox.top }
})
if (!manualHeightOverride || Math.abs(manualHeightOverride.height - previewAfterResize.height) > 2 || manualHeightOverride.overlap <= 0) {
  throw new Error(`Manual preview height should override the selected-file limit: ${JSON.stringify({ previewAfterResize, manualHeightOverride })}`)
}
await comparisonPage.setViewportSize({ width: 1440, height: 1050 })
const keyboardDownloadEvent = comparisonPage.waitForEvent('download')
await comparisonPage.keyboard.press('Enter')
const keyboardDownload = await keyboardDownloadEvent
if (keyboardDownload.suggestedFilename() !== 'compreesor-fixture-够用-压缩.png') {
  throw new Error(`Enter should download the selected file: ${keyboardDownload.suggestedFilename()}`)
}
await comparisonPage.keyboard.press('Escape')
await comparisonPage.waitForFunction(() => !document.querySelector('.result-preview'))
const directBalancedEvent = comparisonPage.waitForEvent('download')
await comparisonPage.getByRole('button', { name: new RegExp(`^下载 · 够用 · 省${expectedPackageSavings.balanced}%$`) }).click()
const directBalanced = await directBalancedEvent
if (directBalanced.suggestedFilename() !== 'compreesor-fixture-够用-压缩.png') {
  throw new Error(`A single completed file should download directly: ${directBalanced.suggestedFilename()}`)
}
await comparisonPage.locator('.file-picker-input').setInputFiles('tests/fixture.svg')
await comparisonPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 2,
  undefined,
  { timeout: 180_000 },
)
if (await comparisonPage.locator('.job-row.status-error').count()) throw new Error('Second sorting fixture failed')
const aggregatePackageSavings = await comparisonPage.locator('.job-row.has-variants').evaluateAll((rows) => {
  const totals = { original: 0, extreme: 0, balanced: 0 }
  rows.forEach((row) => {
    totals.original += Number(row.getAttribute('data-original-bytes'))
    row.querySelectorAll('.variant-result-item').forEach((item) => {
      const preset = item.getAttribute('data-preset')
      if (preset === 'extreme' || preset === 'balanced') totals[preset] += Number(item.getAttribute('data-output-bytes'))
    })
  })
  return {
    extreme: Math.max(0, Math.round((1 - totals.extreme / totals.original) * 100)),
    balanced: Math.max(0, Math.round((1 - totals.balanced / totals.original) * 100)),
  }
})
const balancedZipEvent = comparisonPage.waitForEvent('download')
await comparisonPage.getByRole('button', { name: new RegExp(`^打包下载 · 够用 · 省${aggregatePackageSavings.balanced}%$`) }).click()
const balancedArchive = await balancedZipEvent
const balancedArchivePath = await balancedArchive.path()
if (!balancedArchivePath) throw new Error('Default balanced ZIP download path is unavailable')
const balancedArchiveEntries = Object.keys(unzipSync(await readFile(balancedArchivePath))).filter((name) => !name.endsWith('/'))
if (balancedArchiveEntries.length !== 2 || balancedArchiveEntries.some((name) => !name.startsWith('够用/'))) {
  throw new Error(`Default parallel-quality ZIP should contain only the balanced folder: ${JSON.stringify(balancedArchiveEntries)}`)
}
await comparisonPage.getByRole('button', { name: '再次下载' }).waitFor({ timeout: 8_000 })
const packageMenuToggle = comparisonPage.getByRole('button', { name: '选择打包档位' })
await packageMenuToggle.click()
const packageMenuLabels = await comparisonPage.getByRole('menuitem').allInnerTexts()
if (packageMenuLabels.join('|') !== `只打包极限 · 省${aggregatePackageSavings.extreme}%|全部下载`) {
  throw new Error(`ZIP quality choices are incomplete: ${packageMenuLabels.join(' | ')}`)
}
const extremeZipEvent = comparisonPage.waitForEvent('download')
await comparisonPage.getByRole('menuitem', { name: `只打包极限 · 省${aggregatePackageSavings.extreme}%` }).click()
const extremeArchive = await extremeZipEvent
const extremeArchivePath = await extremeArchive.path()
if (!extremeArchivePath) throw new Error('Extreme-only ZIP download path is unavailable')
const extremeArchiveEntries = Object.keys(unzipSync(await readFile(extremeArchivePath))).filter((name) => !name.endsWith('/'))
if (extremeArchiveEntries.length !== 2 || extremeArchiveEntries.some((name) => !name.startsWith('极限/'))) {
  throw new Error(`Extreme-only ZIP should contain only the extreme folder: ${JSON.stringify(extremeArchiveEntries)}`)
}
await comparisonPage.getByRole('button', { name: '再次下载' }).waitFor({ timeout: 8_000 })
await packageMenuToggle.click()
const comparisonZipEvent = comparisonPage.waitForEvent('download')
await comparisonPage.getByRole('menuitem', { name: '全部下载', exact: true }).click()
const comparisonArchive = await comparisonZipEvent
const comparisonArchivePath = await comparisonArchive.path()
if (!comparisonArchivePath) throw new Error('Parallel-quality ZIP download path is unavailable')
const comparisonArchiveEntries = Object.keys(unzipSync(await readFile(comparisonArchivePath))).filter((name) => !name.endsWith('/'))
const comparisonQualityFolderCounts = Object.fromEntries(['极限', '够用'].map((folder) => [
  folder,
  comparisonArchiveEntries.filter((name) => name.startsWith(`${folder}/`)).length,
]))
if (comparisonArchiveEntries.length !== 4 || Object.values(comparisonQualityFolderCounts).some((count) => count !== 2) || comparisonArchiveEntries.some((name) => name.startsWith('无损/'))) {
  throw new Error(`Parallel-quality ZIP should contain only extreme and balanced folders: ${JSON.stringify({ comparisonArchiveEntries, comparisonQualityFolderCounts })}`)
}
const sortedExtremeBytes = async () => comparisonPage.locator('.job-row .variant-result-item:first-child').evaluateAll(
  (items) => items.map((item) => Number(item.getAttribute('data-output-bytes'))),
)
const sortedExtremeRatios = async () => comparisonPage.locator('.job-row .variant-result-item:first-child').evaluateAll(
  (items) => items.map((item) => Number(item.getAttribute('data-compressed-ratio'))),
)
const descendingExtremeRatios = await sortedExtremeRatios()
if (descendingExtremeRatios.some((ratio, index) => index > 0 && descendingExtremeRatios[index - 1] < ratio)) {
  throw new Error(`Fourth quality-header state should sort compressed ratio descending: ${descendingExtremeRatios.join(', ')}`)
}
await comparisonPage.getByRole('button', { name: /按极限结果排序/ }).click()
const ascendingExtremeBytes = await sortedExtremeBytes()
if (ascendingExtremeBytes.some((bytes, index) => index > 0 && ascendingExtremeBytes[index - 1] > bytes)) {
  throw new Error(`Quality-header cycle should return to size ascending: ${ascendingExtremeBytes.join(', ')}`)
}
await fileNameHeader.click()
const ascendingFileNames = await comparisonPage.locator('.job-row .job-copy strong').allInnerTexts()
if (ascendingFileNames.join('|') !== 'compreesor-fixture.png|fixture.svg') throw new Error(`File-name header should sort first characters ascending: ${ascendingFileNames.join(' | ')}`)
await fileNameHeader.click()
const descendingFileNames = await comparisonPage.locator('.job-row .job-copy strong').allInnerTexts()
if (descendingFileNames.join('|') !== 'fixture.svg|compreesor-fixture.png') throw new Error(`File-name header should sort first characters descending: ${descendingFileNames.join(' | ')}`)
await comparisonPage.screenshot({ path: '/tmp/compreesor-quality-table.png', fullPage: false })
await comparisonPage.close()

const singleDownload = page.waitForEvent('download')
await singleDownloadButton.click()
const single = await singleDownload
if (single.suggestedFilename() !== 'compreesor-fixture-压缩.png') {
  throw new Error(`Single download should use Chinese compression suffix: ${single.suggestedFilename()}`)
}

await page.locator('.job-row.status-done').first().click()
await page.locator('.result-preview.is-pinned').waitFor()

await page.evaluate(() => {
  const footer = document.querySelector('.site-footer')
  if (footer instanceof HTMLElement) {
    footer.style.position = 'relative'
    footer.style.top = '1200px'
  }
  Math.random = () => 0
  window.scrollTo(0, 0)
})

const zipDownload = page.waitForEvent('download')
await packageButton.click()
await page.locator('.result-preview.is-exiting').waitFor()
if (await page.locator('.donate-popover').count()) throw new Error('Donation popover should wait until the preview exit finishes')
await page.locator('.result-preview').waitFor({ state: 'detached' })
const archive = await zipDownload
const downloadedPackageButton = page.getByRole('button', { name: '已下载' })
await downloadedPackageButton.waitFor()
if (!(await downloadedPackageButton.isDisabled())) throw new Error('Downloaded ZIP state should pause repeat clicks')
await page.waitForFunction(() => getComputedStyle(document.querySelector('.download-all.is-downloaded')).backgroundColor === 'rgb(21, 128, 61)')
const downloadedPackageStyle = await downloadedPackageButton.evaluate((element) => {
  const style = getComputedStyle(element)
  return { backgroundColor: style.backgroundColor, opacity: style.opacity, animationName: style.animationName }
})
if (!downloadedPackageStyle.backgroundColor.includes('21, 128, 61') || downloadedPackageStyle.opacity !== '1' || !downloadedPackageStyle.animationName.includes('package-button-down-spring')) {
  throw new Error(`Downloaded ZIP state is unclear: ${JSON.stringify(downloadedPackageStyle)}`)
}
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
const archivePath = await archive.path()
if (!archivePath) throw new Error('ZIP download path is unavailable')
const archiveEntries = Object.keys(unzipSync(await readFile(archivePath))).filter((name) => !name.endsWith('/'))
if (archiveEntries.length !== 3 || archiveEntries.some((name) => !name.startsWith('够用/'))) {
  throw new Error(`Single-quality ZIP files should stay in the selected quality folder: ${JSON.stringify(archiveEntries)}`)
}
await page.getByRole('button', { name: '再次下载' }).waitFor({ timeout: 7_000 })
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
  const footer = document.querySelector('.site-footer')
  if (footer instanceof HTMLElement) {
    footer.style.position = ''
    footer.style.top = ''
  }
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
await mobile.locator('.preferences').waitFor()
await mobile.locator('.preferences select').nth(0).selectOption('balanced')
const bodyWidth = await mobile.evaluate(() => document.body.scrollWidth)
if (bodyWidth > 390) throw new Error(`Mobile layout overflows: ${bodyWidth}px`)
await mobile.screenshot({ path: '/tmp/compreesor-mobile.png', fullPage: true })

await mobile.locator('.file-picker-input').setInputFiles('/tmp/compreesor-fixture.png')
await mobile.waitForFunction(() => document.querySelectorAll('.job-row.status-done').length === 1, undefined, { timeout: 180_000 })
const mobileListWidth = await mobile.evaluate(() => document.body.scrollWidth)
if (mobileListWidth > 390) throw new Error(`Mobile list layout overflows: ${mobileListWidth}px`)
if (await mobile.locator('.job-progress').first().evaluate((element) => getComputedStyle(element).display) !== 'none') {
  throw new Error('Progress bar should hide when mobile space is limited')
}
await mobile.locator('.preview-close').click()
await mobile.waitForFunction(() => !document.querySelector('.result-preview'))
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
await mobile.locator('.preference-compression').waitFor()
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
await guidePage.getByRole('button', { name: 'CLI 命令行和客户端' }).click()
await guidePage.getByRole('dialog', { name: 'CLI 命令行与客户端' }).waitFor()
const desktopDownload = guidePage.getByRole('link', { name: '下载 DMG' })
if (await desktopDownload.getAttribute('href') !== 'https://github.com/yanghaoleng/compreesor/releases/download/v1.2.1/Compreesor-1.2.1-arm64.dmg') {
  throw new Error('Electron client download should point to the current signed release package')
}
await guidePage.getByRole('button', { name: '复制安装命令' }).click()
await guidePage.getByText('已复制安装命令', { exact: true }).waitFor()
const toastSpacing = await guidePage.locator('.app-toast').evaluate((toast) => {
  const box = toast.getBoundingClientRect()
  const style = getComputedStyle(toast)
  return {
    top: box.top,
    paddingTop: parseFloat(style.paddingTop),
    paddingBottom: parseFloat(style.paddingBottom),
  }
})
if (toastSpacing.top > 13 || toastSpacing.paddingBottom <= toastSpacing.paddingTop) {
  throw new Error(`Toast should sit slightly higher with extra bottom breathing room: ${JSON.stringify(toastSpacing)}`)
}
if (!(await guidePage.getByRole('dialog').innerText()).includes('--preset extreme')) throw new Error('CLI preset instructions are missing')

const dropPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await dropPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await dropPage.locator('.preferences select').nth(0).selectOption('balanced')
await dropPage.locator('.file-picker-input').setInputFiles('/tmp/compreesor-fixture.png')
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
await audioPage.locator('.preferences select').nth(0).selectOption('balanced')
if (!(await audioPage.locator('.preferences select').nth(2).locator('option[value="mp3"]').innerText()).includes('提取 MP3')) {
  throw new Error('MP3 option label is incorrect')
}
await audioPage.locator('.preferences select').nth(2).selectOption('mp3')
if (await audioPage.locator('.alpha-switch').count()) throw new Error('Alpha switch should be removed')
await audioPage.locator('.file-picker-input').setInputFiles('/tmp/compreesor-video.mp4')
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
await audioPage.locator('.job-row').first().click()
await audioPage.locator('.result-preview audio').waitFor()
await audioPage.locator('.preview-close').click()
const audioDownload = audioPage.waitForEvent('download')
await audioPage.locator('.job-action button').first().click()
const extractedAudio = await audioDownload
if (extractedAudio.suggestedFilename() !== 'compreesor-video-压缩.mp3') {
  throw new Error(`MP3 download should use Chinese compression suffix: ${extractedAudio.suggestedFilename()}`)
}

const alphaPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await alphaPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await alphaPage.locator('.preferences select').nth(0).selectOption('balanced')
await alphaPage.locator('.preferences select').nth(2).selectOption('mov-alpha')
await alphaPage.locator('.file-picker-input').setInputFiles('/tmp/compreesor-alpha.mov')
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
await alphaPage.locator('.job-action button').first().click()
const alphaVideo = await alphaDownload
if (alphaVideo.suggestedFilename() !== 'compreesor-alpha-压缩.mov') {
  throw new Error(`MOV download should use Chinese compression suffix: ${alphaVideo.suggestedFilename()}`)
}

const jpegPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await jpegPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await jpegPage.locator('.preferences select').nth(0).selectOption('extreme')
await jpegPage.locator('.preferences select').nth(1).selectOption('jpeg')
await jpegPage.locator('.file-picker-input').setInputFiles('/tmp/compreesor-fixture.png')
await jpegPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await jpegPage.locator('.job-row.status-error').count()) {
  throw new Error(`JPG conversion failed: ${await jpegPage.locator('.job-list').innerText()}`)
}
await jpegPage.locator('.result-preview.is-pinned').waitFor()
const singleQualityComparison = await jpegPage.locator('.comparison-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-comparison-kind')))
if (singleQualityComparison.join('|') !== 'original|extreme') {
  throw new Error(`A single file and single compression result should compare original and output: ${singleQualityComparison.join(' | ')}`)
}
const jpegRow = await jpegPage.locator('.job-row').first().innerText()
if ((await jpegPage.locator('.job-state span[title="JPEG"]').count()) !== 1) throw new Error(`Expected JPEG output, received: ${jpegRow}`)
const jpegDownload = jpegPage.waitForEvent('download')
await jpegPage.locator('.job-action button').first().click()
const jpegImage = await jpegDownload
if (jpegImage.suggestedFilename() !== 'compreesor-fixture-压缩.jpg') {
  throw new Error(`JPG download should use Chinese compression suffix: ${jpegImage.suggestedFilename()}`)
}

const svgPage = await browser.newPage({ viewport: { width: 1100, height: 800 } })
await svgPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await svgPage.locator('.preferences select').nth(0).selectOption('balanced')
await svgPage.locator('.file-picker-input').setInputFiles('tests/fixture.svg')
await svgPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await svgPage.locator('.job-row.status-error').count()) {
  throw new Error(`SVG compression failed: ${await svgPage.locator('.job-list').innerText()}`)
}
if ((await svgPage.locator('.thumbnail img').count()) !== 1) throw new Error('SVG thumbnail is missing')
const svgRatio = svgPage.locator('.job-row .result-ratio')
if (await svgRatio.getAttribute('data-animation') !== 'calligraph-number-in') throw new Error('Calligraph number entrance animation is missing')
const ratioAnimation = await svgRatio.getAttribute('data-animation')
const targetRatio = Number(await svgRatio.getAttribute('data-target-ratio'))
await svgPage.waitForFunction(
  (target) => document.querySelector('.result-ratio')?.textContent?.trim() === `${target}%`,
  targetRatio,
)
const svgDownload = svgPage.waitForEvent('download')
await svgPage.locator('.job-action button').first().click()
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
await svgPngPage.locator('.preferences select').nth(0).selectOption('balanced')
await svgPngPage.locator('.preferences select').nth(1).selectOption('png')
await svgPngPage.locator('.file-picker-input').setInputFiles('tests/fixture.svg')
await svgPngPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await svgPngPage.locator('.job-row.status-error').count()) {
  throw new Error(`SVG to PNG conversion failed: ${await svgPngPage.locator('.job-list').innerText()}`)
}
const svgPngDownload = svgPngPage.waitForEvent('download')
await svgPngPage.locator('.job-action button').first().click()
const svgPng = await svgPngDownload
if (svgPng.suggestedFilename() !== 'fixture-压缩.png') throw new Error('SVG to PNG did not use its Chinese suffix')

const geometryPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await geometryPage.goto(`${baseUrl.split('?')[0]}?lang=zh`, { waitUntil: 'networkidle' })
await geometryPage.locator('.preferences select').nth(1).selectOption('png')
await geometryPage.locator('.file-picker-input').setInputFiles({
  name: 'wide-geometry.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="900" viewBox="0 0 3000 900"><rect width="3000" height="900" fill="#00c853"/><rect width="300" height="900" fill="#f00000"/><rect x="2700" width="300" height="900" fill="#0000f0"/></svg>'),
})
await geometryPage.waitForFunction(
  () => document.querySelectorAll('.job-row.status-done, .job-row.status-error').length === 1,
  undefined,
  { timeout: 180_000 },
)
if (await geometryPage.locator('.job-row.status-error').count()) {
  throw new Error(`Wide geometry fixture failed: ${await geometryPage.locator('.job-list').innerText()}`)
}
await geometryPage.locator('.job-row').first().click()
await geometryPage.waitForFunction(() => Array.from(document.querySelectorAll('.comparison-image-stage img')).every(
  (image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
))
const geometryResults = await geometryPage.locator('.comparison-image-stage img').evaluateAll(async (images) => Promise.all(images.map(async (image) => {
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(image, 0, 0)
  const y = Math.floor(canvas.height / 2)
  const left = Array.from(context.getImageData(Math.floor(canvas.width * 0.05), y, 1, 1).data)
  const right = Array.from(context.getImageData(Math.floor(canvas.width * 0.95), y, 1, 1).data)
  return { width: image.naturalWidth, height: image.naturalHeight, left, right }
})))
const geometryDimensions = geometryResults.map(({ width, height }) => [width, height])
if (JSON.stringify(geometryDimensions) !== JSON.stringify([[3000, 900], [1600, 480], [2560, 768]])) {
  throw new Error(`Quality resizing should only scale the complete image: ${JSON.stringify(geometryDimensions)}`)
}
await geometryPage.waitForFunction(() => document.querySelectorAll('.comparison-dimensions').length === 3)
const dimensionLabels = await geometryPage.locator('.comparison-dimensions').evaluateAll((labels) => labels.map((label) => ({
  text: label.textContent?.replace(/\s+/g, ''),
  color: getComputedStyle(label).color,
  left: label.getBoundingClientRect().left,
  ratioLeft: label.parentElement?.querySelector('.comparison-ratio')?.getBoundingClientRect().left,
})))
if (
  dimensionLabels.map((label) => label.text).join('|') !== '3000×900|1600×480|2560×768'
  || dimensionLabels[0].color === dimensionLabels[1].color
  || dimensionLabels.slice(1).some((label) => label.ratioLeft === undefined || label.left >= label.ratioLeft)
) {
  throw new Error(`Changed dimensions should appear before the ratio with compressed sizes in orange: ${JSON.stringify(dimensionLabels)}`)
}
if (geometryResults.some(({ left, right }) => left[0] < 200 || left[2] > 50 || right[2] < 200 || right[0] > 50)) {
  throw new Error(`Quality resizing cropped or replaced edge content: ${JSON.stringify(geometryResults)}`)
}
await geometryPage.keyboard.press('Escape')
await geometryPage.close()

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
const reducedBrand = await reducedMotionPage.locator('.brand-mark').evaluate((element) => ({
  animationCount: element.getAnimations().length,
  opacity: getComputedStyle(element).opacity,
  transform: getComputedStyle(element).transform,
}))
if (reducedBrand.animationCount !== 0 || reducedBrand.opacity !== '1' || reducedBrand.transform !== 'none') {
  throw new Error(`Reduced-motion brand should be static: ${JSON.stringify(reducedBrand)}`)
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
  geometryDimensions,
  ratioAnimation,
  svgScreenshot: '/tmp/compreesor-svg.png',
  bodyWidth,
  actionOrder: [clearBox.x, zipBox.x],
  desktopScreenshot: '/tmp/compreesor-desktop.png',
  qualityTableScreenshot: '/tmp/compreesor-quality-table.png',
  pinnedComparisonScreenshot: '/tmp/compreesor-pinned-comparison.png',
  pinnedDonateScreenshot: '/tmp/compreesor-donate-pinned.png',
  mobileScreenshot: '/tmp/compreesor-mobile.png',
  mobileListScreenshot: '/tmp/compreesor-mobile-list.png',
  mobileDarkScreenshot: '/tmp/compreesor-mobile-dark.png',
}))
