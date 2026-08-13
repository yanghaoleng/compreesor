const dropzone = document.querySelector('#dropzone')
const picker = document.querySelector('#picker')
const jobs = document.querySelector('#jobs')
const summary = document.querySelector('#summary')
const clear = document.querySelector('#clear')
const format = document.querySelector('#format')
const quality = document.querySelector('#quality')
let total = 0
let complete = 0

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character])
}

function updateSummary() {
  summary.textContent = total === 0 ? '等待添加图片' : `${complete}/${total} 已完成`
}

async function addFiles(fileList) {
  const accepted = Array.from(fileList).filter((file) => /\.(?:jpe?g|png|webp|avif|svg)$/i.test(file.name))
  if (accepted.length === 0) return
  total += accepted.length
  updateSummary()

  const rows = accepted.map((file) => {
    const id = crypto.randomUUID()
    jobs.insertAdjacentHTML('beforeend', `<article id="${id}" class="job"><div><strong>${escapeHtml(file.name)}</strong><span>${(file.size / 1024).toFixed(1)} KB</span></div><em>处理中</em></article>`)
    return { file, id }
  })

  const results = await window.compreesor.compressFiles({
    paths: rows.map(({ file }) => window.compreesor.pathForFile(file)),
    format: format.value,
    quality: Number(quality.value),
  })

  results.forEach((result, index) => {
    const row = document.getElementById(rows[index].id)
    if (!row) return
    if (result.ok) {
      const saved = Math.max(0, Math.round((1 - result.result.outputBytes / result.result.originalBytes) * 100))
      row.classList.add('done')
      row.querySelector('em').textContent = result.result.unchanged ? '已是最小' : `减少 ${saved}%`
      row.querySelector('span').textContent = result.result.outputPath
      complete += 1
    } else {
      row.classList.add('error')
      row.querySelector('em').textContent = '失败'
      row.querySelector('span').textContent = result.error
    }
  })
  updateSummary()
}

dropzone.addEventListener('click', () => picker.click())
dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') picker.click()
})
picker.addEventListener('change', () => {
  addFiles(picker.files)
  picker.value = ''
})
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault()
  dropzone.classList.add('dragging')
})
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'))
dropzone.addEventListener('drop', (event) => {
  event.preventDefault()
  dropzone.classList.remove('dragging')
  addFiles(event.dataTransfer.files)
})
clear.addEventListener('click', () => {
  jobs.replaceChildren()
  total = 0
  complete = 0
  updateSummary()
})
