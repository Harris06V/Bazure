import type { ReactNode } from 'react'
import { ToolPanel } from '../tools/ToolPanel'
import { ToolRail } from '../tools/ToolRail'
import { Toolbar } from './Toolbar'

type AppShellProps = {
  /**
   * Phase 2 mounts thumbnails and the outline here. The stage stays the
   * reading surface; the sidebar is a sibling, not a wrapper around pages.
   */
  sidebar?: ReactNode
  dragging: boolean
  children: ReactNode
}

export function AppShell({ sidebar, dragging, children }: AppShellProps) {
  return (
    <div className="shell">
      <Toolbar />
      <div className="workspace">
        <ToolRail />
        <ToolPanel />
        {sidebar}
        <div className={dragging ? 'stage is-dropping' : 'stage'} data-scroll-root>
          {children}
        </div>
      </div>
    </div>
  )
}
