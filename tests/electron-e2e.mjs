import { _electron as electron } from 'playwright'
import { copyFile, mkdtemp, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const appDirectory = resolve('apps/desktop')
const executablePath = join(appDirectory, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
const directory = await mkdtemp(join(tmpdir(), 'compreesor-electron-e2e-'))
const sourcePath = join(directory, 'desktop.svg')
await copyFile('tests/fixture.svg', sourcePath)

const environment = { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
delete environment.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ executablePath, args: [appDirectory], env: environment })

try {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.getByRole('heading', { name: '输出偏好' }).waitFor()
  if ((await window.locator('.brand').innerText()).trim() !== '文件压缩大救星\nCompreesor') throw new Error('Electron brand is out of sync')
  if (await window.locator('.preferences select').first().inputValue() !== 'all') throw new Error('Electron should default to all qualities')
  await window.locator('input[type="file"]').setInputFiles(sourcePath)
  await window.locator('.job-row.status-done').waitFor({ timeout: 120_000 })
  const files = await readdir(directory)
  const expected = ['desktop-极限-压缩.svg', 'desktop-够用-压缩.svg', 'desktop-无损-压缩.svg']
  for (const name of expected) {
    if (!files.includes(name)) throw new Error(`Electron did not save ${name} beside the source`)
    if ((await stat(join(directory, name))).size === 0) throw new Error(`${name} is empty`)
  }
  if (!files.includes('desktop.svg')) throw new Error('All-quality mode should preserve the source file')
  if ((await window.locator('.variant-size-strip span').count()) !== 3) throw new Error('Electron result list does not show three qualities')
  await window.getByRole('button', { name: '预览 desktop.svg' }).click()
  if ((await window.locator('.comparison-card').count()) !== 3) throw new Error('Electron comparison preview is missing')
  console.log('Electron shared UI and three-result persistence passed')
} finally {
  await app.close()
}
