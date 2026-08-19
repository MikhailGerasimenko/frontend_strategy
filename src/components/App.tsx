import { useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DefaultThemeProvider } from 'svs-react-ui'

import { AppLayout } from '~/components/layout/AppLayout'
import { AuthLayout } from '~/components/layout/AuthLayout'
import { AuthProvider, useAuth } from '~/context/AuthContext'
import { AgentPage } from '~/pages/AgentPage'
import { LoginPage } from '~/pages/LoginPage'
import { PeriodBriefPage } from '~/pages/PeriodBriefPage'
import { RegisterPage } from '~/pages/RegisterPage'
import { SourcesPage } from '~/pages/SourcesPage'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p style={{ padding: '2rem' }}>Загрузка…</p>
  if (!user) return <Navigate to='/login' replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function ThemedApp() {
  const [dark, setDark] = useState(false)

  return (
    <DefaultThemeProvider dark={dark}>
      <Routes>
        <Route
          path='/login'
          element={
            <AuthLayout dark={dark} onThemeChange={setDark}>
              <LoginPage />
            </AuthLayout>
          }
        />
        <Route
          path='/register'
          element={
            <AuthLayout dark={dark} onThemeChange={setDark}>
              <RegisterPage />
            </AuthLayout>
          }
        />
        <Route
          path='/'
          element={
            <Protected>
              <AppLayout title='Бриф за период' subtitle='Генерация брифа из RAG-базы (сырые новости + PDF-отчёты)' dark={dark} onThemeChange={setDark}>
                <PeriodBriefPage />
              </AppLayout>
            </Protected>
          }
        />
        <Route path='/weekly' element={<Navigate to='/' replace />} />
        <Route
          path='/agent'
          element={
            <Protected>
              <AppLayout
                title='ИИ-агент'
                subtitle='Обычный чат + поиск по базе новостей и документов со ссылками'
                extraSectionLinks={[{ to: '/agent', hash: 'agentPromptPanel', label: 'Промпт агента' }]}
                dark={dark}
                onThemeChange={setDark}
              >
                <AgentPage />
              </AppLayout>
            </Protected>
          }
        />
        <Route
          path='/sources'
          element={
            <Protected>
              <AppLayout title='Свои источники' subtitle='Публичные Telegram-каналы, которые коллеги добавляют сами' dark={dark} onThemeChange={setDark}>
                <SourcesPage />
              </AppLayout>
            </Protected>
          }
        />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </DefaultThemeProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemedApp />
      </AuthProvider>
    </BrowserRouter>
  )
}
