let mediaModule: Promise<typeof import('./mediaCompressor')> | null = null
let pdfModule: Promise<typeof import('./pdfCompressor')> | null = null

export function loadMediaCompressor() {
  mediaModule ??= import('./mediaCompressor')
  return mediaModule
}

export function loadPdfCompressor() {
  pdfModule ??= import('./pdfCompressor')
  return pdfModule
}

export function disposeLoadedMediaEngine() {
  if (mediaModule) void mediaModule.then(({ disposeMediaEngine }) => disposeMediaEngine())
}
