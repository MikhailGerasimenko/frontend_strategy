import { NavLink, useLocation } from 'react-router-dom'

import { Button } from '~/components/ui/Button'
import { useAuth } from '~/context/AuthContext'

import styles from './Sidebar.module.scss'

type NavItem = {
  to: string
  label: string
  hash?: string
}

const DATA_LINKS: NavItem[] = [
  { to: '/', hash: 'attachmentPanel', label: 'Дополнительные документы в RAG' },
  { to: '/', hash: 'attachmentLibrary', label: 'Библиотека документов' },
  { to: '/sources', label: 'Свои источники' },
]

const BRIEF_LINKS: NavItem[] = [
  { to: '/', hash: 'sourcesPanel', label: 'Источники' },
  { to: '/', hash: 'promptPanel', label: 'Системный промпт' },
  { to: '/', hash: 'periodPanel', label: 'Бриф за период' },
]

type Props = {
  extraSectionLinks?: NavItem[]
}

function itemPath(item: NavItem): string {
  return item.hash ? `${item.to}#${item.hash}` : item.to
}

function isActiveItem(item: NavItem, pathname: string, hash: string): boolean {
  if (item.to !== pathname) return false
  if (!item.hash) return true
  const current = hash.replace('#', '') || (pathname === '/' ? 'periodPanel' : '')
  return current === item.hash
}

export function Sidebar({ extraSectionLinks = [] }: Props) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const name = user?.full_name || user?.login || '—'
  const label = user?.is_admin ? `${name} (админ)` : name

  const renderLink = (item: NavItem) => (
    <NavLink
      key={item.label}
      to={itemPath(item)}
      className={() => [styles.link, isActiveItem(item, location.pathname, location.hash) ? styles.active : ''].join(' ')}
    >
      {item.label}
    </NavLink>
  )

  return (
    <aside className={styles.sidebar} aria-label='Навигация'>
      <nav className={styles.nav}>
        <p className={styles.group}>Данные</p>
        {DATA_LINKS.map(renderLink)}
        <p className={styles.group}>Бриф</p>
        {BRIEF_LINKS.map(renderLink)}
        <p className={styles.group}>Разделы</p>
        {extraSectionLinks.map(renderLink)}
        <NavLink to='/agent' className={({ isActive }) => [styles.link, isActive ? styles.active : ''].join(' ')}>
          Агент
        </NavLink>
      </nav>
      <div className={styles.footer}>
        <span className={styles.user}>{label}</span>
        <Button variant='ghost' size='sm' onClick={() => void logout()}>
          Выйти
        </Button>
      </div>
    </aside>
  )
}
