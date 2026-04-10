import { Header } from '@/components/Header'
import { EmptyState } from '@/components/EmptyState'
import Link from 'next/link'

export default function VoicePage() {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <Header title="Voice Notes" backHref="/" />

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        <EmptyState
          title="Voice capture is built in"
          description="Use the microphone button on the home screen to record, transcribe, and process voice input."
          action={
            <Link href="/" className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold">
              Go to Dashboard
            </Link>
          }
        />
      </div>
    </div>
  )
}
