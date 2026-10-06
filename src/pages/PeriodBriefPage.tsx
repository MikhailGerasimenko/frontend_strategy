import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { apiFetch, apiJson, jsonBody, mapDigestsDocxPath } from '~/api/client'
import type {
  AttachmentDoc,
  AttachmentMeta,
  CleanupBriefResponse,
  HealthStatus,
  Job,
  MapDigestDetail,
  MapDigestSummaryItem,
  PeriodSource,
  WeeklyDefaultPromptResponse,
  WeeklyStagePromptResponse,
} from '~/api/types'
import { useStagePrompt } from '~/hooks/useStagePrompt'
import { Button } from '~/components/ui/Button'
import { Card } from '~/components/ui/Card'
import {
  classifyAttachmentDocSource,
  detectAttachmentDocumentType,
  DOC_SOURCE_NAMES,
  formatAttachmentPeriod,
} from '~/lib/attachments'
import {
  BRIEF_KIND_LABELS,
  DEFAULT_BRIEF_KIND_MATCH,
  DEFAULT_BRIEF_LABELS,
  isMonthlyBriefKind,
  joinBriefPrompt,
  resolveBriefPromptFields,
} from '~/lib/brief'
import { formatCreatedAt, yesterdayRange } from '~/lib/dates'
import { SourceGroups } from '~/pages/brief/SourceGroups'

import styles from './PeriodBriefPage.module.scss'

type CoverageState = '' | 'ready' | 'warn' | 'missing'

