import type { MediaJob } from './jobDomain'

export type JobAction =
  | { type: 'append'; jobs: MediaJob[] }
  | { type: 'replace-all'; jobs: MediaJob[] }
  | { type: 'patch'; id: string; patch: Partial<MediaJob> }
  | { type: 'replace-one'; job: MediaJob }
  | { type: 'clear' }

export function jobReducer(state: MediaJob[], action: JobAction): MediaJob[] {
  switch (action.type) {
    case 'append':
      return [...state, ...action.jobs]
    case 'replace-all':
      return action.jobs
    case 'patch':
      return state.map((job) => job.id === action.id ? { ...job, ...action.patch } : job)
    case 'replace-one':
      return state.map((job) => job.id === action.job.id ? action.job : job)
    case 'clear':
      return []
  }
}
