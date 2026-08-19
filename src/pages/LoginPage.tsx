import { FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { useAuth } from '~/context/AuthContext'
import { errorDetail } from '~/lib/errors'

import styles from './AuthPage.module.scss'

export function LoginPage() {
  const { user, loading, refresh } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to='/' replace />
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ login: login.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(errorDetail(data, 'Неверный логин или пароль'))
        return
      }
      await refresh()
    } catch {
      setError('Сервер недоступен')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.card}>
      <h1>Стратегический навигатор</h1>
      <p className={styles.subtitle}>Вход для сотрудников</p>
      {error ? <div className={styles.error}>{error}</div> : null}
      <form onSubmit={(event) => void onSubmit(event)}>
        <label className={styles.field}>
          Логин
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete='username' required />
        </label>
        <label className={styles.field}>
          Пароль
          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='current-password'
            required
          />
        </label>
        <button type='submit' className={styles.submit} disabled={submitting}>
          Войти
        </button>
      </form>
      <p className={styles.footer}>
        Первый раз? <Link to='/register'>Регистрация</Link> (только для разрешённых аккаунтов)
      </p>
    </div>
  )
}
