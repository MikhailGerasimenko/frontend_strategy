import type { ReactNode } from 'react'
import { FooterSecondary, HeaderEcom } from 'svs-react-ui'

import { footerMockData } from '~/components/footerMockData'
import { Sidebar } from '~/components/layout/Sidebar'

import styles from './AppLayout.module.scss'

type Props = {
  title: string
  subtitle?: string
  extraSectionLinks?: { to: string; label: string; hash?: string }[]
  children: ReactNode
  dark: boolean
  onThemeChange: (value: boolean) => void
}

export function AppLayout({ title, subtitle, extraSectionLinks, children, dark, onThemeChange }: Props) {
  return (
    <>
      <HeaderEcom needCatalogModal={false} onThemeChange={onThemeChange} isDarkTheme={dark} />
      <div className={styles.shell}>
        <Sidebar extraSectionLinks={extraSectionLinks} />
        <div className={styles.content}>
          <header className={styles.pageHeader}>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </header>
          <main className={styles.main}>{children}</main>
        </div>
      </div>
      <FooterSecondary
        contacts={footerMockData.contacts}
        links={footerMockData.links}
        socialLinks={footerMockData.socialLinks}
        copyrightText={footerMockData.copyrightText}
      />
    </>
  )
}
