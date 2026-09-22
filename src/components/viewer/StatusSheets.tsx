type EmptyStateProps = {
  onOpen: () => void
}

export function EmptyState({ onOpen }: EmptyStateProps) {
  return (
    <div className="note-wrap">
      <div className="paper note">
        <h2>Open a PDF</h2>
        <p>Drop a file here, choose one from your computer, or start from the tools on the left.</p>
        <p className="quiet">It stays in this browser. Nothing is uploaded.</p>
        <div className="note-actions">
          <button type="button" className="primary-btn" onClick={onOpen}>
            Choose a file
          </button>
        </div>
      </div>
    </div>
  )
}

export function OpeningState() {
  return (
    <div className="note-wrap">
      <p className="opening-line" role="status">
        Opening
      </p>
    </div>
  )
}

type ErrorStateProps = {
  message: string
  onOpen: () => void
}

export function ErrorState({ message, onOpen }: ErrorStateProps) {
  return (
    <div className="note-wrap">
      <div className="paper note">
        <h2>Couldn’t open this file</h2>
        <p className="alert" role="alert">
          {message}
        </p>
        <div className="note-actions">
          <button type="button" className="primary-btn" onClick={onOpen}>
            Choose a file
          </button>
        </div>
      </div>
    </div>
  )
}
