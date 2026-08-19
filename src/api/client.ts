import { errorDetail } from '~/lib/errors'

const API_BASE = (typeof process !== 'undefined' && process.env.VITE_API_BASE) || ''

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
