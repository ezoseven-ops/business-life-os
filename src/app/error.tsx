'use client'

// ─────────────────────────────────────────────
// Root Error Boundary
//
// Catches unhandled errors at the root layout level.
// This is the last line of defense before a white screen.
// Uses inline styles since Tailwind may not be loaded.
// ─────────────────────────────────────────────

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'var(--color-cc-bg)',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'var(--color-cc-risk-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={1.5}
                stroke="var(--color-cc-risk)"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-cc-text)', marginBottom: 4 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-cc-text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
              An unexpected error occurred. Your data is safe.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--color-cc-accent)',
                color: 'var(--color-cc-bg)',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
