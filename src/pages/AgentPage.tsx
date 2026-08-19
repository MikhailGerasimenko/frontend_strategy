import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { ApiError, apiJson, jsonBody } from '~/api/client'
import type { AgentFullText, AgentSource, ChatTurn, HealthStatus } from '~/api/types'
import { Button } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import { escapeHtml, renderMarkdown } from '~/lib/markdown'

import styles from './AgentPage.module.scss'

const AGENT_PROMPT_STORAGE_KEY = 'nav.agent.systemPrompt'
const AGENT_PROMPT_COLLAPSED_KEY = 'nav.agent.promptCollapsed'
const WELCOME =
  'Привет! Можно спрашивать что угодно — как у обычной нейросети. Если в базе есть новости или Kallanish/PDF по теме, я подтяну их и отмечу ссылками [n].'

type ChatItem =
  | { id: string; role: 'user'; html: string }
  | { id: string; role: 'assistant'; html: string }

export function AgentPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [promptCollapsed, setPromptCollapsed] = useState(() => localStorage.getItem(AGENT_PROMPT_COLLAPSED_KEY) === '1')
  const [defaultPrompt, setDefaultPrompt] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [promptStatus, setPromptStatus] = useState('Загрузка дефолта…')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<ChatItem[]>([{ id: 'welcome', role: 'assistant', html: WELCOME }])
  const lastSources = useRef<AgentSource[]>([])
  const history = useRef<ChatTurn[]>([])
  const logRef = useRef<HTMLDivElement | null>(null)
  const location = useLocation()

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  useEffect(() => {
    void (async () => {
      const [healthData, promptData] = await Promise.all([
        apiJson<HealthStatus>('/api/health'),
        apiJson<{ prompt?: string }>('/api/agent/default-prompt'),
      ])
      setHealth(healthData)
      const serverPrompt = (promptData.prompt || '').trim()
      setDefaultPrompt(serverPrompt)
      const saved = localStorage.getItem(AGENT_PROMPT_STORAGE_KEY)
      if (saved && saved.trim()) {
        setSystemPrompt(saved)
        setPromptStatus('Загружен сохранённый промпт из браузера')
      } else {
        setSystemPrompt(serverPrompt)
        setPromptStatus('Дефолтный промпт с сервера')
      }
    })()
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages])

  const persistPrompt = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      localStorage.setItem(AGENT_PROMPT_STORAGE_KEY, '')
      setPromptStatus('Промпт очищен — обычный чат без поиска по базе')
      return
    }
    if (trimmed === defaultPrompt) {
      localStorage.removeItem(AGENT_PROMPT_STORAGE_KEY)
      setPromptStatus('Дефолтный промпт с сервера')
      return
    }
    localStorage.setItem(AGENT_PROMPT_STORAGE_KEY, value)
    setPromptStatus('Сохранено в этом браузере (отличается от дефолта)')
  }

  const togglePrompt = () => {
    const next = !promptCollapsed
    setPromptCollapsed(next)
    localStorage.setItem(AGENT_PROMPT_COLLAPSED_KEY, next ? '1' : '0')
  }

  const renderSources = (sources: AgentSource[]) => {
    if (!sources.length) return ''
    const items = sources
      .map((source) => {
        const titleHtml = source.url
          ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>`
          : `<span>${escapeHtml(source.title)}</span>`
        const openLabel = source.kind === 'attachment' ? 'показать фрагмент' : 'показать целиком'
        return `<li><span class="cite">[${source.ref}]</span> ${titleHtml} <span class="${styles.meta}">${escapeHtml(source.source)} · ${escapeHtml(source.news_date)}</span> <button type="button" class="${styles.inline}" data-full="${source.ref}">${openLabel}</button></li>`
      })
      .join('')
    return `<div class="${styles.sources}"><div class="${styles.sourcesTitle}">Источники</div><ul>${items}</ul></div>`
  }

  const renderFull = (full: AgentFullText) => {
    const title = escapeHtml(full.title || 'Документ')
    const titleHtml = full.url ? `<a href="${escapeHtml(full.url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : `<span>${title}</span>`
    return `<div class="${styles.full}"><div class="${styles.sourcesTitle}">${titleHtml} <span class="${styles.meta}">${escapeHtml(full.source || '')} · ${escapeHtml(full.news_date || '')}</span></div><pre class="${styles.fullBody}">${escapeHtml(full.text || '')}</pre></div>`
  }

  const ask = async (question: string) => {
    if (sending || !question.trim()) return
    setSending(true)
    const userHtml = escapeHtml(question)
    const thinkingId = `a-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', html: userHtml },
      { id: thinkingId, role: 'assistant', html: '<span class="thinking">Думаю…</span>' },
    ])
    try {
      const data = await apiJson<{ answer?: string; sources?: AgentSource[]; full_text?: AgentFullText; detail?: string }>(
        '/api/agent/ask',
        jsonBody({
          question,
          period_start: start || null,
          period_end: end || null,
          prior_sources: lastSources.current,
          history: history.current.slice(-6),
          system_prompt: systemPrompt.trim(),
        }),
      )
      let html = `<div class="md">${renderMarkdown(data.answer || '')}</div>`
      if (data.full_text) html += renderFull(data.full_text)
      if (data.sources?.length) {
        lastSources.current = data.sources
        html += renderSources(data.sources)
      }
      setMessages((prev) => prev.map((item) => (item.id === thinkingId ? { ...item, html } : item)))
      history.current = [...history.current, { role: 'user', content: question }, { role: 'assistant', content: data.answer || '' }].slice(-12)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Сбой соединения'
      setMessages((prev) => prev.map((item) => (item.id === thinkingId ? { ...item, html: `<span class="err-text">${escapeHtml(message)}</span>` } : item)))
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const question = input
      setInput('')
      void ask(question)
    }
  }

  return (
    <>
      <Card className={styles.statusBar}>
        <span className={`${styles.badge} ${health?.openrouter_configured ? styles.ok : styles.err}`}>
          {health ? (health.openrouter_configured ? 'OpenRouter OK' : 'Нет OPENROUTER_API_KEY') : 'Проверка…'}
        </span>
        <span className={styles.hint}>Модель: {health?.default_model || '—'}</span>
        <span className={styles.hint}>{health?.pgvector_configured ? 'PostgreSQL + pgvector: подключено' : 'PostgreSQL: не настроен (DATABASE_URL)'}</span>
      </Card>

      <Card id='agentPromptPanel'>
        <div className={styles.promptHeader}>
          <div>
            <h2>Системный промпт агента</h2>
            <p className={styles.help}>Задаёт роль и правила до ответа. Правки сохраняются в этом браузере.</p>
          </div>
          <div className={styles.toolbar}>
            <Button onClick={togglePrompt}>{promptCollapsed ? 'Развернуть' : 'Свернуть'}</Button>
            <Button
              onClick={() => {
                setSystemPrompt(defaultPrompt)
                localStorage.removeItem(AGENT_PROMPT_STORAGE_KEY)
                setPromptStatus('Сброшено к дефолту с сервера')
              }}
            >
              Сбросить к дефолту
            </Button>
          </div>
        </div>
        {!promptCollapsed ? (
          <>
            <textarea
              className={styles.prompt}
              rows={12}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              onBlur={(e) => persistPrompt(e.target.value)}
            />
            <p className={styles.help}>{promptStatus}</p>
          </>
        ) : null}
      </Card>

      <Card title='Период поиска (необязательно)'>
        <p className={styles.help}>Ограничьте поиск по базе диапазоном дат. Пусто — поиск по всем проиндексированным материалам.</p>
        <div className={styles.toolbar}>
          <label>
            С
            <input type='date' value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <span>→</span>
          <label>
            По
            <input type='date' value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <Button
            onClick={() => {
              lastSources.current = []
              history.current = []
              setMessages([{ id: 'cleared', role: 'assistant', html: 'Чат очищен. Задайте новый вопрос.' }])
            }}
          >
            Очистить чат
          </Button>
        </div>
      </Card>

      <Card className={styles.chatCard}>
        <div
          className={styles.log}
          ref={logRef}
          onClick={(event) => {
            const btn = (event.target as HTMLElement).closest('[data-full]')
            if (!btn) return
            const ref = btn.getAttribute('data-full')
            if (ref) void ask(`Покажи новость ${ref} целиком`)
          }}
        >
          {messages.map((item) => (
            <div key={item.id} className={`${styles.msg} ${item.role === 'user' ? styles.user : styles.assistant}`}>
              <div className={styles.bubble} dangerouslySetInnerHTML={{ __html: item.html }} />
            </div>
          ))}
        </div>
        <div className={styles.inputRow}>
          <textarea
            className={styles.input}
            rows={2}
            value={input}
            placeholder='Ваш вопрос…'
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <Button
            variant='primary'
            disabled={sending}
            onClick={() => {
              const question = input
              setInput('')
              void ask(question)
            }}
          >
            Спросить
          </Button>
        </div>
      </Card>
    </>
  )
}
