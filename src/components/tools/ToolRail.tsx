import type { ToolId } from '../../state/toolStore'
import { useToolStore } from '../../state/toolStore'
import { RailIcon } from './icons'

const tools: { id: ToolId; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'edit', label: 'Edit' },
  { id: 'comment', label: 'Comment' },
  { id: 'stamp', label: 'Stamp' },
  { id: 'sign', label: 'Sign' },
  { id: 'organize', label: 'Pages' },
  { id: 'combine', label: 'Combine' },
  { id: 'export', label: 'Export' },
  { id: 'compress', label: 'Compress' },
  { id: 'share', label: 'Share' },
]

export function ToolRail() {
  const active = useToolStore((state) => state.active)
  const toggle = useToolStore((state) => state.toggle)

  return (
    <nav className="tool-rail" aria-label="Tools">
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          className={active === tool.id ? 'rail-btn is-active' : 'rail-btn'}
          aria-pressed={active === tool.id}
          onClick={() => toggle(tool.id)}
        >
          <RailIcon name={tool.id} />
          {tool.label}
        </button>
      ))}
    </nav>
  )
}
