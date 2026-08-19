import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { apiJson } from '~/api/client'
import type { AccountOverview } from '~/api/types'
import { useAuth } from '~/context/AuthContext'
import { errorDetail } from '~/lib/errors'

import styles from './AuthPage.module.scss'

export function RegisterPage() {
  const { user, loading, refresh } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('Латиница, 3–32 символа. Логин должен быть выдан администратором.')
  const [hintKind, setHintKind] = useState('')
  const [overview, setOverview] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiJson<{ accounts?: AccountOverview[] }>('/api/auth/accounts-overview')
        const lines = (data.accounts || []).map((account) => {
          if (account.can_register) return `${account.login} — можно зарегистрироваться`
          if (account.registered) return `${account.login} (${account.full_name}) — уже есть, войдите`
          return `${account.login} — недоступен`
        })
        setOverview(lines.join(' · '))
      } catch {
        setOverview('')
      }
    })()
  }, [])

  useEffect(() => {
    const value = login.trim()
    if (value.length < 3) {
      setHint('Введите логин (минимум 3 символа)')
      setHintKind('')
      return
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/auth/check-login?login=${encodeURIComponent(value)}`, { credentials: 'same-origin' })
          const data = await res.json()
          if (!data.allowed) {
            setHint('Логин не в списке разрешённых. Обратитесь к администратору.')
            setHintKind('err')
          } else if (data.registered) {
            setHint('Уже зарегистрирован — перейдите на страницу входа.')
            setHintKind('err')
          } else {
            setHint(`Можно зарегистрироваться: ${data.full_name || data.login}`)
            setHintKind('ok')
          }
        } catch {
          setHint('')
        }
      })()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [login])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ login: login.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        let msg = errorDetail(data, 'Ошибка регистрации')
        if (msg.includes('уже зарегистрирован')) {
          msg += ' Перейдите на страницу входа.'
        }
        setError(msg)
        return
      }
      await refresh()
    } catch {
      setError('Сервер недоступен')
    } finally {
      setSubmitting(false)
    }
  }

  if (!loading && user) {
    return <Navigate to='/' replace />
  }

  return (
    <div className={styles.card}>
      <h1>Регистрация</h1>
      <p className={styles.subtitle}>
        Только для логинов из списка разрешённых. Если аккаунт уже создан — используйте <Link to='/login'>вход</Link>.
      </p>
      {overview ? <p className={styles.hint}>{overview}</p> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      <form onSubmit={(event) => void onSubmit(event)}>
        <label className={styles.field}>
          Логин
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete='username' required />
          <span className={`${styles.hint} ${hintKind === 'ok' ? styles.ok : ''} ${hintKind === 'err' ? styles.err : ''}`}>{hint}</span>
        </label>
        <label className={styles.field}>
          Пароль
          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='new-password'
            minLength={5}
            required
          />
          <span className={styles.hint}>Не короче 5 символов</span>
        </label>
        <label className={styles.field}>
          Повторите пароль
          <input
            type='password'
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete='new-password'
            minLength={5}
            required
          />
        </label>
        <button type='submit' className={styles.submit} disabled={submitting}>
          Зарегистрироваться
        </button>
      </form>
      <p className={styles.footer}>
        Уже есть аккаунт? <Link to='/login'>Войти</Link>
      </p>
    </div>
  )
}
