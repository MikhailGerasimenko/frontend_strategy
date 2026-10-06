import type {
  ApiDetail,
  CleanupBriefResponse,
  CustomSourcesListResponse,
  MapDigestDetail,
  MapDigestsListResponse,
  SaveDefaultPromptPayload,
  WeeklyDefaultPromptResponse,
  WeeklyStagePromptResponse,
} from '~/api/types'
import { errorDetail } from '~/lib/errors'

const API_BASE = (typeof process !== 'undefined' && process.env.VITE_API_BASE) || ''

/** Абсолютный URL API (для скачивания файлов через location.href). */
export function apiPath(path: string): string {
  return `${API_BASE}${path}`
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super('unauthorized', 401)
    this.name = 'UnauthorizedError'
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
    ...options,
  })
  if (res.status === 401) {
    throw new UnauthorizedError()
  }
  return res
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(errorDetail(data, `Ошибка ${res.status}`), res.status)
  }
  return data as T
}

export function jsonBody(payload: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

/** Ответ API без выброса исключения при !ok (UI показывает detail в подсказке). */
export type ApiResult<T> = {
  ok: boolean
  status: number
  data: T & ApiDetail
}

export async function apiResult<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const res = await apiFetch(path, options)
  const data = (await res.json().catch(() => ({}))) as T & ApiDetail
  return { ok: res.ok, status: res.status, data }
}

/* --- /api/weekly/default-prompt (system + user) --- */

export function getDefaultPrompt(variant: string, periodStart?: string, periodEnd?: string) {
  const params = new URLSearchParams({ variant })
  if (periodStart) params.set('period_start', periodStart)
  if (periodEnd) params.set('period_end', periodEnd)
  return apiJson<WeeklyDefaultPromptResponse>(`/api/weekly/default-prompt?${params.toString()}`)
}

export function saveDefaultPrompt(payload: SaveDefaultPromptPayload) {
  return apiResult<{ ok?: boolean }>('/api/weekly/default-prompt', jsonBody(payload))
}

export function resetDefaultPrompt(variant: string) {
  return apiResult<{ ok?: boolean }>(`/api/weekly/default-prompt?variant=${encodeURIComponent(variant)}`, {
    method: 'DELETE',
  })
}

/* --- /api/weekly/cleanup-prompt --- */

export function getCleanupPrompt(briefKind: string) {
  return apiJson<WeeklyStagePromptResponse>(`/api/weekly/cleanup-prompt?brief_kind=${encodeURIComponent(briefKind || 'full')}`)
}

export function saveCleanupPrompt(briefKind: string, prompt: string) {
  return apiResult<{ ok?: boolean }>(
    '/api/weekly/cleanup-prompt',
    jsonBody({ variant: `cleanup::${briefKind || 'full'}`, prompt }),
  )
}

export function resetCleanupPrompt(briefKind: string) {
  return apiResult<{ ok?: boolean }>(`/api/weekly/cleanup-prompt?brief_kind=${encodeURIComponent(briefKind || 'full')}`, {
    method: 'DELETE',
  })
}

/* --- /api/jobs/{id}/cleanup-brief --- */

export function cleanupBrief(jobId: string, content: string, systemPrompt: string | null) {
  return apiResult<CleanupBriefResponse>(`/api/jobs/${jobId}/cleanup-brief`, jsonBody({ content, system_prompt: systemPrompt }))
}

/* --- map digests --- */

export function getMapDigests(jobId: string) {
  return apiJson<MapDigestsListResponse>(`/api/jobs/${jobId}/map-digests`)
}

export function getMapDigest(jobId: string, index: number) {
  return apiResult<MapDigestDetail>(`/api/jobs/${jobId}/map-digests/${index}`)
}

export function mapDigestsDocxPath(jobId: string): string {
  return apiPath(`/api/jobs/${jobId}/map-digests.docx`)
}

/* --- sources --- */

export function getCustomSources() {
  return apiJson<CustomSourcesListResponse>('/api/custom-sources')
}

export function disableManagedSource(name: string) {
  return apiResult<{ ok?: boolean }>('/api/managed-sources/disable', jsonBody({ name }))
}

export function restoreManagedSource(name: string) {
  return apiResult<{ ok?: boolean }>('/api/managed-sources/restore', jsonBody({ name }))
}
