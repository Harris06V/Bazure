import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ToolButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean
  icon?: boolean
  action?: boolean
  children: ReactNode
}

export function ToolButton({
  active = false,
  icon = false,
  action = false,
  className,
  children,
  type = 'button',
  ...props
}: ToolButtonProps) {
  const classes = [
    'tool-btn',
    icon ? 'icon' : '',
    action ? 'text-action' : '',
    active ? 'is-active' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  )
}
