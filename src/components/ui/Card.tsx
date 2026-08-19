import type { ReactNode } from 'react'

import styles from './Card.module.scss'

type Props = {
  id?: string
  title?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ id, title, children, className }: Props) {
  return (
    <section id={id} className={[styles.card, className].filter(Boolean).join(' ')}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  )
}
