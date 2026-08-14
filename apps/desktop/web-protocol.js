import { sep, resolve } from 'node:path'

export const DESKTOP_SCHEME = 'compreesor'
export const DESKTOP_ORIGIN = `${DESKTOP_SCHEME}://app`

export function resolveWebAssetPath(rootDirectory, requestUrl) {
  const root = resolve(rootDirectory)
  const url = new URL(requestUrl)
  if (url.protocol !== `${DESKTOP_SCHEME}:` || url.hostname !== 'app') {
    throw new Error('无效的桌面资源地址')
  }
  const pathname = decodeURIComponent(url.pathname)
  const candidate = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new Error('桌面资源路径越界')
  }
  return candidate
}
