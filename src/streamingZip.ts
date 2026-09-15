type ZipEntry = {
  name: string
  blob: Blob
}

export async function createStoredZip(
  entries: ZipEntry[],
  onProgress: (completed: number, total: number) => void = () => undefined,
) {
  const { Zip, ZipPassThrough } = await import('fflate')
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let resolveArchive: (blob: Blob) => void = () => undefined
  let rejectArchive: (error: Error) => void = () => undefined
  const completed = new Promise<Blob>((resolve, reject) => {
    resolveArchive = resolve
    rejectArchive = reject
  })
  const archive = new Zip((error, chunk, final) => {
    if (error) {
      rejectArchive(error)
      return
    }
    const copy = new Uint8Array(chunk.byteLength)
    copy.set(chunk)
    chunks.push(copy)
    if (final) resolveArchive(new Blob(chunks, { type: 'application/zip' }))
  })

  try {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      const file = new ZipPassThrough(entry.name)
      archive.add(file)
      const reader = entry.blob.stream().getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        file.push(value)
      }
      file.push(new Uint8Array(0), true)
      onProgress(index + 1, entries.length)
    }
    archive.end()
    return await completed
  } catch (error) {
    archive.terminate()
    throw error
  }
}
