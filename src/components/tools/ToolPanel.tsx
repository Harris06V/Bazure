import type { ToolId } from '../../state/toolStore'
import { useToolStore } from '../../state/toolStore'
import { CloseIcon } from './icons'
import { CommentPanel } from './panels/CommentPanel'
import { CombinePanel } from './panels/CombinePanel'
import { CompressPanel } from './panels/CompressPanel'
import { CreatePanel } from './panels/CreatePanel'
import { EditPanel } from './panels/EditPanel'
import { ExportPanel } from './panels/ExportPanel'
import { OrganizePanel } from './panels/OrganizePanel'
import { SharePanel } from './panels/SharePanel'
import { SignPanel } from './panels/SignPanel'
import { StampPanel } from './panels/StampPanel'

const titles: Record<ToolId, string> = {
  create: 'Create PDF',
  edit: 'Edit',
  comment: 'Comment',
  stamp: 'Stamp',
  sign: 'Fill & Sign',
  organize: 'Organize pages',
  combine: 'Combine files',
  export: 'Export',
  compress: 'Compress',
  share: 'Share',
}

export function ToolPanel() {
  const active = useToolStore((state) => state.active)
  const close = useToolStore((state) => state.close)
  if (!active) return null

  return (
    <aside className="tool-panel">
      <div className="tool-panel-head">
        <h2>{titles[active]}</h2>
        <button type="button" className="tool-btn icon" aria-label="Close tools" onClick={close}>
          <CloseIcon />
        </button>
      </div>
      <div className="tool-panel-body">
        {active === 'create' ? <CreatePanel /> : null}
        {active === 'edit' ? <EditPanel /> : null}
        {active === 'comment' ? <CommentPanel /> : null}
        {active === 'stamp' ? <StampPanel /> : null}
        {active === 'sign' ? <SignPanel /> : null}
        {active === 'organize' ? <OrganizePanel /> : null}
        {active === 'combine' ? <CombinePanel /> : null}
        {active === 'export' ? <ExportPanel /> : null}
        {active === 'compress' ? <CompressPanel /> : null}
        {active === 'share' ? <SharePanel /> : null}
      </div>
    </aside>
  )
}
