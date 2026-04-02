import { Header } from '@/components/Header'

export default function VoicePage() {
  return (
    <div>
      <Header title="Voice Notes" backHref="/" />

      <div className="px-4 py-8 max-w-lg mx-auto text-center space-y-6">
        <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Voice capture</h2>
          <p className="text-sm text-text-secondary mt-1">
            Record voice notes, get transcriptions, and extract tasks with AI.
          </p>
        </div>
        <p className="text-xs text-text-secondary">
          Coming in Phase 4 — voice recording + Whisper transcription
        </p>
      </div>
    </div>
  )
}
