'use client'

import { CenteredErrorState } from '@/components/ErrorStates'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CenteredErrorState
      title="Something went wrong"
      description="The system encountered an unexpected issue. Your data is safe."
      action={
        <button
          onClick={reset}
          className="px-6 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl active:scale-[0.98] transition-transform"
        >
          Try again
        </button>
      }
    />
  )
}
