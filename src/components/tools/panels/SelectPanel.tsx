import { NeedsPdf, MarkupList } from '../ui'

export function SelectPanel() {
  return (
    <NeedsPdf>
      <p className="panel-note">
        Click an item on the page to select it, drag to move it, and drag a corner handle to resize. Signatures and
        images keep their proportions; hold Shift to resize freely. Double-click text to edit it.
      </p>
      <p className="panel-note">
        Arrow keys nudge (Shift for bigger steps). Ctrl+C / X / V / D copy, cut, paste, duplicate. Delete removes.
        Ctrl+Z / Ctrl+Y undo and redo.
      </p>
      <MarkupList kinds={['note', 'text', 'cover', 'stamp', 'picture', 'esign', 'highlight', 'underline', 'strike']} />
    </NeedsPdf>
  )
}
