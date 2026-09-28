import type { ReactNode } from 'react'
import type { Markup } from '../../lib/pdf/markup'
import { useMarkupStore } from '../../state/markupStore'
import { useViewerStore } from '../../state/viewerStore'

export function NeedsPdf({ children }: { children: ReactNode }) {
  const ready = useViewerStore((state) => state.status === 'ready')
  if (!ready) return <p className="panel-note">Open a PDF to use this tool.</p>
  return children
}

export function TaskStatus({ pending, error }: { pending: string | null; error: string | null }) {
  if (error) {
    return (
      <p className="panel-error" role="alert">
        {error}
      </p>
    )
  }
  if (pending) {
    return (
      <p className="panel-note" role="status">
        {pending}
      </p>
    )
  }
  return null
}

export function ChoiceButton({
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={active ? 'stack-btn is-active' : 'stack-btn'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function markupLabel(item: Markup) {
  if (item.kind === 'highlight') return 'Highlight'
  if (item.kind === 'underline') return 'Underline'
  if (item.kind === 'strike') return 'Strikethrough'
  if (item.kind === 'note') return item.text.trim() || 'Note'
  if (item.kind === 'text') return item.text.trim() || 'Text'
  if (item.kind === 'cover') return 'Cover'
  if (item.kind === 'stamp') return item.label
  if (item.kind === 'picture') return item.name
  if (item.kind === 'esign') return `Digitally signed by ${item.name}`
  return 'Mark'
}

export function MarkupList({ kinds }: { kinds: Markup['kind'][] }) {
  const items = useMarkupStore((state) => state.items)
  const remove = useMarkupStore((state) => state.remove)
  const shown = items.filter((item) => kinds.includes(item.kind))
  if (shown.length === 0) return null
  return (
    <ul className="mark-list">
      {shown.map((item) => (
        <li key={item.id}>
          <span>
            {markupLabel(item)} · {item.page}
          </span>
          <button type="button" onClick={() => remove(item.id)}>
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}
