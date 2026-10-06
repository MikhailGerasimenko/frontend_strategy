import { FormEvent, useEffect, useState } from 'react'

import { apiFetch, apiJson, jsonBody } from '~/api/client'
import type { CustomSourcesListResponse, Job, ManagedSource } from '~/api/types'
import { Button } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'

import styles from './SourcesPage.module.scss'

function sourceLabel(row: ManagedSource): string {
  if (row.channel) return `@${row.channel}`
  return row.name || '—'
}

function sourceHref(row: ManagedSource): string {
  if (row.url) return row.url
  if (row.channel) return `https://t.me/${row.channel}`
  return ''
}

function kindLabel(row: ManagedSource): string {
  if (row.kind === 'telegram' || row.channel) return 'Telegram'
  return 'Web'
}

export function SourcesPage() {
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [parseYesterday, setParseYesterday] = useState(true)
  const [activeSources, setActiveSources] = useState<ManagedSource[]>([])
  const [disabledSources, setDisabledSources] = useState<ManagedSource[]>([])
  const [activeStatus, setActiveStatus] = useState('Загрузка…')
  const [disabledStatus, setDisabledStatus] = useState('Загрузка…')
  const [hint, setHint] = useState('')
  const [hintKind, setHintKind] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobLogs, setJobLogs] = useState('')

  const loadSources = async () => {
    const data = await apiJson<CustomSourcesListResponse>('/api/custom-sources')
    setCategories(data.categories || [])
    const active = data.sources || []
    const disabled = data.disabled || []
    setActiveSources(active)
    setDisabledSources(disabled)
    setActiveStatus(active.length ? '' : 'Нет активных источников.')
    setDisabledStatus(disabled.length ? '' : 'Отключённых источников нет.')
  }

  useEffect(() => {
    void loadSources()
  }, [])

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    const tick = async () => {
      const data = await apiJson<Job>(`/api/jobs/${jobId}`)
      if (cancelled) return
      setJobLogs((data.logs || []).join('\n'))
      if (['completed', 'failed', 'cancelled'].includes(data.status)) {
        setJobId(null)
        if (data.status === 'completed') {
          setHint('Парсинг завершён. Канал появится в источниках брифа.')
          setHintKind('ok')
          await loadSources()
        } else {
          setHint(data.error || 'Парсинг не удался.')
          setHintKind('err')
        }
      }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [jobId])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!url.trim()) {
      setHint('Вставьте ссылку на канал.')
      setHintKind('err')
      return
    }
    if (!category.trim()) {
      setHint('Укажите категорию.')
      setHintKind('err')
      return
    }
    setSubmitting(true)
    setHint('Добавляю…')
    setHintKind('')
    try {
      const res = await apiFetch('/api/custom-sources', jsonBody({ url: url.trim(), topic_category: category.trim(), parse_yesterday: parseYesterday }))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setHint(data.detail || 'Не удалось добавить канал.')
        setHintKind('err')
        return
      }
      setUrl('')
      if (data.categories) setCategories(data.categories)
      await loadSources()
      const name = data.channel?.channel || ''
      if (data.parse_job_id) {
        setHint(`Канал @${name} добавлен, парсим вчерашние посты…`)
        setHintKind('ok')
        setJobLogs('Запуск парсинга…')
        setJobId(data.parse_job_id)
      } else {
        setHint(`Канал @${name} добавлен. Новости подтянутся при ночном парсинге.`)
        setHintKind('ok')
      }
    } catch {
      setHint('Сбой соединения.')
      setHintKind('err')
    } finally {
      setSubmitting(false)
    }
  }

  const parseChannel = async (channel: string) => {
    setHint(`Парсинг @${channel} за вчера…`)
    setHintKind('')
    const res = await apiFetch(`/api/custom-sources/${encodeURIComponent(channel)}/parse`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setHint(data.detail || 'Не удалось запустить парсинг.')
      setHintKind('err')
      return
    }
    setJobLogs('Запуск парсинга…')
    setJobId(data.job_id)
  }

  const disableSource = async (name: string) => {
    const ok = window.confirm(
      `Отключить источник «${name}»?\n\n` +
        'Он перестанет парситься. Уже сохранённые новости останутся в векторной базе и будут доступны в брифе и агенте.',
    )
    if (!ok) return
    const res = await apiFetch('/api/managed-sources/disable', jsonBody({ name }))
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setHint(data.detail || 'Не удалось отключить источник.')
      setHintKind('err')
      return
    }
    setHint(`Источник «${name}» отключён. Новости в RAG сохранены.`)
    setHintKind('ok')
    await loadSources()
  }

  const restoreSource = async (name: string) => {
    const res = await apiFetch('/api/managed-sources/restore', jsonBody({ name }))
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setHint(data.detail || 'Не удалось вернуть источник.')
      setHintKind('err')
      return
    }
    setHint(`Источник «${name}» снова в парсинге.`)
    setHintKind('ok')
    await loadSources()
  }

  const renderSourceRow = (row: ManagedSource, mode: 'active' | 'disabled') => {
    const href = sourceHref(row)
    const label = sourceLabel(row)
    return (
      <tr key={row.name}>
        <td>
          {href ? (
            <a href={href} target='_blank' rel='noopener noreferrer'>
              {label}
            </a>
          ) : (
            label
          )}
          {row.custom ? <span className={styles.customBadge}>свой</span> : null}
          <div className={styles.mutedName}>{row.name || ''}</div>
        </td>
        <td>{kindLabel(row)}</td>
        <td>{row.topic_category || '—'}</td>
        <td className={styles.actions}>
          {mode === 'active' && row.custom && row.channel ? (
            <Button size='sm' onClick={() => void parseChannel(row.channel!)}>
              Парсить вчера
            </Button>
          ) : null}
          {mode === 'active' ? (
            <Button size='sm' onClick={() => void disableSource(row.name)}>
              Удалить
            </Button>
          ) : (
            <Button size='sm' onClick={() => void restoreSource(row.name)}>
              Вернуть
            </Button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <>
      <Card title='Добавить канал'>
        <p className={styles.help}>
          Нужен <strong>публичный</strong> канал (виджет t.me/s/…). Приватные invite-ссылки не подойдут. Категория — как на странице брифа: можно выбрать из списка или вписать свою.
        </p>
        <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
          <label>
            Ссылка на Telegram-канал
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder='https://t.me/rbc_news' autoComplete='off' spellCheck={false} />
          </label>
          <label>
            Категория
            <input value={category} onChange={(e) => setCategory(e.target.value)} list='knownCategories' placeholder='Выберите или введите свою' />
            <datalist id='knownCategories'>
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          <label className={styles.check}>
            <input type='checkbox' checked={parseYesterday} onChange={(e) => setParseYesterday(e.target.checked)} />
            Сразу спарсить новости за вчера
          </label>
          <Button variant='primary' type='submit' disabled={submitting}>
            Добавить
          </Button>
        </form>
        {hint ? <p className={`${styles.hint} ${hintKind === 'ok' ? styles.ok : ''} ${hintKind === 'err' ? styles.err : ''}`}>{hint}</p> : null}
      </Card>

      <Card title='Активные источники'>
        <p className={styles.help}>
          Удаление <strong>только останавливает парсинг</strong>. Новости, которые уже попали в векторную базу, остаются и доступны в брифе и агенте. Свои каналы можно дополнительно спарсить за вчера.
        </p>
        {activeStatus ? <p className={styles.hint}>{activeStatus}</p> : null}
        {activeSources.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Источник</th>
                  <th>Тип</th>
                  <th>Категория</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{activeSources.map((row) => renderSourceRow(row, 'active'))}</tbody>
            </table>
          </div>
        ) : null}
        {jobLogs ? <pre className={styles.log}>{jobLogs}</pre> : null}
      </Card>

      <Card title='Отключённые источники'>
        <p className={styles.help}>Их можно вернуть в парсинг. Исторические новости в RAG при этом не меняются.</p>
        {disabledStatus ? <p className={styles.hint}>{disabledStatus}</p> : null}
        {disabledSources.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Источник</th>
                  <th>Тип</th>
                  <th>Категория</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{disabledSources.map((row) => renderSourceRow(row, 'disabled'))}</tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </>
  )
}
