import { useState } from 'react'
import { useViewerStore } from '../../state/viewerStore'

export function PasswordSheet() {
  const incorrect = useViewerStore((state) => state.passwordIncorrect)
  const submitPassword = useViewerStore((state) => state.submitPassword)
  const [password, setPassword] = useState('')

  return (
    <div className="note-wrap">
      <form
        className="paper note"
        onSubmit={(event) => {
          event.preventDefault()
          if (!password) return
          submitPassword(password)
        }}
      >
        <h2>This PDF is locked</h2>
        <p>Enter the password to open it. Bazure checks it in this browser.</p>
        <input
          className="text-field"
          type="password"
          autoFocus
          value={password}
          aria-label="PDF password"
          onChange={(event) => setPassword(event.target.value)}
        />
        {incorrect ? (
          <p className="alert" role="alert">
            That password didn’t unlock the file.
          </p>
        ) : null}
        <div className="note-actions">
          <button type="submit" className="primary-btn" disabled={!password}>
            Unlock
          </button>
        </div>
      </form>
    </div>
  )
}
