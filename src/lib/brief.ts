export const MONTHLY_BRIEF_KINDS = new Set(['monthly', 'monthly_news', 'monthly_market', 'monthly_corporate'])

export const BRIEF_KIND_LABELS: Record<string, string> = {
  full: 'полный',
  market: 'рыночный',
  corporate: 'новостной',
  monthly: 'полный ежемесячный',
  monthly_news: 'ежемесячный новостной',
  monthly_market: 'ежемесячный рыночный',
  monthly_corporate: 'ежемесячный рыночный',
}

export const DEFAULT_BRIEF_KIND_MATCH: Record<string, string[]> = {
  full: ['news', 'market', 'all'],
  monthly: ['news', 'market', 'all'],
  monthly_news: ['news', 'all'],
  monthly_market: ['market', 'all'],
  monthly_corporate: ['market', 'all'],
  market: ['market', 'all'],
  corporate: ['news', 'all'],
}

export const DEFAULT_BRIEF_LABELS: Record<string, string> = {
  news: 'Новостной',
  market: 'Рыночный',
  all: 'Все типы',
}

export const TOPIC_GROUP_ORDER = [
  'Металлургия РФ',
  'Металлургия мира',
  'Китай',
  'Макроэкономика РФ',
  'Макроэкономика мира',
  'Документы RAG',
]

export function isMonthlyBriefKind(kind: string): boolean {
  return MONTHLY_BRIEF_KINDS.has(kind)
}

export function jobStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'В очереди…',
    running: 'Выполняется…',
    completed: 'Готово',
    failed: 'Ошибка',
    cancelled: 'Остановлено',
    stopping: 'stopping…',
  }
  return map[status] || status
}
