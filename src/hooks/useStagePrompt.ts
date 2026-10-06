import { useCallback, useRef, useState } from 'react'

import { apiFetch } from '~/api/client'
import type { WeeklyStagePromptResponse } from '~/api/types'

type HintKind = '' | 'ok' | 'err'

export function useStagePrompt(endpoint: string, variant: string, title: string) {
  const [value, setValue] = useState('')
  const [loadedValue, setLoadedValue] = useState('')
  const [customized, setCustomized] = useState(false)
  const [hint, setHint] = useState('')
  const [hintKind, setHintKind] = useState<HintKind>('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const savingRef = useRef(false)

  const setHintMessage = useCallback((text: string, kind: HintKind = '') => {
    setHint(text)
    setHintKind(kind)
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(endpoint)
      const data = (await res.json()) as WeeklyStagePromptResponse & { detail?: string }
      if (!res.ok) {
        setHintMessage(data.detail || `Не удалось загрузить ${title}.`, 'err')
        return
      }
      const prompt = data.prompt || ''
      setLoadedValue(prompt)
      setValue(prompt)
      const isCustom = Boolean(data.customized)
      setCustomized(isCustom)
      if (isCustom) setDetailsOpen(true)
      setHintMessage(
        isCustom ? `Сохранён ваш дефолтный ${title}.` : `Используется общий дефолтный ${title}.`,
        isCustom ? 'ok' : '',
      )
    } catch {
      setHintMessage(`Не удалось загрузить ${title}.`, 'err')
    }
  }, [endpoint, setHintMessage, title])

  const valueForRequest = useCallback((): string | null => {
    const trimmed = value.trim()
    return trimmed || null
  }, [value])

  const isDirty = useCallback(() => value.trim() !== (loadedValue || '').trim(), [value, loadedValue])

  const saveDefault = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const prompt = value.trim()
      if (prompt.length < 50) {
        if (!silent) setHintMessage('Промпт слишком короткий.', 'err')
        return false
      }
      if (savingRef.current) return false
      savingRef.current = true
      try {
        const res = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variant, prompt }),
        })
        const data = (await res.json().catch(() => ({}))) as { detail?: string }
        if (!res.ok) {
          setHintMessage(data.detail || 'Не удалось сохранить дефолт.', 'err')
          return false
        }
        setLoadedValue(prompt)
        setCustomized(true)
        setDetailsOpen(true)
        setHintMessage(
          silent ? `Автосохранено: ваш дефолтный ${title}.` : `Сохранено как ваш дефолтный ${title}.`,
          'ok',
        )
        return true
      } finally {
        savingRef.current = false
      }
    },
    [endpoint, setHintMessage, title, value, variant],
  )

  const resetDefault = useCallback(async () => {
    const res = await apiFetch(endpoint, { method: 'DELETE' })
    const data = (await res.json().catch(() => ({}))) as { detail?: string }
    if (!res.ok) {
      setHintMessage(data.detail || 'Не удалось сбросить дефолт.', 'err')
      return
    }
    setCustomized(false)
    await load()
    setHintMessage(`Возвращён общий дефолтный ${title}.`, 'ok')
  }, [endpoint, load, setHintMessage, title])

  const saveIfDirty = useCallback(async () => {
    if (!isDirty()) return false
    return saveDefault({ silent: true })
  }, [isDirty, saveDefault])

  const onBlur = useCallback(() => {
    void saveIfDirty()
  }, [saveIfDirty])

  return {
    value,
    setValue,
    customized,
    hint,
    hintKind,
    detailsOpen,
    setDetailsOpen,
    load,
    saveDefault,
    resetDefault,
    saveIfDirty,
    valueForRequest,
    onBlur,
  }
}
