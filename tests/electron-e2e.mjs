import { _electron as electron } from 'playwright'
import { PDFDocument } from 'pdf-lib'
import { copyFile, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const appDirectory = resolve('apps/desktop')
const executablePath = join(appDirectory, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const directory = await mkdtemp(join(tmpdir(), 'compreesor-electron-e2e-'))
const sourcePath = join(directory, 'desktop.svg')
const pdfPath = join(directory, 'desktop-pages.pdf')
const folderDirectory = join(directory, 'folder-input')
const nestedFolderDirectory = join(folderDirectory, 'nested')
await mkdir(nestedFolderDirectory, { recursive: true })
await copyFile('tests/fixture.svg', sourcePath)
await copyFile('tests/fixture.svg', join(folderDirectory, 'folder-vector.svg'))
await copyFile('docs/assets/robot-paper-icon-source.png', join(nestedFolderDirectory, 'folder-image.png'))
await writeFile(join(folderDirectory, 'ignored.txt'), 'unsupported')
const pdf = await PDFDocument.create()
const icon = await pdf.embedPng(await readFile('docs/assets/robot-paper-icon-source.png'))
for (let index = 0; index < 2; index += 1) {
  const page = pdf.addPage([360, 480])
  page.drawImage(icon, { x: 30, y: 90, width: 300, height: 300 })
}
await writeFile(pdfPath, await pdf.save({ useObjectStreams: false }))

const environment = { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
delete environment.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ executablePath, args: [appDirectory], env: environment })

try {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.evaluate(() => window.localStorage.setItem('compreesor-language', 'zh'))
  await window.reload({ waitUntil: 'domcontentloaded' })
  await window.locator('.preferences').waitFor()
  if ((await window.locator('.brand').innerText()).trim() !== '文件压缩大救星\nCompressor Studio') throw new Error('Electron brand is out of sync')
  if (await window.locator('.preferences select').first().inputValue() !== 'all') throw new Error('Electron should default to all qualities')
  await window.locator('.file-picker-input').setInputFiles(sourcePath)
  await window.locator('.job-row.status-done').waitFor({ timeout: 120_000 })
  const files = await readdir(directory)
  const expected = ['desktop-极限-压缩.svg', 'desktop-够用-压缩.svg']
  for (const name of expected) {
    if (!files.includes(name)) throw new Error(`Electron did not save ${name} beside the source`)
    if ((await stat(join(directory, name))).size === 0) throw new Error(`${name} is empty`)
  }
  if (files.includes('desktop-无损-压缩.svg')) throw new Error('Electron should not create a lossless parallel result')
  if (!files.includes('desktop.svg')) throw new Error('All-quality mode should preserve the source file')
  if ((await window.locator('.variant-result-item').count()) !== 2) throw new Error('Electron result list does not show both parallel qualities')
  if ((await window.locator('.job-name-column-header').innerText()).trim() !== '文件名') throw new Error('Electron file-name table header is missing')
  if ((await window.locator('.variant-column-headers button').allInnerTexts()).join('|') !== '极限|够用') throw new Error('Electron result table header is missing')
  const variantRatios = await window.locator('.variant-result-item .variant-ratio').allInnerTexts()
  if (variantRatios.length !== 2 || variantRatios.some((ratio) => !/^\d+%$/.test(ratio.replace(/\s+/g, '')))) throw new Error(`Electron per-quality ratios are missing: ${variantRatios.join(' | ')}`)
  if ((await window.locator('.job-state').innerText()).trim() !== '') throw new Error('Electron all-quality row should keep only the completion icon at the far right')
  await window.locator('.result-preview.is-pinned').waitFor()
  if (!(await window.locator('.download-all').innerText()).trim().startsWith('下载 · 够用')) throw new Error('Electron single-file action should download directly')
  if (await window.getByRole('button', { name: '选择打包档位' }).count()) throw new Error('Electron single-file action should not show ZIP controls')
  if ((await window.locator('.comparison-card').count()) !== 3) throw new Error('Electron comparison preview is missing')
  if ((await window.locator('.comparison-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-comparison-kind')))).join('|') !== 'original|extreme|balanced') throw new Error('Electron comparison should place the original file first')
  if ((await window.locator('.comparison-toolbar').count()) !== 1) throw new Error('Electron synchronized comparison controls are missing')
  if ((await window.locator('.comparison-toolbar select option').first().innerText()).trim() !== '全部显示') throw new Error('Electron zoom menu should put Show all first')
  await window.locator('.preview-close').click()

  await window.getByRole('button', { name: '清空' }).click()
  await window.locator('.preferences select').first().selectOption('balanced')
  await window.locator('.preferences select').nth(1).selectOption('jpeg')
  await window.locator('.file-picker-input').setInputFiles(pdfPath)
  await window.waitForFunction(() => document.querySelectorAll('.job-row.status-done').length === 2, undefined, { timeout: 120_000 })
  const convertedFiles = await readdir(directory)
  if (!convertedFiles.includes('desktop-pages.pdf')) throw new Error('PDF source should remain after page extraction')
  for (const name of ['desktop-pages-第1页-压缩.jpg', 'desktop-pages-第2页-压缩.jpg']) {
    if (!convertedFiles.includes(name) || (await stat(join(directory, name))).size === 0) throw new Error(`Electron did not save ${name}`)
  }

  await window.getByRole('button', { name: '清空' }).click()
  if (await window.locator('.folder-picker-input').getAttribute('webkitdirectory') !== '') throw new Error('Electron folder picker is missing webkitdirectory')
  await window.locator('.folder-picker-input').setInputFiles(folderDirectory)
  await window.waitForFunction(() => document.querySelectorAll('.job-row.status-done').length === 2, undefined, { timeout: 120_000 })
  const folderNames = await window.locator('.job-copy strong').allInnerTexts()
  if (!folderNames.includes('folder-vector.svg') || !folderNames.includes('folder-image.png')) throw new Error(`Electron folder import is incomplete: ${folderNames.join(' | ')}`)
  if (await window.locator('.job-row.status-error').count()) throw new Error('Electron folder import created an error job')
  console.log('Electron shared UI, synchronized comparison, folder import and PDF page persistence passed')
} finally {
  await app.close()
}
