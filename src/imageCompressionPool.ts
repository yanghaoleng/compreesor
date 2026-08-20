import type { WorkerRequest, WorkerResponse, WorkerResult } from './types'

type ProgressReporter = (variantId: string, progress: number, stage: string) => void

type PoolTask = {
  request: WorkerRequest
  timeoutMs: number
  signal?: AbortSignal
  onProgress: ProgressReporter
  resolve: (results: WorkerResult[]) => void
  reject: (error: Error) => void
  timeoutId: number | null
  abortHandler: (() => void) | null
}

type WorkerSlot = {
  worker: Worker
  queue: PoolTask[]
  active: PoolTask | null
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000

function workerCountForDevice() {
  const cores = Math.max(1, navigator.hardwareConcurrency || 2)
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if ((memory !== undefined && memory <= 4) || cores <= 2) return 1
  if ((memory === undefined || memory >= 8) && cores >= 8) return 3
  return 2
}

function abortError() {
  return new DOMException('压缩已取消', 'AbortError')
}

export class ImageCompressionPool {
  readonly size: number
  private slots: WorkerSlot[] = []
  private disposed = false

  constructor(size = workerCountForDevice()) {
    this.size = Math.max(1, Math.min(3, size))
    for (let index = 0; index < this.size; index += 1) this.slots.push(this.createSlot())
  }

  compress(
    request: WorkerRequest,
    onProgress: ProgressReporter,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ) {
    if (this.disposed) return Promise.reject(new Error('图片压缩引擎已关闭'))
    if (options.signal?.aborted) return Promise.reject(abortError())
    const slot = this.slots.reduce((best, candidate) => {
      const bestLoad = best.queue.length + (best.active ? 1 : 0)
      const candidateLoad = candidate.queue.length + (candidate.active ? 1 : 0)
      return candidateLoad < bestLoad ? candidate : best
    })

    return new Promise<WorkerResult[]>((resolve, reject) => {
      const task: PoolTask = {
        request,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        signal: options.signal,
        onProgress,
        resolve,
        reject,
        timeoutId: null,
        abortHandler: null,
      }
      slot.queue.push(task)
      this.runNext(slot)
    })
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.slots.forEach((slot) => {
      slot.worker.terminate()
      if (slot.active) this.finishTask(slot, new Error('图片压缩引擎已关闭'))
      slot.queue.splice(0).forEach((task) => task.reject(new Error('图片压缩引擎已关闭')))
    })
    this.slots = []
  }

  private createSlot(): WorkerSlot {
    const slot: WorkerSlot = {
      worker: new Worker(new URL('./compressor.worker.ts', import.meta.url), { type: 'module' }),
      queue: [],
      active: null,
    }
    slot.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const task = slot.active
      if (!task || event.data.jobId !== task.request.jobId) return
      if (event.data.type === 'progress') {
        task.onProgress(event.data.variantId, event.data.progress, event.data.stage)
        return
      }
      if (event.data.type === 'error') {
        this.finishTask(slot, new Error(event.data.message))
        return
      }
      this.finishTask(slot, null, event.data.results)
    })
    slot.worker.addEventListener('error', (event) => {
      event.preventDefault()
      this.resetWorker(slot, new Error(event.message || '图片压缩 Worker 异常退出'))
    })
    slot.worker.addEventListener('messageerror', () => {
      this.resetWorker(slot, new Error('图片压缩结果无法传回主线程'))
    })
    return slot
  }

  private runNext(slot: WorkerSlot) {
    if (this.disposed || slot.active || slot.queue.length === 0) return
    const task = slot.queue.shift()!
    if (task.signal?.aborted) {
      task.reject(abortError())
      this.runNext(slot)
      return
    }
    slot.active = task
    task.timeoutId = window.setTimeout(() => {
      this.resetWorker(slot, new Error('图片压缩超时，请尝试更小的文件或更低的质量'))
    }, task.timeoutMs)
    if (task.signal) {
      task.abortHandler = () => this.resetWorker(slot, abortError())
      task.signal.addEventListener('abort', task.abortHandler, { once: true })
    }
    slot.worker.postMessage(task.request, [task.request.buffer])
  }

  private finishTask(slot: WorkerSlot, error: Error | null, results?: WorkerResult[], runNext = true) {
    const task = slot.active
    if (!task) return
    slot.active = null
    if (task.timeoutId !== null) window.clearTimeout(task.timeoutId)
    if (task.signal && task.abortHandler) task.signal.removeEventListener('abort', task.abortHandler)
    if (error) task.reject(error)
    else task.resolve(results ?? [])
    if (runNext) this.runNext(slot)
  }

  private resetWorker(slot: WorkerSlot, error: Error) {
    slot.worker.terminate()
    this.finishTask(slot, error, undefined, false)
    if (this.disposed) return
    const replacement = this.createSlot()
    replacement.queue = slot.queue
    const index = this.slots.indexOf(slot)
    if (index >= 0) this.slots[index] = replacement
    this.runNext(replacement)
  }
}
