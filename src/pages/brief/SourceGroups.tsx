import type { PeriodSource } from '~/api/types'
import { DEFAULT_BRIEF_LABELS, TOPIC_GROUP_ORDER } from '~/lib/brief'

import styles from './SourceGroups.module.scss'

type Props = {
  sources: PeriodSource[]
  selected: Set<string>
  briefKind: string
  briefKindMatch: Record<string, string[]>
  briefLabels: Record<string, string>
  onToggle: (name: string) => void
  onToggleTopic: (items: PeriodSource[]) => void
}

function matchesBrief(source: PeriodSource, kind: string, match: Record<string, string[]>): boolean {
  const allowed = match[kind] || match.full || ['news', 'market', 'all']
  return allowed.includes(source.brief || 'all')
}

export function SourceGroups({ sources, selected, briefKind, briefKindMatch, briefLabels, onToggle, onToggleTopic }: Props) {
  if (!sources.length) {
    return <p className={styles.empty}>Нет источников</p>
  }

  const byTopic = new Map<string, PeriodSource[]>()
  for (const item of sources) {
    const topic = String(item.topic_category || '').trim() || 'Без категории'
    if (!byTopic.has(topic)) byTopic.set(topic, [])
    byTopic.get(topic)!.push(item)
  }

  const topics = [
    ...TOPIC_GROUP_ORDER.filter((topic) => byTopic.has(topic)),
    ...[...byTopic.keys()].filter((topic) => !TOPIC_GROUP_ORDER.includes(topic) && topic !== 'Без категории').sort((a, b) => a.localeCompare(b, 'ru')),
  ]
  if (byTopic.has('Без категории')) topics.push('Без категории')

  return (
    <div>
      {topics.map((topic) => {
        const items = [...(byTopic.get(topic) || [])].sort((a, b) => {
          const rank = (kind?: string) => (kind === 'document' ? 2 : kind === 'telegram' ? 1 : 0)
          const diff = rank(a.kind) - rank(b.kind)
          if (diff) return diff
          return String(a.name).localeCompare(String(b.name), 'ru')
        })
        if (!items.length) return null
        const matching = items.filter((item) => matchesBrief(item, briefKind, briefKindMatch)).length
        const selectedInTopic = items.filter((item) => selected.has(item.name)).length
        const allSelected = selectedInTopic === items.length

        return (
          <div key={topic} className={styles.group}>
            <div className={styles.heading}>
              <h3 className={styles.title}>
                {topic}
                <span className={styles.meta}>
                  {items.length}
                  {matching ? ` · ${matching} подходят к брифу` : ''}
                </span>
              </h3>
              <button
                type='button'
                className={`${styles.allBtn} ${allSelected ? styles.allActive : ''}`}
                onClick={() => onToggleTopic(items)}
              >
                {allSelected ? 'Снять' : 'Все'}
              </button>
            </div>
            <div className={styles.chips}>
              {items.map((item) => {
                const labelText = item.name.startsWith('TG ') ? item.name.slice(3) : item.name
                const kindBadge = item.kind === 'telegram' ? 'TG' : item.kind === 'document' ? 'doc' : 'web'
                const briefBadge = item.brief_label || briefLabels[item.brief || ''] || DEFAULT_BRIEF_LABELS[item.brief || ''] || ''
                const className = [
                  styles.chip,
                  selected.has(item.name) ? styles.selected : '',
                  item.count ? '' : styles.emptyChip,
                  item.kind === 'telegram' ? styles.tg : '',
                  item.kind === 'document' ? styles.doc : '',
                  matchesBrief(item, briefKind, briefKindMatch) ? '' : styles.offBrief,
                ].join(' ')
                return (
                  <button
                    key={item.name}
                    type='button'
                    className={className}
                    title={`${item.name}${briefBadge ? ` · ${briefBadge}` : ''} · ${topic}${item.custom ? ' · добавлен коллегами' : ''}`}
                    onClick={() => onToggle(item.name)}
                  >
                    <span className={styles.check} aria-hidden='true'>
                      ✓
                    </span>
                    <span className={styles.kind}>{kindBadge}</span>
                    <span className={styles.label}>{labelText}</span>
                    {item.custom ? <span className={styles.custom}>свой</span> : null}
                    {briefBadge ? <span className={styles.brief}>{briefBadge}</span> : null}
                    <span className={styles.count}>{item.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
