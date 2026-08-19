import type { ButtonHTMLAttributes, ReactNode } from 'react'

import styles from './Button.module.scss'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'md' | 'sm'
  children: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', children, ...props }: Props) {
  const classes = [styles.btn, styles[variant], size === 'sm' ? styles.sm : '', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  )
}
