export const KALLANISH_SOURCE = 'Kallanish'
export const PDF_SOURCE = 'PDF отчёт'
export const PMI_SOURCE = 'PMI'
export const DOC_SOURCE_NAMES = new Set([KALLANISH_SOURCE, PDF_SOURCE, PMI_SOURCE])

export function detectAttachmentDocumentType(filename: string): string {
  const lower = (filename || '').toLowerCase()
  const isPdf = lower.endsWith('.pdf')
  const isDocx = lower.endsWith('.docx')
  const isTxt = lower.endsWith('.txt')
  if (!isPdf && !isDocx && !isTxt) return ''
  if (lower.includes('pmi')) return 'PMI'
  if (lower.includes('kallanish')) return 'Kallanish'
  if (isPdf) return 'PDF отчёт'
  return 'Kallanish'
}

export function classifyAttachmentDocSource(documentType?: string): string {
  const t = String(documentType || '').toLowerCase()
  if (t.includes('kallanish')) return KALLANISH_SOURCE
  if (t.includes('pmi')) return PMI_SOURCE
  return PDF_SOURCE
}

export function formatAttachmentPeriod(briefDate?: string, periodEnd?: string): string {
  const start = formatRu(briefDate)
  const end = formatRu(periodEnd)
  return start === end ? start : `${start} — ${end}`
}

function formatRu(iso?: string): string {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}.${month}.${year}`
}
