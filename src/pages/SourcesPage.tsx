import { FormEvent, useEffect, useState } from 'react'

import { apiFetch, apiJson, jsonBody } from '~/api/client'
import type { CustomChannel, Job } from '~/api/types'
import { Button } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'

import styles from './SourcesPage.module.scss'

export function SourcesPage() {
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [parseYesterday, setParseYesterday] = useState(true)
  const [channels, setChannels] = useState<CustomChannel[]>([])
  const [status, setStatus] = useState('Загрузка…')
  const [hint, setHint] = useState('')
  const [hintKind, setHintKind] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobLogs, setJobLogs] = useState('')

  const loadChannels = async () => {
    const data = await apiJson<{ categories?: string[]; channels?: CustomChannel[] }>('/api/custom-sources')
    setCategories(data.categories || [])
    setChannels(data.channels || [])
    setStatus(data.channels?.length ? '' : 'Пока никто не добавлял свои каналы.')
  }

  useEffect(() => {
    void loadChannels()
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
      await loadChannels()
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

  const deleteChannel = async (channel: string) => {
    if (!window.confirm(`Удалить канал @${channel} из своих источников?`)) return
    const res = await apiFetch(`/api/custom-sources/${encodeURIComponent(channel)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setHint(data.detail || 'Не удалось удалить.')
      setHintKind('err')
      return
    }
    setHint(`Канал @${channel} удалён.`)
    setHintKind('')
    await loadChannels()
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

      <Card title='Добавленные каналы'>
        <p className={styles.help}>Они появляются в списке источников брифа в выбранной категории. Ночной парсинг (00:30 МСК) подхватывает их автоматически.</p>
        {status ? <p className={styles.hint}>{status}</p> : null}
        {channels.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Канал</th>
                  <th>Категория</th>
                  <th>Кто добавил</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {channels.map((row) => (
                  <tr key={row.channel}>
                    <td>
                      <a href={row.url || `https://t.me/${row.channel}`} target='_blank' rel='noopener noreferrer'>
                        @{row.channel}
                      </a>
                    </td>
                    <td>{row.topic_category || '—'}</td>
                    <td>{row.added_by || '—'}</td>
                    <td className={styles.actions}>
                      <Button size='sm' onClick={() => void parseChannel(row.channel)}>
                        Парсить вчера
                      </Button>
                      <Button size='sm' onClick={() => void deleteChannel(row.channel)}>
                        Удалить
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {jobLogs ? <pre className={styles.log}>{jobLogs}</pre> : null}
      </Card>
    </>
  )
}
