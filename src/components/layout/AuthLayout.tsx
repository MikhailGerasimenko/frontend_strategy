import type { ReactNode } from 'react'
import { FooterSecondary, HeaderEcom } from 'svs-react-ui'

import { footerMockData } from '~/components/footerMockData'

import styles from './AuthLayout.module.scss'

type Props = {
  dark: boolean
  onThemeChange: (value: boolean) => void
  children: ReactNode
}

export function AuthLayout({ dark, onThemeChange, children }: Props) {
  return (
    <>
      <HeaderEcom needCatalogModal={false} onThemeChange={onThemeChange} isDarkTheme={dark} />
      <main className={styles.main}>{children}</main>
      <FooterSecondary
        contacts={footerMockData.contacts}
        links={footerMockData.links}
        socialLinks={footerMockData.socialLinks}
        copyrightText={footerMockData.copyrightText}
      />
    </>
  )
}
