'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { parseCaptureAction, executeCaptureAction } from '../capture.actions'
import { classifyInputAction, executeCommandAction, executeMultiStepCommandAction } from '@/modules/command/command.actions'
import { sendMessageDraftAction } from '@/modules/messages/message-send.actions'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import type { CaptureDraft, CaptureResult } from '../capture.types'
import type { CommandPayload, CommandResult, MultiStepEntry } from '@/modules/command/command.types'
import type { MessageSendResult } from '@/modules/messages/message-send.service'

type CaptureState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'draft'
  | 'command_preview'    // Single command preview
  | 'execution_plan'    // Multi-step command plan preview
  | 'executing'
  | 'done'
  | 'error'

// ─────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────

function hasTaskList(
  draft: CaptureDraft,
): draft is Extract<CaptureDraft, { classification: 'project' | 'task_bundle' }> {
  return draft.classification === 'project' || draft.classification === 'task_bundle'
}

// ─────────────────────────────────────────────
// Classification metadata
// ─────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; icon: string; confirmLabel: string }> = {
  project: {
    label: 'New Project',
    color: 'var(--color-cc-accent)',
    icon: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
    confirmLabel: 'Create Project',
  },
  task_bundle: {
    label: 'Add Tasks',
    color: 'var(--color-cc-accent)',
    icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
    confirmLabel: 'Create Tasks',
  },
  follow_up: {
    label: 'Follow-up',
    color: '#f97316',
    icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    confirmLabel: 'Create Follow-up',
  },
  decision: {
    label: 'Decision',
    color: '#a855f7',
    icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
    confirmLabel: 'Save Decision',
  },
  session: {
    label: 'Think Session',
    color: '#06b6d4',
    icon: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
    confirmLabel: 'Save Session',
  },
  note: {
    label: 'Note',
    color: '#22c55e',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    confirmLabel: 'Save Note',
  },
  message: {
    label: 'Message',
    color: '#3b82f6',
    icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
    confirmLabel: 'Send Message',
  },
  collaborator: {
    label: 'Collaborator',
    color: '#8b5cf6',
    icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    confirmLabel: 'Save Collaborator',
  },
}

// ─────────────────────────────────────────────
// Command metadata
// ─────────────────────────────────────────────

const COMMAND_INTENT_META: Record<string, { label: string; color: string; icon: string; confirmLabel: string }> = {
  navigate: {
    label: 'Navigate',
    color: '#8b5cf6',
    icon: 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3',
    confirmLabel: 'Go',
  },
  create_task: {
    label: 'Create Task',
    color: 'var(--color-cc-accent)',
    icon: 'M12 4.5v15m7.5-7.5h-15',
    confirmLabel: 'Create Task',
  },
  assign_task: {
    label: 'Assign Task',
    color: '#06b6d4',
    icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0',
    confirmLabel: 'Assign',
  },
  complete_task: {
    label: 'Complete Task',
    color: '#22c55e',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    confirmLabel: 'Mark Done',
  },
  create_project: {
    label: 'Create Project',
    color: 'var(--color-cc-accent)',
    icon: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75',
    confirmLabel: 'Create Project',
  },
  add_member: {
    label: 'Add Member',
    color: '#f97316',
    icon: 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z',
    confirmLabel: 'Add Member',
  },
  create_event: {
    label: 'Schedule Event',
    color: '#f59e0b',
    icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25',
    confirmLabel: 'Schedule',
  },
  save_note: {
    label: 'Save Note',
    color: '#22c55e',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    confirmLabel: 'Save Note',
  },
}

