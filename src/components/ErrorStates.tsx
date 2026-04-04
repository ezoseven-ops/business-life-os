// ─────────────────────────────────────────────
// Centralized Error UI Components
//
// Three tiers:
// 1. InlineError — form-level, inline with content
// 2. ErrorBanner — section-level, dismissible
// 3. CenteredErrorState — full-page, error boundary fallback
//
// Design tokens: amber-800/amber-50 (calm, not aggressive red)
// Consistent spacing, typography, iconography.
// ─────────────────────────────────────────────

const ERROR_ICON = 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z'

/**
 * InlineError — compact error for forms and inline contexts.
 * Replaces: <p className="text-xs text-red-500">
 */
export function InlineError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-1.5 py-1">
      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-px text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={ERROR_ICON} />
      </svg>
      <p className="text-xs leading-relaxed text-amber-800">{message}</p>
    </div>
  )
}

/**
 * ErrorBanner — section-level error for settings, panels, modals.
 * Replaces: <div className="bg-red-50 text-red-700 ...">
 */
export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200/60">
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={ERROR_ICON} />
      </svg>
      <p className="flex-1 text-[13px] leading-relaxed text-amber-800">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 mt-0.5 text-amber-400 hover:text-amber-600 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * CenteredErrorState — full-page error for error boundaries.
 * Replaces: ad-hoc min-h-dvh error layouts.
 */
export function CenteredErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Your data is safe.',
  action,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6" style={{ backgroundColor: '#f9fafb' }}>
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={ERROR_ICON} />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{title}</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{description}</p>
        {action}
      </div>
    </div>
  )
}

/**
 * SuccessBanner — section-level success feedback.
 * Consistent with ErrorBanner layout.
 */
export function SuccessBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200/60">
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="flex-1 text-[13px] leading-relaxed text-green-800">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 mt-0.5 text-green-400 hover:text-green-600 transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
