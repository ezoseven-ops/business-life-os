'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error'

export interface AudioRecorderResult {
  state: RecorderState
  /** Elapsed recording time in seconds */
  elapsed: number
  /** Error message if state === 'error' */
  error: string | null
  /** Start recording. Requests mic permission if needed. */
  start: () => void
  /** Stop recording. Resolves with audio Blob. */
  stop: () => Promise<Blob | null>
  /** Cancel recording without producing output. */
  cancel: () => void
}

/**
 * Hook for ephemeral audio recording via MediaRecorder.
 * Produces a single Blob (webm/opus on most browsers, mp4 on Safari).
 * No persistence — caller decides what to do with the blob.
 *
 * Designed for mobile-first:
 * - Handles Safari's limited MediaRecorder codec support
 * - Cleans up stream on unmount
 * - Tracks elapsed time for UI feedback
 */
export function useAudioRecorder(): AudioRecorderResult {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
      clearTimer()
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const getSupportedMimeType = useCallback((): string => {
    // Prefer webm/opus (Chrome, Firefox, Android)
    // Fall back to mp4 (Safari iOS/macOS)
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ]
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return '' // Let browser pick default
  }, [])

  const start = useCallback(() => {
    if (state === 'recording') return

    setState('requesting')
    setError(null)
    setElapsed(0)
    chunksRef.current = []

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream

        const mimeType = getSupportedMimeType()
        const options: MediaRecorderOptions = mimeType ? { mimeType } : {}
        const recorder = new MediaRecorder(stream, options)
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data)
          }
        }

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          })
          stopStream()
          clearTimer()

          if (resolveRef.current) {
            resolveRef.current(blob)
            resolveRef.current = null
          }
        }

        recorder.onerror = () => {
          setError('Recording failed')
          setState('error')
          stopStream()
          clearTimer()
          if (resolveRef.current) {
            resolveRef.current(null)
            resolveRef.current = null
          }
        }

        // Start recording with 1s timeslice for progressive data
        recorder.start(1000)
        setState('recording')

        // Elapsed timer — update every second
        const startTime = Date.now()
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)
      })
      .catch((err) => {
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Microphone access denied'
            : 'Could not access microphone'
        setError(msg)
        setState('error')
      })
  }, [state, getSupportedMimeType, stopStream, clearTimer])

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || state !== 'recording') {
        resolve(null)
        return
      }

      setState('processing')
      resolveRef.current = resolve
      mediaRecorderRef.current.stop()
    })
  }, [state])

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    stopStream()
    clearTimer()
    chunksRef.current = []
    resolveRef.current = null
    setState('idle')
    setElapsed(0)
    setError(null)
  }, [state, stopStream, clearTimer])

  return { state, elapsed, error, start, stop, cancel }
}
