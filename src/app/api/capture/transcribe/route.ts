import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { openai } from '@/lib/openai'
import { checkAiRateLimit } from '@/lib/rate-limit'
import { captureError } from '@/lib/sentry'

/**
 * POST /api/capture/transcribe
 *
 * Accepts raw audio as FormData, transcribes via Whisper,
 * returns plain text. No persistence — audio is ephemeral.
 *
 * This is the lightest possible voice-to-text bridge:
 * audio blob in → transcript text out → caller feeds into capture pipeline.
 */
export async function POST(request: Request) {
  // ── Auth check ──
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Rate limit: 10/min, 50/hr ──
  const rateCheck = checkAiRateLimit(session.user.id)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil(rateCheck.retryAfterMs / 1000)}s.` },
      { status: 429 },
    )
  }

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio')

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: 'Missing audio file in form data' },
        { status: 400 },
      )
    }

    // ── Size guard: 10MB max ──
    const MAX_SIZE = 10 * 1024 * 1024
    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Audio file too large (max 10MB)' },
        { status: 400 },
      )
    }

    // ── Whisper transcription ──
    // No language param — Whisper auto-detects language
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
    })

    if (!transcription.text?.trim()) {
      return NextResponse.json(
        { error: 'Could not transcribe audio — no speech detected' },
        { status: 422 },
      )
    }

    return NextResponse.json({ text: transcription.text.trim() })
  } catch (error) {
    console.error('[Transcribe Error]', error)
    captureError(error, { module: 'api', action: 'transcribe', userId: session?.user?.id })
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 },
    )
  }
}
