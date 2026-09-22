import type { ToolId } from '../../state/toolStore'

export function RailIcon({ name }: { name: ToolId }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {name === 'create' ? (
        <>
          <path d="M6 2.5h5.2L15 6.3V16a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 16V4A1.5 1.5 0 0 1 6.5 2.5H6Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M11 2.8V6.2H14.4M8 11h4M10 9v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {name === 'edit' ? (
        <path d="M11.2 3.6 16.4 8.8 7.2 18H2.8v-4.4L11.2 3.6Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      ) : null}
      {name === 'comment' ? (
        <path d="M4 4.5h12v8.2H8.2L4.5 16v-3.3H4V4.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      ) : null}
      {name === 'stamp' ? (
        <rect x="3" y="5" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      ) : null}
      {name === 'sign' ? (
        <path d="M3 14.5c2.2-4 3.4-6.2 4.2-6.2.9 0 1.1 2.4 2.2 2.4 1.4 0 1.6-5.2 3.2-5.2 1.2 0 2.2 2.6 4.4 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : null}
      {name === 'organize' ? (
        <>
          <rect x="3" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="3" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="11" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </>
      ) : null}
      {name === 'combine' ? (
        <>
          <path d="M7.5 3h6.2L16 5.4V15H7.5V3Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M4 6.2h3.5V17H4.8A1.3 1.3 0 0 1 3.5 15.7V7.5A1.3 1.3 0 0 1 4.8 6.2H4Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </>
      ) : null}
      {name === 'export' ? (
        <>
          <path d="M10 3.2v8.2M6.8 8.6 10 11.8l3.2-3.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 13.5V16h12v-2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {name === 'compress' ? (
        <>
          <path d="M4 7.5 7.2 10 4 12.5M16 7.5 12.8 10 16 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 3.5v13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : null}
      {name === 'share' ? (
        <>
          <circle cx="5" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="14.5" cy="5.2" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="14.5" cy="14.8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.8 9.1 12.6 6.2M6.8 10.9l5.8 2.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4 4 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