export function PeriodBriefPage() {
  const location = useLocation()
  const range = yesterdayRange()
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [periodStart, setPeriodStart] = useState(range.start)
  const [periodEnd, setPeriodEnd] = useState(range.end)
  const [pdfDate, setPdfDate] = useState(range.start)
  const [pdfEnd, setPdfEnd] = useState(range.end)
  const [files, setFiles] = useState<File[]>([])
  const [uploadHint, setUploadHint] = useState('')
  const [uploadKind, setUploadKind] = useState('')
  const [libraryCollapsed, setLibraryCollapsed] = useState(() => localStorage.getItem('nav.attachmentLibrary.collapsed') === '1')
  const [filterByPeriod, setFilterByPeriod] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentDoc[]>([])
  const [attachmentStatus, setAttachmentStatus] = useState('Загрузка…')
  const [attachmentMeta, setAttachmentMeta] = useState<Record<number, AttachmentMeta>>({})
  const [sources, setSources] = useState<PeriodSource[]>([])
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [briefKindMatch, setBriefKindMatch] = useState(DEFAULT_BRIEF_KIND_MATCH)
  const [briefLabels, setBriefLabels] = useState(DEFAULT_BRIEF_LABELS)
  const [briefKind, setBriefKind] = useState('full')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [promptDefaultHint, setPromptDefaultHint] = useState('')
  const [promptDefaultHintKind, setPromptDefaultHintKind] = useState('')
  const [cleanupPrompt, setCleanupPrompt] = useState('')
  const [cleanupPromptHint, setCleanupPromptHint] = useState('')
  const [cleanupPromptHintKind, setCleanupPromptHintKind] = useState('')
  const [mapDigestItems, setMapDigestItems] = useState<MapDigestSummaryItem[]>([])
  const [mapDigestCurrent, setMapDigestCurrent] = useState(1)
  const [mapDigestBody, setMapDigestBody] = useState('—')
  const [mapDigestMeta, setMapDigestMeta] = useState('')
  const [mapDigestsVisible, setMapDigestsVisible] = useState(false)
  const [mapDigestCopyLabel, setMapDigestCopyLabel] = useState('Скопировать')
  const mapDigestCacheRef = useRef<Map<number, MapDigestDetail>>(new Map())
  const mapPromptCtl = useStagePrompt('/api/weekly/map-prompt', 'map', 'промпт фактографа')
  const reducePromptCtl = useStagePrompt('/api/weekly/reduce-prompt', 'reduce', 'промпт склейки')
  const [coverage, setCoverage] = useState({ message: '', state: '' as CoverageState })
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [stopping, setStopping] = useState(false)
  const [briefContent, setBriefContent] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [exportHint, setExportHint] = useState('')
  const [exportKind, setExportKind] = useState('')

  const monthly = isMonthlyBriefKind(briefKind)
  const generating = Boolean(jobId && job && (job.status === 'pending' || job.status === 'running'))
  const skipPeriodReload = useRef(true)

  const selectedAttachmentIds = useMemo(() => {
    return Object.entries(attachmentMeta)
      .map(([id, meta]) => ({ id: Number(id), meta }))
      .filter(({ id, meta }) => {
        if (!(id > 0)) return false
        const enabled = selectedSources.has(classifyAttachmentDocSource(meta.document_type))
        if (!enabled) return false
        if (!periodStart || !periodEnd) return true
        const docStart = meta.brief_date || ''
        const docEnd = meta.period_end || meta.brief_date || ''
        if (!docStart) return false
        return docStart <= periodEnd && docEnd >= periodStart
      })
      .map(({ id }) => id)
  }, [attachmentMeta, selectedSources, periodStart, periodEnd])

  const newsSources = sources.filter((item) => item.kind !== 'document')
  const selectedNews = [...selectedSources].filter((name) => {
    const src = sources.find((item) => item.name === name)
    return src && src.kind !== 'document'
  })
  const selectedNewsPayload = !newsSources.length ? null : selectedNews.length === newsSources.length ? null : selectedNews
  const anyDocSelected = [...DOC_SOURCE_NAMES].some((name) => selectedSources.has(name))

  const sourceHint = sources.length
    ? `Выбрано ${selectedSources.size} из ${sources.length} · для типа брифа: ${sources.filter((item) => (briefKindMatch[briefKind] || briefKindMatch.full).includes(item.brief || 'all')).length} (с новостями: ${sources.filter((item) => item.count > 0).length})`
    : 'Нет источников в конфигурации'

  const enabledTypes = [...DOC_SOURCE_NAMES].filter((name) => selectedSources.has(name)).join(', ')
  const attachmentHint = attachments.length
    ? enabledTypes
      ? `В бриф за период: ${selectedAttachmentIds.length} (типы: ${enabledTypes})`
      : 'В бриф: 0 — включите Kallanish / PDF / PMI в источниках'
    : 'Нет документов'

  const loadHealth = useCallback(async () => {
    const data = await apiJson<HealthStatus>('/api/health')
    setHealth(data)
  }, [])

  const loadPeriodSources = useCallback(
    async (applyBriefFilter = false, kind = briefKind) => {
      if (!periodStart || !periodEnd) return
      const data = await apiJson<{
        sources?: PeriodSource[]
        brief_kind_match?: Record<string, string[]>
        brief_labels?: Record<string, string>
      }>(`/api/rag/period-sources?period_start=${encodeURIComponent(periodStart)}&period_end=${encodeURIComponent(periodEnd)}`)
      const nextSources = data.sources || []
      const nextMatch = data.brief_kind_match || DEFAULT_BRIEF_KIND_MATCH
      setSources(nextSources)
      if (data.brief_kind_match) setBriefKindMatch(data.brief_kind_match)
      if (data.brief_labels) setBriefLabels(data.brief_labels)
      setSelectedSources((prev) => {
        const matched = new Set(nextSources.filter((item) => (nextMatch[kind] || nextMatch.full).includes(item.brief || 'all')).map((item) => item.name))
        if (applyBriefFilter || !prev.size) return matched
        const kept = new Set(nextSources.filter((item) => prev.has(item.name)).map((item) => item.name))
        return kept.size ? kept : matched
      })
    },
    [periodStart, periodEnd, briefKind],
  )

  const checkCoverage = useCallback(async () => {
    if (!periodStart || !periodEnd) {
      setCoverage({ message: 'Укажите начало и конец периода.', state: 'warn' })
      return
    }
    setCoverage({ message: 'Проверяем индекс…', state: '' })
    const news = sources.filter((item) => item.kind !== 'document')
    const selectedNewsNames = [...selectedSources].filter((name) => news.some((item) => item.name === name))
    const selected = !news.length ? null : selectedNewsNames.length === news.length ? null : selectedNewsNames
    const sourcesQuery = selected?.length ? `&sources=${encodeURIComponent(selected.join(','))}` : ''
    const data = await apiJson<{
      configured?: boolean
      documents?: { source_type?: string; document_type?: string }[]
      attachments?: { document_type?: string }[]
      period_days?: number
      news_documents?: number
      news_days?: number
      news_full_text_fetched?: number
    }>(
      `/api/rag/period-coverage?period_start=${encodeURIComponent(periodStart)}&period_end=${encodeURIComponent(periodEnd)}&brief_kind=${encodeURIComponent(briefKind)}${sourcesQuery}`,
    )
    if (!data.configured) {
      setCoverage({ message: 'Векторная БД не настроена. Проверьте DATABASE_URL на сервере.', state: 'missing' })
      return
    }
    const docs = data.documents || []
    const attachmentsForPeriod =
      data.attachments || docs.filter((doc) => doc.source_type === 'pdf_report' || doc.source_type === 'docx_report')
    const sourceSummary = selected?.length ? ` · источников: ${selected.length}` : ''
    const attachmentSummary = attachmentsForPeriod.length
      ? ` · документов: ${attachmentsForPeriod.length} (${[...new Set(attachmentsForPeriod.map((doc) => doc.document_type))].join(', ')})`
      : ''
    setCoverage({
      message: `Сырых новостей в базе: ${data.news_documents || 0} за ${data.news_days || 0} из ${data.period_days || 0} дней (полный текст у ${data.news_full_text_fetched || 0})${sourceSummary}${attachmentSummary}`,
      state: (data.news_documents || 0) > 0 || attachmentsForPeriod.length > 0 ? 'ready' : 'missing',
    })
  }, [periodStart, periodEnd, briefKind, sources, selectedSources])

  const loadAttachmentLibrary = useCallback(async () => {
    let url = '/api/rag/attachments'
    if (filterByPeriod) {
      if (!pdfDate) {
        setAttachmentStatus('Укажите период загрузки выше для фильтра.')
        setAttachments([])
        return
      }
      url += `?period_start=${encodeURIComponent(pdfDate)}&period_end=${encodeURIComponent(pdfEnd || pdfDate)}`
    }
    setAttachmentStatus('Загрузка…')
    const data = await apiJson<{ configured?: boolean; documents?: AttachmentDoc[] }>(url)
    if (!data.configured) {
      setAttachmentStatus('RAG не настроен (DATABASE_URL).')
      setAttachments([])
      return
    }
    const docs = data.documents || []
    setAttachments(docs)
    setAttachmentMeta((prev) => {
      const next = { ...prev }
      for (const doc of docs) {
        const id = Number(doc.id)
        if (id > 0) {
          next[id] = {
            document_type: doc.document_type || '',
            title: doc.title || '',
            brief_date: doc.brief_date || '',
            period_end: doc.period_end || doc.brief_date || '',
          }
        }
      }
      return next
    })
    if (!docs.length) {
      setAttachmentStatus(filterByPeriod ? 'Нет документов за выбранный период.' : 'Документы не загружены.')
      return
    }
    setAttachmentStatus(`Всего: ${docs.length}`)
  }, [filterByPeriod, pdfDate, pdfEnd])

  const loadCleanupPrompt = useCallback(async (kind: string) => {
    const data = await apiJson<WeeklyStagePromptResponse & { prompt?: string }>(
      `/api/weekly/cleanup-prompt?brief_kind=${encodeURIComponent(kind || 'full')}`,
    )
    setCleanupPrompt(data.prompt || '')
    setCleanupPromptHint(
      data.customized
        ? 'Для clean-up сохранён ваш дефолтный промпт.'
        : 'Используется общий дефолтный prompt clean-up.',
    )
    setCleanupPromptHintKind(data.customized ? 'ok' : '')
  }, [])

  const loadPromptVariant = useCallback(
    async (variant: string) => {
      const params = new URLSearchParams({ variant })
      if (periodStart) params.set('period_start', periodStart)
      if (periodEnd) params.set('period_end', periodEnd)
      const data = await apiJson<WeeklyDefaultPromptResponse>(`/api/weekly/default-prompt?${params.toString()}`)
      const parts = resolveBriefPromptFields(data)
      setSystemPrompt(parts.system_prompt)
      setUserPrompt(parts.user_prompt)
      setPromptDefaultHint(
        data.customized ? 'Для этого типа сохранён ваш дефолтный промпт.' : 'Используется общий дефолтный промпт.',
      )
      setPromptDefaultHintKind(data.customized ? 'ok' : '')
      const nextKind = data.variant || variant
      setBriefKind(nextKind)
      await loadCleanupPrompt(nextKind)
      await loadPeriodSources(true, nextKind)
      await checkCoverage()
    },
    [periodStart, periodEnd, loadPeriodSources, checkCoverage, loadCleanupPrompt],
  )

  const savePromptDefault = async () => {
    const system = systemPrompt.trim()
    const user = userPrompt.trim()
    const prompt = joinBriefPrompt(system, user)
    if (prompt.length < 50) {
      setPromptDefaultHint('Промпт слишком короткий.')
      setPromptDefaultHintKind('err')
      return
    }
    const res = await apiFetch(
      '/api/weekly/default-prompt',
      jsonBody({
        variant: briefKind || 'full',
        system_prompt: system,
        user_prompt: user,
      }),
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPromptDefaultHint((data as { detail?: string }).detail || 'Не удалось сохранить дефолт.')
      setPromptDefaultHintKind('err')
      return
    }
    setPromptDefaultHint('Сохранено как ваш дефолтный промпт для этого типа.')
    setPromptDefaultHintKind('ok')
    await mapPromptCtl.saveIfDirty()
    await reducePromptCtl.saveIfDirty()
  }

  const resetPromptDefault = async () => {
    const variant = briefKind || 'full'
    const res = await apiFetch(`/api/weekly/default-prompt?variant=${encodeURIComponent(variant)}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPromptDefaultHint((data as { detail?: string }).detail || 'Не удалось сбросить дефолт.')
      setPromptDefaultHintKind('err')
      return
    }
    await loadPromptVariant(variant)
    setPromptDefaultHint('Возвращён общий дефолтный промпт.')
    setPromptDefaultHintKind('ok')
  }

  const saveCleanupPromptDefault = async () => {
    const prompt = cleanupPrompt.trim()
    if (prompt.length < 50) {
      setCleanupPromptHint('Промпт слишком короткий.')
      setCleanupPromptHintKind('err')
      return
    }
    const res = await apiFetch(
      '/api/weekly/cleanup-prompt',
      jsonBody({
        variant: `cleanup::${briefKind || 'full'}`,
        prompt,
      }),
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setCleanupPromptHint((data as { detail?: string }).detail || 'Не удалось сохранить дефолт.')
      setCleanupPromptHintKind('err')
      return
    }
    setCleanupPromptHint('Сохранено как ваш дефолтный clean-up prompt.')
    setCleanupPromptHintKind('ok')
  }

  const resetCleanupPromptDefault = async () => {
    const res = await apiFetch(`/api/weekly/cleanup-prompt?brief_kind=${encodeURIComponent(briefKind || 'full')}`, {
      method: 'DELETE',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setCleanupPromptHint((data as { detail?: string }).detail || 'Не удалось сбросить дефолт.')
      setCleanupPromptHintKind('err')
      return
    }
    await loadCleanupPrompt(briefKind || 'full')
    setCleanupPromptHint('Возвращён общий дефолтный clean-up prompt.')
    setCleanupPromptHintKind('ok')
  }

  const hideMapDigests = useCallback(() => {
    setMapDigestsVisible(false)
    setMapDigestItems([])
    setMapDigestCurrent(1)
    setMapDigestBody('—')
    setMapDigestMeta('')
    mapDigestCacheRef.current = new Map()
  }, [])

  const showMapDigest = useCallback(
    async (jobId: string, index: number, items: MapDigestSummaryItem[]) => {
      if (!jobId || !items.length) return
      const total = items.length
      const safeIndex = Math.min(Math.max(1, Number(index) || 1), total)
      setMapDigestCurrent(safeIndex)
      const cached = mapDigestCacheRef.current.get(safeIndex)
      if (cached) {
        setMapDigestBody(cached.content || '(пустой дайджест)')
        setMapDigestMeta(`${cached.materials ?? '—'} материалов · ${(cached.content || '').length} символов`)
        return
      }
      setMapDigestBody('Загрузка…')
      try {
        const data = await apiJson<MapDigestDetail>(`/api/jobs/${jobId}/map-digests/${safeIndex}`)
        mapDigestCacheRef.current.set(safeIndex, data)
        setMapDigestBody(data.content || '(пустой дайджест)')
        setMapDigestMeta(`${data.materials ?? '—'} материалов · ${(data.content || '').length} символов`)
      } catch {
        setMapDigestBody('Сбой соединения при загрузке дайджеста')
      }
    },
    [],
  )

  const renderMapDigestsSummary = useCallback(
    (jobId: string, items: MapDigestSummaryItem[]) => {
      if (!items.length) {
        hideMapDigests()
        return
      }
      mapDigestCacheRef.current = new Map()
      setMapDigestItems(items)
      setMapDigestsVisible(true)
      void showMapDigest(jobId, Number(items[0].index) || 1, items)
    },
    [hideMapDigests, showMapDigest],
  )

  const loadMapDigests = useCallback(
    async (id: string) => {
      try {
        const data = await apiJson<{ items?: MapDigestSummaryItem[] }>(`/api/jobs/${id}/map-digests`)
        renderMapDigestsSummary(id, data.items || [])
      } catch {
        hideMapDigests()
      }
    },
    [hideMapDigests, renderMapDigestsSummary],
  )

  useEffect(() => {
    void (async () => {
      await loadHealth()
      await loadPeriodSources()
      await loadAttachmentLibrary()
      await mapPromptCtl.load()
      await reducePromptCtl.load()
      await loadPromptVariant('full')
    })()
  }, [])

  useEffect(() => {
    if (skipPeriodReload.current) {
      skipPeriodReload.current = false
      return
    }
    void (async () => {
      await loadPeriodSources()
      await loadPromptVariant(briefKind)
    })()
  }, [periodStart, periodEnd])

  useEffect(() => {
    void loadAttachmentLibrary()
  }, [filterByPeriod, loadAttachmentLibrary])

  useEffect(() => {
    if (!periodStart || !periodEnd) return
    void checkCoverage()
  }, [checkCoverage, periodStart, periodEnd])

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (!hash) return
    const el = document.getElementById(hash)
    if (!el) return
    if (hash === 'attachmentLibrary') setLibraryCollapsed(false)
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    const tick = async () => {
      const next = await apiJson<Job>(`/api/jobs/${jobId}`)
      if (cancelled) return
      setJob(next)
      if (next.status === 'completed') {
        const content = next.result?.content || ''
        if (next.result?.brief_kind) setBriefKind(next.result.brief_kind)
        setBriefContent(content)
        setShowEditor(Boolean(content))
        const summary = next.result?.map_digests_summary
        if (Array.isArray(summary) && summary.length) {
          renderMapDigestsSummary(jobId, summary)
        } else {
          void loadMapDigests(jobId)
        }
        setBusy(false)
        setStopping(false)
      } else if (next.status === 'failed' || next.status === 'cancelled') {
        setBusy(false)
        setStopping(false)
      }
    }
    void tick()
    const timer = window.setInterval(() => void tick(), 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [jobId, loadMapDigests, renderMapDigestsSummary])

  const fileTypeHint = (() => {
    if (!files.length) return 'Тип подставится сам: PMI / PDF отчёт / Kallanish (в т.ч. из .txt).'
    const unique = [...new Set(files.map((file) => detectAttachmentDocumentType(file.name)).filter(Boolean))]
    if (unique.length === 1) {
      return files.length === 1 ? `Определено автоматически: ${unique[0]}` : `Для всех ${files.length} файлов: ${unique[0]}`
    }
    return `Смешанные типы: ${unique.join(', ')} — для каждого файла определится отдельно.`
  })()

  const uploadAttachments = async () => {
    if (!files.length) {
      window.alert('Выберите один или несколько файлов (PDF, Word или TXT).')
      return
    }
    const detected = [...new Set(files.map((file) => detectAttachmentDocumentType(file.name)).filter(Boolean))]
    const documentType = detected.length === 1 ? detected[0] : ''
    setUploadKind('')
    setUploadHint(`Загрузка и индексация ${files.length} файл(ов)…`)
    setBusy(true)
    const form = new FormData()
    form.append('date_str', pdfDate)
    form.append('period_end', pdfEnd || pdfDate)
    form.append('document_type', documentType)
    const endpoint = files.length === 1 ? '/api/rag/upload-document' : '/api/rag/upload-documents'
    if (files.length === 1) {
      form.append('file', files[0])
    } else {
      for (const file of files) form.append('files', file)
    }
    const res = await apiFetch(endpoint, { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setUploadKind('err')
      setUploadHint(data.detail || `Ошибка ${res.status}`)
      return
    }
    if (files.length === 1) {
      setUploadKind('ok')
      setUploadHint(`Проиндексировано: ${data.document_type}, ${data.chunks} чанков, «${data.title}»`)
    } else {
      const parts = [`Готово: ${data.uploaded_count} из ${data.total}`, `${data.chunks} чанков`, data.document_type]
      if (data.skipped_count) parts.push(`пропущено (дубликаты): ${data.skipped_count}`)
      if (data.failed_count) parts.push(`ошибок: ${data.failed_count}`)
      const details: string[] = []
      for (const item of data.uploaded || []) details.push(`✓ ${item.filename || item.title} (${item.document_type ? `${item.document_type}, ` : ''}${item.chunks} чанков)`)
      for (const item of data.skipped || []) details.push(`↷ ${item.filename}: уже в RAG`)
      for (const item of data.failed || []) details.push(`✕ ${item.filename}: ${item.reason}`)
      setUploadKind(data.failed_count ? 'err' : 'ok')
      setUploadHint(`${parts.join(' · ')}${details.length ? `\n${details.join('\n')}` : ''}`)
    }
    setFiles([])
    await loadAttachmentLibrary()
    await checkCoverage()
  }

  const deleteAttachment = async (id: number, title?: string) => {
    if (!window.confirm(`Удалить «${title || `документ #${id}`}» из RAG?`)) return
    await apiJson(`/api/rag/attachments/${id}`, { method: 'DELETE' })
    setAttachmentMeta((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await loadAttachmentLibrary()
    await checkCoverage()
  }

  const cleanupBrief = async () => {
    if (!jobId) {
      window.alert('Сначала сгенерируйте бриф.')
      return
    }
    const content = briefContent.trim()
    if (content.length < 50) {
      window.alert('Текст брифа слишком короткий.')
      return
    }
    setExportKind('')
    setExportHint('LLM clean-up выполняется…')
    setBusy(true)
    const res = await apiFetch(
      `/api/jobs/${jobId}/cleanup-brief`,
      jsonBody({ content, system_prompt: cleanupPrompt.trim() || null }),
    )
    const data = (await res.json().catch(() => ({}))) as CleanupBriefResponse & { detail?: string }
    setBusy(false)
    if (!res.ok) {
      setExportKind('err')
      setExportHint(data.detail || `Ошибка ${res.status}`)
      window.alert(data.detail || `Ошибка ${res.status}`)
      return
    }
    setBriefContent(data.content || content)
    setExportKind(data.cleanup_pass ? 'ok' : '')
    setExportHint(
      data.cleanup_pass ? 'Clean-up готов: текст обновлён.' : 'Clean-up завершён: оставлен исходный текст.',
    )
  }

  const startBrief = async () => {
    const prompt = joinBriefPrompt(systemPrompt, userPrompt)
    if (prompt.length < 50) {
      window.alert('Промпт слишком короткий.')
      return
    }
    if (!periodStart || !periodEnd) {
      window.alert('Укажите период.')
      return
    }
    const noNews = Array.isArray(selectedNewsPayload) && selectedNewsPayload.length === 0
    if (noNews && !anyDocSelected) {
      window.alert('Выберите хотя бы один источник (новости или документы: Kallanish / PDF / PMI).')
      return
    }
    if (noNews && anyDocSelected && !selectedAttachmentIds.length) {
      window.alert(
        `Выбраны только документы (${enabledTypes || '—'}), но в библиотеке нет файлов этих типов за период. Загрузите документы или добавьте новостные источники.`,
      )
      return
    }
    await mapPromptCtl.saveIfDirty()
    await reducePromptCtl.saveIfDirty()
    const payload: Record<string, unknown> = {
      period_start: periodStart,
      period_end: periodEnd,
      system_prompt: prompt,
      map_system_prompt: mapPromptCtl.valueForRequest(),
      reduce_instructions: reducePromptCtl.valueForRequest(),
      model: null,
      brief_kind: briefKind,
      attachment_ids: selectedAttachmentIds,
    }
    if (selectedNewsPayload !== null) payload.sources = selectedNewsPayload
    setBusy(true)
    setShowEditor(false)
    setBriefContent('')
    setExportHint('')
    setJob(null)
    hideMapDigests()
    const res = await apiFetch('/api/jobs/weekly-brief', jsonBody(payload))
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      window.alert(err.detail || `Ошибка ${res.status}`)
      setBusy(false)
      return
    }
    const data = await res.json()
    setJobId(data.job_id)
  }

  const stopBrief = async () => {
    if (!jobId) return
    setStopping(true)
    await apiFetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
  }

  const exportDocx = async () => {
    if (!jobId) {
      window.alert('Сначала сгенерируйте бриф.')
      return
    }
    if (briefContent.trim().length < 50) {
      window.alert('Текст брифа слишком короткий.')
      return
    }
    setExportKind('')
    setExportHint('Собираем Word…')
    setBusy(true)
    const res = await apiFetch(`/api/jobs/${jobId}/export-docx`, jsonBody({ content: briefContent }))
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setExportKind('err')
      setExportHint(data.detail || `Ошибка ${res.status}`)
      return
    }
    setExportKind('ok')
    setExportHint(`Готово: ${data.docx_filename}`)
    window.location.href = data.download_url || `/api/jobs/${jobId}/download`
  }

  const exportJson = async () => {
    if (!jobId || !monthly) return
    if (briefContent.trim().length < 50) {
      window.alert('Текст брифа слишком короткий.')
      return
    }
    setExportKind('')
    setExportHint('Собираем JSON…')
    setBusy(true)
    const res = await apiFetch(`/api/jobs/${jobId}/export-json`, jsonBody({ content: briefContent }))
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setExportKind('err')
      setExportHint(data.detail || `Ошибка ${res.status}`)
      return
    }
    setExportKind('ok')
    setExportHint(`Готово: ${data.json_filename} (${data.slides || 0} слайдов)`)
    window.location.href = data.download_url || `/api/jobs/${jobId}/download-json`
  }

  const toggleLibrary = () => {
    const next = !libraryCollapsed
    setLibraryCollapsed(next)
    localStorage.setItem('nav.attachmentLibrary.collapsed', next ? '1' : '0')
  }

  const coverageIcon = coverage.state === 'ready' ? '✓' : coverage.state === 'warn' ? '!' : coverage.state === 'missing' ? '✕' : 'ℹ'
  const jobDone = job?.status === 'completed'
  const jobFailed = job?.status === 'failed' || job?.status === 'cancelled'
  const barClass = generating ? styles.running : jobDone ? styles.done : jobFailed ? styles.failed : ''

  return (
    <>
      <Card className={styles.statusBar}>
        <span className={`${styles.badge} ${health?.openrouter_configured ? styles.ok : styles.err}`}>
          {health ? (health.openrouter_configured ? 'OpenRouter OK' : 'Нет OPENROUTER_API_KEY') : 'Проверка…'}
        </span>
        <span className={styles.hint}>Модель: {health?.default_model || '—'}</span>
        <span className={`${styles.hint} ${health?.pgvector_configured ? styles.okText : styles.warnText}`}>
          {health?.pgvector_configured ? 'PostgreSQL + pgvector: подключено' : 'PostgreSQL: не настроен (DATABASE_URL)'}
        </span>
      </Card>

      <Card id='attachmentPanel' title='Дополнительные документы в RAG'>
        <p className={styles.help}>
          Прикрепите PDF, Word или TXT — можно выбрать несколько файлов сразу. Тип определяется по имени: PMI, Kallanish (в т.ч. massmail `.txt`), иначе PDF отчёт / Kallanish.
        </p>
        <div className={styles.row}>
          <label>
            Дата (начало)
            <input type='date' value={pdfDate} onChange={(e) => setPdfDate(e.target.value)} />
          </label>
          <label>
            Конец периода
            <input type='date' value={pdfEnd} onChange={(e) => setPdfEnd(e.target.value)} />
          </label>
        </div>
        <div className={styles.row}>
          <label>
            Файлы
            <input
              type='file'
              multiple
              accept='.pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              onChange={(e) => setFiles(e.target.files ? [...e.target.files] : [])}
            />
          </label>
          <Button onClick={() => void uploadAttachments()} disabled={busy}>
            Загрузить в RAG
          </Button>
        </div>
        <p className={styles.hint}>{fileTypeHint}</p>
        {files.length ? <p className={styles.hint}>Выбрано файлов: {files.length}</p> : null}
        {uploadHint ? <p className={`${styles.uploadHint} ${uploadKind === 'ok' ? styles.okText : ''} ${uploadKind === 'err' ? styles.errText : ''}`}>{uploadHint}</p> : null}
      </Card>

      <Card id='attachmentLibrary' className={libraryCollapsed ? styles.collapsed : ''}>
        <button type='button' className={styles.collapseHeader} onClick={toggleLibrary} aria-expanded={!libraryCollapsed}>
          <span className={styles.chevron} aria-hidden='true'>
            ▾
          </span>
          <span>Библиотека документов</span>
          <span className={styles.countBadge}>
            {attachments.length}
            {filterByPeriod ? ' · фильтр' : ''}
          </span>
        </button>
        {!libraryCollapsed ? (
          <div>
            <p className={styles.help}>
              PDF, Kallanish и PMI в RAG. Все файлы за период брифа («С» / «По») участвуют в генерации, если их тип включён в источниках (Kallanish / PDF отчёт / PMI).
            </p>
            <div className={styles.toolbar}>
              <label className={styles.check}>
                <input type='checkbox' checked={filterByPeriod} onChange={(e) => setFilterByPeriod(e.target.checked)} />
                Только за период загрузки выше
              </label>
              <Button size='sm' onClick={() => void loadAttachmentLibrary()} disabled={busy}>
                Обновить список
              </Button>
              <span className={styles.hint}>{attachmentHint}</span>
            </div>
            <div className={styles.tableWrap}>
              {!attachments.length ? <p className={styles.hint}>{attachmentStatus}</p> : null}
              {attachments.length ? (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Название</th>
                      <th>Период</th>
                      <th>Чанков</th>
                      <th>Загрузил</th>
                      <th>Дата</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachments.map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.document_type || '—'}</td>
                        <td>{doc.title || '—'}</td>
                        <td>{formatAttachmentPeriod(doc.brief_date, doc.period_end)}</td>
                        <td>{doc.chunks ?? 0}</td>
                        <td>{doc.indexed_by || '—'}</td>
                        <td>{formatCreatedAt(doc.created_at)}</td>
                        <td>
                          <Button size='sm' variant='danger' onClick={() => void deleteAttachment(doc.id, doc.title || doc.document_type)}>
                            Удалить
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <Card id='periodPanel' title='1. Период'>
        <p className={styles.help}>Диапазон дат для брифа. Перед генерацией проверьте, что новости за период проиндексированы в RAG.</p>
        <div className={styles.period}>
          <label>
            С
            <input
              type='date'
              value={periodStart}
              onChange={(e) => {
                setPeriodStart(e.target.value)
              }}
            />
          </label>
          <span className={styles.sep}>→</span>
          <label>
            По
            <input type='date' value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </label>
          <Button
            onClick={() => {
              void (async () => {
                await loadPeriodSources()
                await checkCoverage()
              })()
            }}
          >
            Проверить индекс
          </Button>
        </div>
        {coverage.message ? (
          <div className={`${styles.coverage} ${styles[coverage.state] || ''}`}>
            <span className={styles.coverageIcon}>{coverageIcon}</span>
            <p>{coverage.message}</p>
          </div>
        ) : null}
      </Card>

      <Card id='sourcesPanel' title='2. Источники'>
        <p className={styles.help}>
          Источники сгруппированы по категориям. Свои Telegram-каналы — в разделе <Link to='/sources'>Свои источники</Link>.
        </p>
        <div className={styles.toolbar}>
          <Button
            size='sm'
            onClick={() => {
              setSelectedSources(
                new Set(sources.filter((item) => (briefKindMatch[briefKind] || briefKindMatch.full).includes(item.brief || 'all')).map((item) => item.name)),
              )
              void checkCoverage()
            }}
          >
            По типу брифа
          </Button>
          <Button
            size='sm'
            onClick={() => {
              setSelectedSources(new Set(sources.map((item) => item.name)))
              void checkCoverage()
            }}
          >
            Все
          </Button>
          <Button
            size='sm'
            onClick={() => {
              setSelectedSources(new Set())
              void checkCoverage()
            }}
          >
            Снять все
          </Button>
          <span className={styles.hint}>{sourceHint}</span>
        </div>
        <SourceGroups
          sources={sources}
          selected={selectedSources}
          briefKind={briefKind}
          briefKindMatch={briefKindMatch}
          briefLabels={briefLabels}
          onToggle={(name) => {
            setSelectedSources((prev) => {
              const next = new Set(prev)
              if (next.has(name)) next.delete(name)
              else next.add(name)
              return next
            })
          }}
          onToggleTopic={(items) => {
            const names = items.map((item) => item.name)
            const allSelected = names.every((name) => selectedSources.has(name))
            setSelectedSources((prev) => {
              const next = new Set(prev)
              names.forEach((name) => (allSelected ? next.delete(name) : next.add(name)))
              return next
            })
          }}
        />
      </Card>

      <Card id='promptPanel' title='3. Промпты брифа'>
        <p className={styles.help}>
          Шаблоны брифа. Смена типа подставляет обе части. Источники пользователь выбирает сам. При генерации обе половины склеиваются в один промпт.
        </p>
        <div className={styles.toolbar}>
          <Button onClick={() => void loadPromptVariant('full')} disabled={busy}>
            Полный бриф
          </Button>
          <Button onClick={() => void loadPromptVariant('market')} disabled={busy}>
            Рыночный бриф
          </Button>
          <Button onClick={() => void loadPromptVariant('corporate')} disabled={busy}>
            Новостной бриф
          </Button>
          <Button onClick={() => void loadPromptVariant('monthly_news')} disabled={busy}>
            Ежемесячный новостной бриф
          </Button>
          <Button onClick={() => void loadPromptVariant('monthly_market')} disabled={busy}>
            Ежемесячный рыночный бриф
          </Button>
        </div>
        <p className={styles.hint}>Тип брифа: {BRIEF_KIND_LABELS[briefKind] || briefKind}</p>
        <p className={styles.fieldLabel}>
          <strong>Системный промпт</strong>
        </p>
        <p className={styles.help}>Роль, стиль, критические требования — всё до блока «ОБЯЗАТЕЛЬНАЯ СТРУКТУРА».</p>
        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={12} placeholder='Системный промпт…' />
        <p className={styles.fieldLabel}>
          <strong>Пользовательский промпт</strong>
        </p>
        <p className={styles.help}>
          Обязательная структура отчёта — нижнее поле. Граница ищется по заголовку («ОБЯЗАТЕЛЬНАЯ СТРУКТУРА», «Структура отчета», ##-заголовок или нумерации «0./1. …»). При сохранении «мой дефолт» две части хранятся раздельно, поэтому кастомные промпты не слетают после перезагрузки.
        </p>
        <textarea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} rows={14} placeholder='ОБЯЗАТЕЛЬНАЯ СТРУКТУРА…' />
        <div className={styles.toolbar}>
          <Button size='sm' onClick={() => void savePromptDefault()} disabled={busy}>
            Сделать моим дефолтом
          </Button>
          <Button size='sm' onClick={() => void resetPromptDefault()} disabled={busy}>
            Сбросить мой дефолт
          </Button>
          <span className={`${styles.hint} ${promptDefaultHintKind === 'ok' ? styles.okText : ''} ${promptDefaultHintKind === 'err' ? styles.errText : ''}`}>
            {promptDefaultHint}
          </span>
        </div>

        <details className={styles.promptAdvanced} open={mapPromptCtl.detailsOpen}>
          <summary>
            <strong>Промпт фактографа (map-этап)</strong>
          </summary>
          <p className={styles.help}>
            Этим промптом модель обрабатывает каждый батч новостей и собирает фактографический дайджест (даты, цифры, компании, ссылки на источники). Затем дайджесты идут в основной промпт брифа. Промпт общий для всех типов брифа и сохраняется отдельно на вашего пользователя (кнопка ниже, автосохранение при уходе из поля и при запуске брифа). Обязательно сохраняйте формат ссылок «[n]» — иначе список источников в конце брифа не соберётся.
          </p>
          <textarea
            value={mapPromptCtl.value}
            onChange={(e) => mapPromptCtl.setValue(e.target.value)}
            onBlur={mapPromptCtl.onBlur}
            rows={14}
            placeholder='Промпт фактографа…'
          />
          <div className={styles.toolbar}>
            <Button size='sm' onClick={() => void mapPromptCtl.saveDefault()} disabled={busy}>
              Сделать моим дефолтом
            </Button>
            <Button size='sm' onClick={() => void mapPromptCtl.resetDefault()} disabled={busy}>
              Сбросить мой дефолт
            </Button>
            <span className={`${styles.hint} ${mapPromptCtl.hintKind === 'ok' ? styles.okText : ''} ${mapPromptCtl.hintKind === 'err' ? styles.errText : ''}`}>
              {mapPromptCtl.hint}
            </span>
          </div>
        </details>

        <details className={styles.promptAdvanced} open={reducePromptCtl.detailsOpen}>
          <summary>
            <strong>Промпт склейки (reduce-этап)</strong>
          </summary>
          <p className={styles.help}>
            Инструкции, с которыми модель собирает дайджесты всех батчей в ОДИН итоговый бриф. Структура и тон берутся из промптов брифа выше — здесь только правила склейки (дедупликация, перенос цифр в разделы, запрет выдумывать). Период, тип брифа, правила по ссылкам «[n]» и сами дайджесты система добавляет автоматически. Промпт общий для всех типов брифа и сохраняется на вашего пользователя (кнопка ниже, автосохранение при уходе из поля и при запуске брифа).
          </p>
          <textarea
            value={reducePromptCtl.value}
            onChange={(e) => reducePromptCtl.setValue(e.target.value)}
            onBlur={reducePromptCtl.onBlur}
            rows={10}
            placeholder='Инструкции reduce-этапа…'
          />
          <div className={styles.toolbar}>
            <Button size='sm' onClick={() => void reducePromptCtl.saveDefault()} disabled={busy}>
              Сделать моим дефолтом
            </Button>
            <Button size='sm' onClick={() => void reducePromptCtl.resetDefault()} disabled={busy}>
              Сбросить мой дефолт
            </Button>
            <span className={`${styles.hint} ${reducePromptCtl.hintKind === 'ok' ? styles.okText : ''} ${reducePromptCtl.hintKind === 'err' ? styles.errText : ''}`}>
              {reducePromptCtl.hint}
            </span>
          </div>
        </details>
      </Card>

      <Card title='4. Модель'>
        <p className={styles.model}>{health?.default_model || '—'}</p>
      </Card>

      <Card title='5. Генерация'>
        <div className={styles.toolbar}>
          <Button variant='primary' onClick={() => void startBrief()} disabled={busy}>
            Сгенерировать бриф
          </Button>
          {generating ? (
            <Button variant='danger' onClick={() => void stopBrief()} disabled={stopping}>
              {stopping ? 'Останавливаем…' : 'Остановить'}
            </Button>
          ) : null}
        </div>
      </Card>

      {jobId ? (
        <Card title='Ход выполнения'>
          <div className={styles.progressWrap}>
            <div className={`${styles.progressBar} ${barClass}`} />
          </div>
          <p className={styles.jobStatus}>
            {job?.cancel_requested ? 'stopping…' : job?.error ? `Ошибка: ${job.error}` : job?.status || 'Запуск…'}
          </p>
          <pre className={styles.log}>{(job?.logs || []).join('\n')}</pre>
        </Card>
      ) : null}

      {mapDigestsVisible && jobId && mapDigestItems.length ? (
        <Card title={`Результаты map-этапа по батчам (${mapDigestItems.length})`}>
          <p className={styles.help}>Что фактограф вывел по каждому батчу материалов до сборки финального брифа. Выберите батч, чтобы прочитать его дайджест.</p>
          <div className={styles.mapDigestToolbar}>
            <label className={styles.mapDigestLabel}>
              Батч
              <select
                className={styles.mapDigestSelect}
                value={String(mapDigestCurrent)}
                onChange={(e) => void showMapDigest(jobId, Number(e.target.value), mapDigestItems)}
              >
                {mapDigestItems.map((item, i) => {
                  const index = Number(item.index) || i + 1
                  const materials = Number(item.materials) || 0
                  const chars = Number(item.chars) || 0
                  const total = mapDigestItems.length
                  return (
                    <option key={index} value={index}>
                      {`Батч ${index} из ${total} · ${materials} материалов · ${Math.round(chars / 1000)}k симв.`}
                    </option>
                  )
                })}
              </select>
            </label>
            <Button size='sm' disabled={mapDigestCurrent <= 1} onClick={() => void showMapDigest(jobId, mapDigestCurrent - 1, mapDigestItems)} title='Предыдущий батч'>
              ←
            </Button>
            <Button
              size='sm'
              disabled={mapDigestCurrent >= mapDigestItems.length}
              onClick={() => void showMapDigest(jobId, mapDigestCurrent + 1, mapDigestItems)}
              title='Следующий батч'
            >
              →
            </Button>
            <Button
              size='sm'
              onClick={() => {
                const item = mapDigestCacheRef.current.get(mapDigestCurrent)
                const text = item?.content || ''
                if (!text) return
                void navigator.clipboard.writeText(text).then(
                  () => {
                    setMapDigestCopyLabel('Скопировано')
                    window.setTimeout(() => setMapDigestCopyLabel('Скопировать'), 1500)
                  },
                  () => setMapDigestCopyLabel('Не удалось скопировать'),
                )
              }}
            >
              {mapDigestCopyLabel}
            </Button>
            <a className={styles.downloadLink} href={mapDigestsDocxPath(jobId)} download>
              Скачать все батчи Word
            </a>
            {mapDigestMeta ? <span className={styles.hint}>{mapDigestMeta}</span> : null}
          </div>
          <pre className={styles.mapDigestBody}>{mapDigestBody}</pre>
        </Card>
      ) : null}

      {showEditor ? (
        <Card title='6. Редактирование брифа'>
          <p className={styles.help}>
            {monthly
              ? 'Проверьте и поправьте текст. При необходимости нажмите LLM clean-up, затем Word или JSON для презентации.'
              : 'Проверьте и поправьте текст. При необходимости нажмите LLM clean-up, затем «Скачать Word».'}
          </p>
          <p className={styles.fieldLabel}>
            <strong>Промпт для LLM clean-up</strong>
          </p>
          <p className={styles.help}>Этот промпт используется только когда вы нажимаете LLM clean-up в предпросмотре.</p>
          <textarea value={cleanupPrompt} onChange={(e) => setCleanupPrompt(e.target.value)} rows={10} placeholder='Промпт для clean-up…' />
          <div className={styles.toolbar}>
            <Button size='sm' onClick={() => void saveCleanupPromptDefault()} disabled={busy}>
              Сделать моим дефолтом
            </Button>
            <Button size='sm' onClick={() => void resetCleanupPromptDefault()} disabled={busy}>
              Сбросить мой дефолт
            </Button>
            <span
              className={`${styles.hint} ${cleanupPromptHintKind === 'ok' ? styles.okText : ''} ${cleanupPromptHintKind === 'err' ? styles.errText : ''}`}
            >
              {cleanupPromptHint}
            </span>
          </div>
          <textarea value={briefContent} onChange={(e) => setBriefContent(e.target.value)} rows={22} placeholder='Текст брифа появится после генерации…' />
          <div className={styles.toolbar}>
            <Button onClick={() => void cleanupBrief()} disabled={busy}>
              LLM clean-up
            </Button>
            <Button variant='primary' onClick={() => void exportDocx()} disabled={busy}>
              Скачать Word
            </Button>
            {monthly ? (
              <Button onClick={() => void exportJson()} disabled={busy}>
                Скачать JSON
              </Button>
            ) : null}
            <span className={`${styles.hint} ${exportKind === 'ok' ? styles.okText : ''} ${exportKind === 'err' ? styles.errText : ''}`}>{exportHint}</span>
          </div>
        </Card>
      ) : null}
    </>
  )
}