const COMMAND_DONE_MESSAGES: Record<string, string> = {
  navigate: 'Navigating...',
  create_task: 'Task created',
  assign_task: 'Task assigned',
  complete_task: 'Task completed',
  create_project: 'Project created',
  add_member: 'Member added',
  create_event: 'Event scheduled',
  save_note: 'Note saved',
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export function CaptureInput() {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [state, setState] = useState<CaptureState>('idle')
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<CaptureDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CaptureResult | null>(null)
  const [voiceSource, setVoiceSource] = useState(false)

  // Command layer state
  const [commandPayload, setCommandPayload] = useState<CommandPayload | null>(null)
  const [commandInterpretation, setCommandInterpretation] = useState<string>('')
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null)

  // Multi-step command state
  const [multiSteps, setMultiSteps] = useState<MultiStepEntry[]>([])
  const [multiStepInterpretation, setMultiStepInterpretation] = useState<string>('')

  // Message send state
  const [messageSendResult, setMessageSendResult] = useState<MessageSendResult | null>(null)

  const recorder = useAudioRecorder()

  // ── Auto-grow textarea ──
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  // ── Classify input: command or capture? ──
  const submitText = useCallback(async (inputText: string) => {
    if (!inputText.trim()) return
    setState('thinking')
    setError(null)

    // Step 1: Ask AI — is this a command or a capture?
    const classifyResult = await classifyInputAction({ text: inputText.trim() })

    if (classifyResult.success && classifyResult.data.isCommand) {
      const data = classifyResult.data

      // Multi-step commands — show execution plan
      if ('isMultiStep' in data && data.isMultiStep && 'commands' in data) {
        const steps: MultiStepEntry[] = data.commands.map((cmd: CommandPayload) => ({
          command: cmd,
          interpretation: COMMAND_INTENT_META[cmd.intent]?.label ?? cmd.intent,
          status: 'pending' as const,
        }))
        setMultiSteps(steps)
        setMultiStepInterpretation(data.interpretation)
        setState('execution_plan')
        return
      }

      // Single command — show preview for confirmation
      if ('command' in data) {
        setCommandPayload(data.command)
        setCommandInterpretation(data.interpretation)
        setState('command_preview')
        return
      }
    }

    // It's a CAPTURE — proceed through capture pipeline
    const response = await parseCaptureAction({ text: inputText.trim() })
    if (response.success) {
      setDraft(response.data)
      setState('draft')
    } else {
      setError(response.error)
      setState('error')
    }
  }, [])

  // ── Step 1a: Text submit ──
  const handleSubmit = useCallback(async () => {
    if (!text.trim() || state === 'thinking') return
    setVoiceSource(false)
    await submitText(text)
  }, [text, state, submitText])

  // ── Step 1b: Voice — start recording ──
  const handleStartRecording = useCallback(() => {
    setError(null)
    setVoiceSource(true)
    recorder.start()
    setState('recording')
  }, [recorder])

  // ── Step 1c: Voice — stop and transcribe ──
  const handleStopRecording = useCallback(async () => {
    setState('transcribing')
    const blob = await recorder.stop()

    if (!blob || blob.size === 0) {
      setError('No audio captured')
      setState('error')
      return
    }

    try {
      // Send to Whisper endpoint
      const formData = new FormData()
      formData.append('audio', blob, 'capture.webm')

      const response = await fetch('/api/capture/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok || !data.text) {
        setError(data.error || 'Transcription failed')
        setState('error')
        return
      }

      // Set transcript as text and auto-submit to capture pipeline
      setText(data.text)
      await submitText(data.text)
    } catch {
      setError('Could not transcribe audio')
      setState('error')
    }
  }, [recorder, submitText])

  // ── Step 1d: Voice — cancel recording ──
  const handleCancelRecording = useCallback(() => {
    recorder.cancel()
    setState('idle')
    setVoiceSource(false)
  }, [recorder])

  // ── Step 2: Confirm and execute ──
  const handleConfirm = useCallback(async () => {
    if (!draft) return
    setState('executing')

    const response = await executeCaptureAction(draft)
    if (response.success) {
      setResult(response.data)

      // If this is a message draft, also SEND it via adapter
      if (draft.classification === 'message') {
        const sendResult = await sendMessageDraftAction({
          recipientName: draft.message.recipientName,
          recipientId: draft.message.recipientId,
          channel: draft.message.channel,
          subject: draft.message.subject,
          body: draft.message.body,
          projectId: draft.message.projectId,
          followUpAction: draft.message.followUpAction,
        })
        if (sendResult.success) {
          setMessageSendResult(sendResult.data)
        }
      }

      setState('done')
      setTimeout(() => {
        router.refresh()
        setTimeout(() => {
          setState('idle')
          setText('')
          setDraft(null)
          setResult(null)
          setMessageSendResult(null)
          setVoiceSource(false)
          if (inputRef.current) inputRef.current.style.height = 'auto'
        }, 2500)
      }, 500)
    } else {
      setError(response.error)
      setState('error')
    }
  }, [draft, router])

  // ── Command: Confirm and execute ──
  const handleCommandConfirm = useCallback(async () => {
    if (!commandPayload) return
    setState('executing')

    const response = await executeCommandAction(commandPayload)
    if (response.success) {
      setCommandResult(response.data)
      setState('done')

      // Navigate if it's a navigation command
      if (response.data.intent === 'navigate' && 'path' in response.data) {
        setTimeout(() => router.push((response.data as { intent: 'navigate'; path: string }).path), 400)
      }

      setTimeout(() => {
        router.refresh()
        setTimeout(() => {
          setState('idle')
          setText('')
          setDraft(null)
          setCommandPayload(null)
          setCommandInterpretation('')
          setCommandResult(null)
          setResult(null)
          setVoiceSource(false)
          if (inputRef.current) inputRef.current.style.height = 'auto'
        }, 2500)
      }, 500)
    } else {
      setError(response.error)
      setState('error')
    }
  }, [commandPayload, router])

  // ── Multi-step: Confirm and execute all ──
  const handleMultiStepConfirm = useCallback(async () => {
    if (multiSteps.length === 0) return
    setState('executing')

    const response = await executeMultiStepCommandAction(multiSteps)
    if (response.success) {
      setMultiSteps(response.data)

      // Check if any step has navigate as last successful step
      const lastSuccess = [...response.data].reverse().find((s: MultiStepEntry) => s.status === 'success')
      if (lastSuccess?.result?.intent === 'navigate' && 'path' in lastSuccess.result) {
        setTimeout(() => router.push((lastSuccess.result as { intent: 'navigate'; path: string }).path), 400)
      }

      setState('done')
      setTimeout(() => {
        router.refresh()
        setTimeout(() => {
          setState('idle')
          setText('')
          setMultiSteps([])
          setMultiStepInterpretation('')
          setDraft(null)
          setCommandPayload(null)
          setCommandInterpretation('')
          setCommandResult(null)
          setResult(null)
          setVoiceSource(false)
          if (inputRef.current) inputRef.current.style.height = 'auto'
        }, 2500)
      }, 500)
    } else {
      setError(response.error)
      setState('error')
    }
  }, [multiSteps, router])

  // ── Multi-step: Remove a step ──
  const removeMultiStep = useCallback((index: number) => {
    setMultiSteps(prev => {
      const next = prev.filter((_, i) => i !== index)
      // If only 1 step left, convert to single command
      if (next.length === 1) {
        setCommandPayload(next[0].command)
        setCommandInterpretation(next[0].interpretation)
        setState('command_preview')
        return []
      }
      return next
    })
  }, [])

  // ── Reset ──
  const handleReset = useCallback(() => {
    setState('idle')
    setDraft(null)
    setError(null)
    setResult(null)
    setCommandPayload(null)
    setCommandInterpretation('')
    setCommandResult(null)
    setMultiSteps([])
    setMultiStepInterpretation('')
    setMessageSendResult(null)
    setVoiceSource(false)
    inputRef.current?.focus()
  }, [])

  // ── Remove a task from draft (project/task_bundle only) ──
  const removeTask = useCallback((index: number) => {
    if (!draft || !hasTaskList(draft)) return
    const newTasks = draft.tasks.filter((_, i) => i !== index)
    if (newTasks.length === 0) return
    setDraft({ ...draft, tasks: newTasks })
  }, [draft])

  // ── Keyboard handling ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Done message per type ──
  const multiStepDoneCount = multiSteps.filter(s => s.status === 'success').length
  const multiStepFailCount = multiSteps.filter(s => s.status === 'failed').length

  const doneMessage = multiSteps.length > 0
    ? (multiStepFailCount > 0
      ? `${multiStepDoneCount} done, ${multiStepFailCount} failed`
      : `All ${multiStepDoneCount} commands executed`)
    : commandResult
    ? COMMAND_DONE_MESSAGES[commandResult.intent] ?? 'Done'
    : result
      ? result.classification === 'project'
        ? `Project created with ${result.taskIds.length} task${result.taskIds.length !== 1 ? 's' : ''}`
        : result.classification === 'task_bundle'
          ? `${result.taskIds.length} task${result.taskIds.length !== 1 ? 's' : ''} added`
          : result.classification === 'follow_up'
            ? 'Follow-up created'
            : result.classification === 'decision'
              ? 'Decision saved'
              : result.classification === 'session'
                ? 'Session saved'
                : result.classification === 'note'
                  ? 'Note saved'
                  : result.classification === 'message'
                    ? (messageSendResult?.success
                      ? `Sent to ${messageSendResult.recipientName} via ${messageSendResult.channel}`
                      : messageSendResult?.error
                        ? `Draft saved — ${messageSendResult.error}`
                        : 'Message draft saved')
                    : result.classification === 'collaborator'
                      ? 'Collaborator saved'
                    : 'Saved'
      : ''

  const meta = draft ? TYPE_META[draft.classification] : null

  // ── Elapsed time formatter ──
  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="cc-card overflow-hidden" style={{ borderColor: 'var(--color-cc-border)' }}>

      {/* ══════════════════════════════════════════
          IDLE / ERROR — Input zone
          ══════════════════════════════════════════ */}
      {(state === 'idle' || state === 'error') && (
        <div className="p-4">
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind? Drop anything..."
            rows={1}
            className="w-full bg-transparent text-[15px] leading-relaxed placeholder:text-[var(--color-cc-text-dim)] resize-none outline-none"
            style={{
              color: 'var(--color-cc-text)',
              minHeight: '44px',
            }}
          />

          {state === 'error' && error && (
            <div
              className="flex items-start gap-2 mt-2 mb-2 px-3 py-2.5 rounded-xl"
              style={{ backgroundColor: 'var(--color-cc-fire-muted)' }}
            >
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--color-cc-fire)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-cc-fire)' }}>
                {error}
              </p>
            </div>
          )}

          {/* Action row: mic + process */}
          <div className="flex items-center gap-2" style={{ marginTop: '8px' }}>
            {/* Mic button */}
            <button
              onClick={handleStartRecording}
              className="flex items-center justify-center rounded-xl transition-all active:scale-[0.95]"
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: 'var(--color-cc-surface-elevated)',
                color: 'var(--color-cc-text-secondary)',
                flexShrink: 0,
              }}
              aria-label="Record voice"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Process button */}
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="flex-1 text-[14px] font-semibold rounded-xl transition-all disabled:opacity-25 active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--color-cc-accent)',
                color: '#fff',
                height: '48px',
              }}
            >
              Process
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          RECORDING — Voice capture UI
          ══════════════════════════════════════════ */}
      {state === 'recording' && (
        <div className="p-4">
          <div className="flex flex-col items-center py-4">
            {/* Recording indicator + timer */}
            <div className="flex items-center gap-2.5 mb-6">
              <span
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ backgroundColor: 'var(--color-cc-fire)' }}
              />
              <span
                className="text-[13px] font-medium"
                style={{ color: 'var(--color-cc-text-secondary)' }}
              >
                Recording
              </span>
              <span
                className="text-[15px] font-bold tabular-nums"
                style={{ color: 'var(--color-cc-text)' }}
              >
                {formatElapsed(recorder.elapsed)}
              </span>
            </div>

            {/* Stop button — large, obvious, one-hand friendly */}
            <button
              onClick={handleStopRecording}
              className="flex items-center justify-center rounded-full transition-all active:scale-[0.93]"
              style={{
                width: '72px',
                height: '72px',
                backgroundColor: 'var(--color-cc-fire)',
              }}
              aria-label="Stop recording"
            >
              {/* Stop square icon */}
              <span
                className="block rounded-sm"
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#fff',
                }}
              />
            </button>

            {/* Cancel link */}
            <button
              onClick={handleCancelRecording}
              className="mt-4 text-[13px] font-medium rounded-lg transition-all active:scale-[0.97]"
              style={{
                color: 'var(--color-cc-text-muted)',
                padding: '10px 20px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TRANSCRIBING — Whisper processing
          ══════════════════════════════════════════ */}
      {state === 'transcribing' && (
        <div className="p-5 flex flex-col items-center justify-center gap-3">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{
              borderColor: 'var(--color-cc-border)',
              borderTopColor: 'var(--color-cc-text-secondary)',
            }}
          />
          <span className="text-[13px]" style={{ color: 'var(--color-cc-text-secondary)' }}>
            Transcribing voice...
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════
          THINKING — Shimmer skeleton
          ══════════════════════════════════════════ */}
      {state === 'thinking' && (
        <div className="p-4 space-y-3">
          {/* Show voice source indicator if applicable */}
          {voiceSource && text && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-xl mb-1"
              style={{ backgroundColor: 'var(--color-cc-surface)' }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--color-cc-text-dim)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
              <p
                className="text-[12px] leading-relaxed line-clamp-2"
                style={{ color: 'var(--color-cc-text-dim)' }}
              >
                {text}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <div
              className="w-5 h-5 rounded-md animate-pulse"
              style={{ backgroundColor: 'var(--color-cc-accent)', opacity: 0.3 }}
            />
            <div
              className="h-3 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-cc-surface-elevated)', width: '40%' }}
            />
          </div>
          <div
            className="h-12 rounded-xl animate-pulse"
            style={{ backgroundColor: 'var(--color-cc-surface-elevated)' }}
          />
          <div
            className="h-10 rounded-xl animate-pulse"
            style={{ backgroundColor: 'var(--color-cc-surface)', animationDelay: '150ms' }}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════
          DRAFT REVIEW — Type-specific layouts
          ══════════════════════════════════════════ */}
      {state === 'draft' && draft && meta && (
        <div>
          {/* ── Header: icon + type + interpretation ── */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: meta.color + '1a' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke={meta.color}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  {voiceSource && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--color-cc-text-dim)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>
                <p
                  className="text-[13px] leading-snug mt-0.5"
                  style={{ color: 'var(--color-cc-text-secondary)' }}
                >
                  {draft.interpretation}
                </p>
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }} />

          {/* ── Type-specific content ── */}
          <div className="px-4 py-3">

            {/* ── PROJECT / TASK_BUNDLE ── */}
            {hasTaskList(draft) && (
              <div className="space-y-2">
                {/* Project banner */}
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: 'var(--color-cc-surface-elevated)' }}
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor: draft.project.action === 'CREATE'
                        ? meta.color + '26'
                        : 'var(--color-cc-border)',
                      color: draft.project.action === 'CREATE'
                        ? meta.color
                        : 'var(--color-cc-text-muted)',
                    }}
                  >
                    {draft.project.action === 'CREATE' ? 'New' : 'Existing'}
                  </span>
                  <span
                    className="text-[14px] font-medium truncate"
                    style={{ color: 'var(--color-cc-text)' }}
                  >
                    {draft.project.name}
                  </span>
                </div>

                {/* Task list */}
                <div className="space-y-1">
                  {draft.tasks.map((task, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 rounded-xl"
                      style={{
                        backgroundColor: 'var(--color-cc-surface)',
                        minHeight: '44px',
                      }}
                    >
                      <PriorityDot priority={task.priority} />
                      <span
                        className="text-[13px] flex-1 min-w-0 truncate"
                        style={{ color: 'var(--color-cc-text-secondary)' }}
                      >
                        {task.title}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {task.assigneeName && (
                          <MetaPill text={task.assigneeName} />
                        )}
                        {task.dueDate && (
                          <MetaPill text={task.dueDate} />
                        )}
                      </div>
                      <button
                        onClick={() => removeTask(i)}
                        className="flex items-center justify-center rounded-lg transition-colors active:scale-[0.9]"
                        style={{
                          color: 'var(--color-cc-text-dim)',
                          width: '36px',
                          height: '36px',
                          marginRight: '-6px',
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Task count */}
                <p className="text-[11px] px-1" style={{ color: 'var(--color-cc-text-dim)' }}>
                  {draft.tasks.length} task{draft.tasks.length !== 1 ? 's' : ''} will be created
                </p>
              </div>
            )}

            {/* ── FOLLOW-UP ── */}
            {draft.classification === 'follow_up' && (
              <div
                className="rounded-xl px-4 py-3.5 space-y-2.5"
                style={{ backgroundColor: 'var(--color-cc-surface)' }}
              >
                <div className="flex items-start gap-2.5">
                  <PriorityDot priority={draft.followUp.priority} className="mt-1.5" />
                  <p
                    className="text-[14px] font-medium leading-snug flex-1"
                    style={{ color: 'var(--color-cc-text)' }}
                  >
                    {draft.followUp.title}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-4">
                  {draft.followUp.targetPerson && (
                    <Pill
                      icon="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                      text={draft.followUp.targetPerson}
                      color="#f97316"
                    />
                  )}
                  {draft.followUp.dueDate && (
                    <Pill
                      icon="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                      text={draft.followUp.dueDate}
                      color="var(--color-cc-text-muted)"
                    />
                  )}
                  {draft.followUp.projectName && (
                    <Pill
                      icon="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75"
                      text={draft.followUp.projectName}
                      color="var(--color-cc-accent)"
                    />
                  )}
                </div>
              </div>
            )}

            {/* ── DECISION ── */}
            {draft.classification === 'decision' && (
              <div className="space-y-3">
                <p
                  className="text-[15px] font-medium leading-snug"
                  style={{ color: 'var(--color-cc-text)' }}
                >
                  {draft.decision.question}
                </p>

                <div className="space-y-1.5">
                  {draft.decision.options.map((opt, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 rounded-xl"
                      style={{
                        backgroundColor: 'var(--color-cc-surface)',
                        minHeight: '40px',
                      }}
                    >
                      <span
                        className="text-[11px] font-bold tabular-nums w-5 text-center flex-shrink-0"
                        style={{ color: '#a855f7' }}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span
                        className="text-[13px] flex-1"
                        style={{ color: 'var(--color-cc-text-secondary)' }}
                      >
                        {opt}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <UrgencyBadge urgency={draft.decision.urgency} />
                  {draft.decision.projectName && (
                    <MetaPill text={`in ${draft.decision.projectName}`} />
                  )}
                </div>

                {draft.decision.context && (
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: 'var(--color-cc-text-dim)' }}
                  >
                    {draft.decision.context}
                  </p>
                )}
              </div>
            )}

            {/* ── SESSION ── */}
            {draft.classification === 'session' && (
              <div className="space-y-3">
                <p
                  className="text-[15px] font-medium leading-snug"
                  style={{ color: 'var(--color-cc-text)' }}
                >
                  {draft.session.topic}
                </p>

                <div className="space-y-1.5">
                  {draft.session.seedQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                      style={{ backgroundColor: 'var(--color-cc-surface)' }}
                    >
                      <span
                        className="text-[11px] font-bold tabular-nums w-5 text-center flex-shrink-0 mt-0.5"
                        style={{ color: '#06b6d4' }}
                      >
                        {i + 1}
                      </span>
                      <p
                        className="text-[13px] leading-snug flex-1"
                        style={{ color: 'var(--color-cc-text-secondary)' }}
                      >
                        {q}
                      </p>
                    </div>
                  ))}
                </div>

                {(draft.session.context || draft.session.projectName) && (
                  <div className="space-y-1.5">
                    {draft.session.projectName && (
                      <div className="flex">
                        <Pill
                          icon="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75"
                          text={draft.session.projectName}
                          color="var(--color-cc-accent)"
                        />
                      </div>
                    )}
                    {draft.session.context && (
                      <p
                        className="text-[12px] leading-relaxed"
                        style={{ color: 'var(--color-cc-text-dim)' }}
                      >
                        {draft.session.context}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── NOTE ── */}
            {draft.classification === 'note' && (
              <div className="space-y-2.5">
                {/* Title */}
                <p
                  className="text-[15px] font-medium leading-snug"
                  style={{ color: 'var(--color-cc-text)' }}
                >
                  {draft.note.title}
                </p>

                {/* Content — human-readable text */}
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'var(--color-cc-surface)' }}
                >
                  <p
                    className="text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--color-cc-text-secondary)' }}
                  >
                    {draft.note.content}
                  </p>
                </div>

                {/* Project link */}
                {draft.note.projectName && (
                  <div className="flex">
                    <Pill
                      icon="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75"
                      text={draft.note.projectName}
                      color="var(--color-cc-accent)"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── MESSAGE ── */}
            {draft.classification === 'message' && (
              <div className="space-y-3">
                {/* Recipient + channel header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill
                    icon="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                    text={draft.message.recipientName}
                    color="#3b82f6"
                  />
                  {draft.message.channel !== 'unknown' && (
                    <ChannelBadge channel={draft.message.channel} />
                  )}
                  {draft.message.projectName && (
                    <Pill
                      icon="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75"
                      text={draft.message.projectName}
                      color="var(--color-cc-accent)"
                    />
                  )}
                </div>

                {/* Subject */}
                <p
                  className="text-[14px] font-medium leading-snug"
                  style={{ color: 'var(--color-cc-text)' }}
                >
                  {draft.message.subject}
                </p>

                {/* Message body */}
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: 'var(--color-cc-surface)',
                    borderLeft: '3px solid #3b82f6',
                  }}
                >
                  <p
                    className="text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--color-cc-text-secondary)' }}
                  >
                    {draft.message.body}
                  </p>
                </div>

                {/* Follow-up action */}
                {draft.message.followUpAction && (
                  <div
                    className="flex items-start gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--color-cc-surface)' }}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--color-cc-text-dim)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: 'var(--color-cc-text-dim)' }}
                    >
                      {draft.message.followUpAction}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── COLLABORATOR ── */}
            {draft.classification === 'collaborator' && (
              <div className="space-y-2.5">
                <p
                  className="text-[15px] font-medium leading-snug"
                  style={{ color: 'var(--color-cc-text)' }}
                >
                  {draft.collaborator.name}
                </p>
                {draft.collaborator.role && (
                  <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--color-cc-text-secondary)' }}>
                    <span style={{ color: 'var(--color-cc-text-dim)' }}>Role:</span>
                    {draft.collaborator.role}
                  </div>
                )}
                {draft.collaborator.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.collaborator.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: '#8b5cf620', color: '#8b5cf6' }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                {draft.collaborator.strengths.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {draft.collaborator.strengths.map((s, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: '#22c55e20', color: '#22c55e' }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[12px]" style={{ color: 'var(--color-cc-text-dim)' }}>
                  Availability: {draft.collaborator.availability.replace('_', ' ').toLowerCase()}
                </div>
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }} />

          {/* ── Action bar ── */}
          <div className="p-4 space-y-2">
            <button
              onClick={handleConfirm}
              className="w-full text-[14px] font-semibold rounded-xl transition-all active:scale-[0.98]"
              style={{
                backgroundColor: meta.color,
                color: '#fff',
                height: '48px',
              }}
            >
              {meta.confirmLabel}
            </button>
            <button
              onClick={handleReset}
              className="w-full text-[13px] font-medium rounded-xl transition-all active:scale-[0.98]"
              style={{
                color: 'var(--color-cc-text-muted)',
                height: '44px',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          COMMAND PREVIEW — Show what will happen
          ══════════════════════════════════════════ */}
      {state === 'command_preview' && commandPayload && (() => {
        const cmdMeta = COMMAND_INTENT_META[commandPayload.intent] ?? COMMAND_INTENT_META.create_task
        return (
          <div>
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center gap-2.5"
              style={{ backgroundColor: cmdMeta.color + '10' }}
            >
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: cmdMeta.color + '20' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={cmdMeta.color}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={cmdMeta.icon} />
                </svg>
              </div>
              <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: cmdMeta.color }}>
                {cmdMeta.label}
              </span>
              {voiceSource && (
                <svg className="w-3.5 h-3.5 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--color-cc-text-dim)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              )}
            </div>

            {/* Interpretation */}
            <div className="p-4 space-y-3">
              <p
                className="text-[14px] font-medium leading-snug"
                style={{ color: 'var(--color-cc-text)' }}
              >
                {commandInterpretation}
              </p>

              {/* Command details */}
              <div
                className="rounded-xl px-4 py-3 space-y-2"
                style={{ backgroundColor: 'var(--color-cc-surface)' }}
              >
                <CommandPreviewDetails command={commandPayload} />
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }} />

            {/* Action bar */}
            <div className="p-4 space-y-2">
              <button
                onClick={handleCommandConfirm}
                className="w-full text-[14px] font-semibold rounded-xl transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: cmdMeta.color,
                  color: '#fff',
                  height: '48px',
                }}
              >
                {cmdMeta.confirmLabel}
              </button>
              <button
                onClick={handleReset}
                className="w-full text-[13px] font-medium rounded-xl transition-all active:scale-[0.98]"
                style={{
                  color: 'var(--color-cc-text-muted)',
                  height: '44px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════
          EXECUTION PLAN — Multi-step command preview
          ══════════════════════════════════════════ */}
      {state === 'execution_plan' && multiSteps.length > 0 && (
        <div>
          {/* Header */}
          <div
            className="px-4 py-3 flex items-center gap-2.5"
            style={{ backgroundColor: 'var(--color-cc-accent)' + '10' }}
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-cc-accent)' + '20' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="var(--color-cc-accent)">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </div>
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-cc-accent)' }}>
              Execution Plan
            </span>
            <span className="text-[11px] font-medium ml-auto" style={{ color: 'var(--color-cc-text-muted)' }}>
              {multiSteps.length} steps
            </span>
            {voiceSource && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--color-cc-text-dim)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>

          {/* Interpretation */}
          <div className="px-4 pt-3 pb-2">
            <p
              className="text-[14px] font-medium leading-snug"
              style={{ color: 'var(--color-cc-text)' }}
            >
              {multiStepInterpretation}
            </p>
          </div>

          {/* Step list */}
          <div className="px-4 pb-3 space-y-1.5">
            {multiSteps.map((step, i) => {
              const stepMeta = COMMAND_INTENT_META[step.command.intent] ?? COMMAND_INTENT_META.create_task
              const statusIcon = step.status === 'success'
                ? 'M4.5 12.75l6 6 9-13.5'
                : step.status === 'failed'
                  ? 'M6 18L18 6M6 6l12 12'
                  : step.status === 'executing'
                    ? ''
                    : 'M4.5 12.75l6 6 9-13.5' // pending — shows number
              const statusColor = step.status === 'success'
                ? 'var(--color-cc-success)'
                : step.status === 'failed'
                  ? 'var(--color-cc-fire)'
                  : stepMeta.color

              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3 rounded-xl"
                  style={{
                    backgroundColor: 'var(--color-cc-surface)',
                    minHeight: '44px',
                  }}
                >
                  {/* Step number */}
                  <span
                    className="text-[11px] font-bold tabular-nums w-5 text-center flex-shrink-0"
                    style={{ color: statusColor }}
                  >
                    {i + 1}
                  </span>

                  {/* Intent icon */}
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: stepMeta.color + '15' }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={stepMeta.color}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={stepMeta.icon} />
                    </svg>
                  </div>

                  {/* Command summary */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[12px] font-medium block truncate"
                      style={{ color: 'var(--color-cc-text)' }}
                    >
                      {stepMeta.label}
                    </span>
                    <span
                      className="text-[11px] block truncate"
                      style={{ color: 'var(--color-cc-text-muted)' }}
                    >
                      <MultiStepSummary command={step.command} />
                    </span>
                  </div>

                  {/* Status indicator */}
                  {step.status === 'success' && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="var(--color-cc-success)">
                      <path strokeLinecap="round" strokeLinejoin="round" d={statusIcon} />
                    </svg>
                  )}
                  {step.status === 'failed' && (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="var(--color-cc-fire)">
                      <path strokeLinecap="round" strokeLinejoin="round" d={statusIcon} />
                    </svg>
                  )}

                  {/* Remove button (only when pending) */}
                  {step.status === 'pending' && multiSteps.length > 1 && (
                    <button
                      onClick={() => removeMultiStep(i)}
                      className="flex items-center justify-center rounded-lg transition-colors active:scale-[0.9]"
                      style={{
                        color: 'var(--color-cc-text-dim)',
                        width: '32px',
                        height: '32px',
                        marginRight: '-4px',
                      }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }} />

          {/* Action bar */}
          <div className="p-4 space-y-2">
            <button
              onClick={handleMultiStepConfirm}
              className="w-full text-[14px] font-semibold rounded-xl transition-all active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--color-cc-accent)',
                color: '#fff',
                height: '48px',
              }}
            >
              Execute All ({multiSteps.length} steps)
            </button>
            <button
              onClick={handleReset}
              className="w-full text-[13px] font-medium rounded-xl transition-all active:scale-[0.98]"
              style={{
                color: 'var(--color-cc-text-muted)',
                height: '44px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          EXECUTING — Spinner
          ══════════════════════════════════════════ */}
      {state === 'executing' && (
        <div className="p-5 flex items-center justify-center gap-3">
          <div
            className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{
              borderColor: 'var(--color-cc-border)',
              borderTopColor: commandPayload
                ? (COMMAND_INTENT_META[commandPayload.intent]?.color ?? 'var(--color-cc-accent)')
                : (meta?.color ?? 'var(--color-cc-accent)'),
            }}
          />
          <span className="text-[13px]" style={{ color: 'var(--color-cc-text-secondary)' }}>
            {commandPayload ? 'Executing...' : 'Creating...'}
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════
          DONE — Success
          ══════════════════════════════════════════ */}
      {state === 'done' && (result || commandResult || multiSteps.length > 0) && (
        <div className="p-5 flex items-center justify-center gap-2.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-cc-success)' + '1a' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ color: 'var(--color-cc-success)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-[14px] font-medium" style={{ color: 'var(--color-cc-success)' }}>
            {doneMessage}
          </span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function CommandPreviewDetails({ command }: { command: CommandPayload | null }) {
  if (!command) return null

  const Row = ({ label, value }: { label: string; value: string | null | undefined }) => {
    if (!value) return null
    return (
      <div className="flex items-start gap-2">
        <span
          className="text-[11px] font-medium uppercase tracking-wider whitespace-nowrap pt-px"
          style={{ color: 'var(--color-cc-text-dim)', minWidth: '70px' }}
        >
          {label}
        </span>
        <span
          className="text-[13px] font-medium leading-snug"
          style={{ color: 'var(--color-cc-text)' }}
        >
          {value}
        </span>
      </div>
    )
  }

  switch (command.intent) {
    case 'navigate': {
      const target = command.target.charAt(0).toUpperCase() + command.target.slice(1)
      return (
        <>
          <Row label="Go to" value={target} />
          {command.projectName && <Row label="Project" value={command.projectName} />}
        </>
      )
    }
    case 'create_task':
      return (
        <>
          <Row label="Task" value={command.title} />
          <Row label="Priority" value={command.priority} />
          {command.projectName && <Row label="Project" value={command.projectName} />}
          {command.assigneeName && <Row label="Assignee" value={command.assigneeName} />}
          {command.dueDate && <Row label="Due" value={command.dueDate} />}
        </>
      )
    case 'assign_task':
      return (
        <>
          <Row label="Task" value={command.taskTitle} />
          <Row label="Assign to" value={command.assigneeName} />
        </>
      )
    case 'complete_task':
      return (
        <>
          <Row label="Task" value={command.taskTitle} />
          <Row label="Action" value="Mark as done" />
        </>
      )
    case 'create_project':
      return (
        <>
          <Row label="Project" value={command.name} />
          {command.description && <Row label="About" value={command.description} />}
        </>
      )
    case 'add_member':
      return (
        <>
          <Row label="Person" value={command.personName} />
          <Row label="Project" value={command.projectName} />
          <Row label="Role" value={command.role} />
        </>
      )
    case 'create_event': {
      const start = new Date(command.startAt)
      const dateStr = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      const timeStr = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      return (
        <>
          <Row label="Event" value={command.title} />
          <Row label="When" value={`${dateStr} at ${timeStr}`} />
          {command.location && <Row label="Where" value={command.location} />}
          {command.attendeeNames.length > 0 && (
            <Row label="With" value={command.attendeeNames.join(', ')} />
          )}
        </>
      )
    }
    case 'save_note':
      return (
        <>
          <Row label="Title" value={command.title} />
          {command.projectName && <Row label="Project" value={command.projectName} />}
          <Row label="Content" value={command.content.length > 80 ? command.content.slice(0, 80) + '...' : command.content} />
        </>
      )
  }
}

function PriorityDot({ priority, className = '' }: { priority: string; className?: string }) {
  const colors: Record<string, string> = {
    URGENT: 'var(--color-cc-fire)',
    HIGH: '#f97316',
    MEDIUM: 'var(--color-cc-accent)',
    LOW: 'var(--color-cc-text-dim)',
  }
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${className}`}
      style={{ backgroundColor: colors[priority] ?? colors.MEDIUM }}
    />
  )
}

function MetaPill({ text }: { text: string }) {
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-md truncate max-w-[100px]"
      style={{
        backgroundColor: 'var(--color-cc-border)',
        color: 'var(--color-cc-text-muted)',
      }}
    >
      {text}
    </span>
  )
}

function Pill({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg"
      style={{
        backgroundColor: color + '12',
        color,
      }}
    >
      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      {text}
    </span>
  )
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    HIGH: { bg: 'var(--color-cc-fire-muted)', text: 'var(--color-cc-fire)', label: 'Urgent' },
    MEDIUM: { bg: 'var(--color-cc-risk-muted)', text: 'var(--color-cc-risk)', label: 'Moderate' },
    LOW: { bg: 'var(--color-cc-waste-muted)', text: 'var(--color-cc-waste)', label: 'Low priority' },
  }
  const c = config[urgency] ?? config.MEDIUM
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  )
}

function MultiStepSummary({ command }: { command: CommandPayload }) {
  switch (command.intent) {
    case 'navigate':
      return <>{command.projectName ?? command.target}</>
    case 'create_task':
      return <>{command.title}{command.projectName ? ` → ${command.projectName}` : ''}</>
    case 'assign_task':
      return <>{command.taskTitle} → {command.assigneeName}</>
    case 'complete_task':
      return <>{command.taskTitle}</>
    case 'create_project':
      return <>{command.name}</>
    case 'add_member':
      return <>{command.personName} → {command.projectName}</>
    case 'create_event':
      return <>{command.title}</>
    case 'save_note':
      return <>{command.title}{command.projectName ? ` → ${command.projectName}` : ''}</>
    default:
      return null
  }
}

function ChannelBadge({ channel }: { channel: string }) {
  const config: Record<string, { icon: string; label: string; color: string }> = {
    internal: {
      icon: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
      label: 'Internal',
      color: '#6366f1',
    },
    telegram: {
      icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
      label: 'Telegram',
      color: '#0088cc',
    },
    whatsapp: {
      icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
      label: 'WhatsApp',
      color: '#25d366',
    },
    email: {
      icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
      label: 'Email',
      color: '#ef4444',
    },
    unknown: {
      icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
      label: 'Unknown',
      color: 'var(--color-cc-text-dim)',
    },
  }
  const c = config[channel] ?? config.unknown
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md"
      style={{
        backgroundColor: c.color + '14',
        color: c.color,
      }}
    >
      <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
      </svg>
      {c.label}
    </span>
  )
}
