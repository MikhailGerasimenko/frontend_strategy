export function formatLocalIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function yesterdayIso(): string {
  const day = new Date()
  day.setDate(day.getDate() - 1)
  return formatLocalIso(day)
}

export function yesterdayRange(): { start: string; end: string } {
  const iso = yesterdayIso()
  return { start: iso, end: iso }
}

export function formatIsoDateRu(iso?: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}.${month}.${year}`
}

export function formatCreatedAt(value?: string): string {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}
