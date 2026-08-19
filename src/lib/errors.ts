export function errorDetail(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object' || !('detail' in data)) {
    return fallback
  }
  const detail = (data as { detail: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg)
        }
        return JSON.stringify(item)
      })
      .join('; ')
  }
  return fallback
}
