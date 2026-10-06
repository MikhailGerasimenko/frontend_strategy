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

const STRUCTURE_MARKER = 'ОБЯЗАТЕЛЬНАЯ СТРУКТУРА'
const STRUCTURE_TITLE_RE =
  /^(?:#{1,3}\s*)?(?:обязательная\s+)?структура(?:\s+(?:отчета|отчёта|брифа|дайджеста))?\s*:?\s*$/iu
const NUMBERED_SECTION_RE = /^(\d+)\.\s+\S.{0,78}$/

function isStructureMarkerLine(line: string): boolean {
  const stripped = String(line || '')
    .trimStart()
    .trim()
  if (!stripped) return false
  if (stripped.startsWith(STRUCTURE_MARKER)) return true
  if (stripped.length > 60) return false
  return STRUCTURE_TITLE_RE.test(stripped)
}

function isMarkdownStructureHeading(line: string): boolean {
  return String(line || '')
    .trimStart()
    .trim()
    .startsWith('## ')
}

function findNumberedStructureIndex(lines: string[]): number {
  const candidates: { index: number; num: number }[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const stripped = String(lines[i] || '')
      .trimStart()
      .trim()
    if (stripped.length > 80) continue
    const match = stripped.match(NUMBERED_SECTION_RE)
    if (!match) continue
    candidates.push({ index: i, num: Number(match[1]) })
  }
  if (!candidates.length) return -1
  if (candidates.length === 1) {
    const only = candidates[0]
    if (only.index > 0 && only.num <= 1) return only.index
    return -1
  }
  const preferred = candidates.find((c) => c.num <= 1)
  return (preferred || candidates[0]).index
}

export type SplitBriefPrompt = {
  system_prompt: string
  user_prompt: string
}

export function splitBriefPrompt(text: string): SplitBriefPrompt {
  const raw = text || ''
  const lines = raw.split(/(?<=\n)/)
  if (!lines.length) return { system_prompt: '', user_prompt: '' }

  let splitAt = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (isStructureMarkerLine(lines[i])) {
      splitAt = i
      break
    }
  }
  if (splitAt < 0) {
    for (let i = 1; i < lines.length; i += 1) {
      if (isMarkdownStructureHeading(lines[i])) {
        splitAt = i
        break
      }
    }
  }
  if (splitAt < 0) splitAt = findNumberedStructureIndex(lines)
  if (splitAt < 0) return { system_prompt: raw.trim(), user_prompt: '' }

  return {
    system_prompt: lines
      .slice(0, splitAt)
      .join('')
      .replace(/\s+$/, ''),
    user_prompt: lines.slice(splitAt).join('').trim(),
  }
}

export function joinBriefPrompt(systemPrompt: string, userPrompt: string): string {
  const system = (systemPrompt || '').trim()
  let structure = (userPrompt || '').trim()
  if (!structure) return system
  if (!system) return structure
  const firstLine = structure.split('\n')[0] || ''
  const firstStripped = firstLine.trimStart().trim()
  if (
    !isStructureMarkerLine(firstLine) &&
    !isMarkdownStructureHeading(firstLine) &&
    !NUMBERED_SECTION_RE.test(firstStripped.slice(0, 90))
  ) {
    structure = `${STRUCTURE_MARKER}:\n${structure}`
  }
  return `${system}\n\n${structure}`
}

export type DefaultPromptPayload = {
  prompt?: string
  system_prompt?: string
  user_prompt?: string
  variant?: string
  customized?: boolean
}

/** Заполняет поля system/user из ответа GET default-prompt (как fillBriefPromptFields в SOURCE). */
export function resolveBriefPromptFields(data: DefaultPromptPayload | null | undefined): SplitBriefPrompt {
  const hasParts =
    data &&
    typeof data.system_prompt === 'string' &&
    typeof data.user_prompt === 'string' &&
    (data.system_prompt.length > 0 || data.user_prompt.length > 0)

  if (hasParts) {
    if (!data.user_prompt && data.prompt) {
      const parts = splitBriefPrompt(data.prompt)
      if (parts.user_prompt) return parts
    }
    return {
      system_prompt: data.system_prompt || '',
      user_prompt: data.user_prompt || '',
    }
  }

  return splitBriefPrompt(data?.prompt || '')
}
