'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  agentProcessInputAction,
  agentExecuteCommandAction,
  agentExecuteMultiStepAction,
  agentParseCaptureAction,
  agentExecuteCaptureAction,
  agentGetSnapshotAction,
} from '../agent.actions'
import { executeCommandAction, executeMultiStepCommandAction } from '@/modules/command/command.actions'
import { parseCaptureAction, executeCaptureAction } from '@/modules/capture/capture.actions'
import { sendMessageDraftAction } from '@/modules/messages/message-send.actions'
import { useAudioRecorder } from '@/modules/capture/hooks/useAudioRecorder'
import type { AgentResponse, AgentSessionSnapshot, AgentSuggestion } from '../agent.types'
import type { CaptureDraft, CaptureResult } from '@/modules/capture/capture.types'
import type { CommandPayload, CommandResult, MultiStepEntry } from '@/modules/command/command.types'
import type { MessageSendResult } from '@/modules/messages/message-send.service'
import { AgentThinkingSkeleton } from '@/components/Skeleton'
import { getNextActions, type NextAction } from '../agent.continuity'

// ─────────────────────────────────────────────
// AgentInput — Agent Mode UI
//
// Replaces CaptureInput when agent mode is active.
// Key differences from CaptureInput:
//
// 1. Input goes through AgentRouter (context-aware)
// 2. Session persists — no full reset after execution
// 3. Shows "Agent Active" indicator with context
// 4. Handles follow-ups, questions, corrections
// 5. Shows proactive suggestions
// 6. Supports clarification flow
// ─────────────────────────────────────────────

type AgentState =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'draft'                // Capture draft review
  | 'command_preview'      // Single command preview
  | 'execution_plan'       // Multi-step plan preview
  | 'follow_up_preview'    // Follow-up action preview
  | 'clarification'        // Agent asking for clarification
  | 'question_answer'      // Agent answered a question
  | 'executing'
  | 'done'
  | 'error'

// Command metadata (shared with CaptureInput)
const COMMAND_INTENT_META: Record<string, { label: string; color: string; icon: string; confirmLabel: string }> = {
  navigate: { label: 'Navigate', color: '#8b5cf6', icon: 'M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3', confirmLabel: 'Go' },
  create_task: { label: 'Create Task', color: 'var(--color-cc-accent)', icon: 'M12 4.5v15m7.5-7.5h-15', confirmLabel: 'Create Task' },
  assign_task: { label: 'Assign Task', color: '#06b6d4', icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0', confirmLabel: 'Assign' },
  complete_task: { label: 'Complete Task', color: '#22c55e', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', confirmLabel: 'Mark Done' },
  create_project: { label: 'Create Project', color: 'var(--color-cc-accent)', icon: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75', confirmLabel: 'Create Project' },
  add_member: { label: 'Add Member', color: '#f97316', icon: 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z', confirmLabel: 'Add Member' },
  create_event: { label: 'Schedule Event', color: '#f59e0b', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25', confirmLabel: 'Schedule' },
  save_note: { label: 'Save Note', color: '#22c55e', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', confirmLabel: 'Save Note' },
  update_task: { label: 'Update Task', color: '#06b6d4', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125', confirmLabel: 'Update Task' },
  update_event: { label: 'Update Event', color: '#f59e0b', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125', confirmLabel: 'Update Event' },
  update_project: { label: 'Update Project', color: 'var(--color-cc-accent)', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125', confirmLabel: 'Update Project' },
}

const COMMAND_DONE_MESSAGES: Record<string, string> = {
  navigate: 'Navigating...', create_task: 'Task created', assign_task: 'Task assigned',
  complete_task: 'Task completed', create_project: 'Project created', add_member: 'Member added',
  create_event: 'Event scheduled', save_note: 'Note saved',
  update_task: 'Task updated', update_event: 'Event updated', update_project: 'Project updated',
}

// ─── Dynamic placeholder — context-aware input hint ───
function getContextualPlaceholder(
  snapshot: AgentSessionSnapshot | null,
  lastResult: CommandResult | null,
): string {
  // No session context yet
  if (!snapshot || snapshot.actionCount === 0) {
    return 'What needs to happen?'
  }

  // Context-aware hints based on last action's entity type
  const entityType = snapshot.currentEntityType
  const entityName = snapshot.currentEntityName

  if (entityType === 'task' && entityName) {
    return `Assign, set deadline, or continue with "${entityName}"...`
  }
  if (entityType === 'project' && entityName) {
    return `Add tasks, members, or continue with "${entityName}"...`
  }
  if (entityType === 'event' && entityName) {
    return `Add attendees, change time, or continue...`
  }
  if (entityType === 'person' && entityName) {
    return `Assign task, schedule meeting with ${entityName}...`
  }
  if (entityType === 'note') {
    return 'Follow up, ask, or start fresh...'
  }

  // Fallback: has context but no specific entity type
  return 'Follow up, ask, or start fresh...'
}

export function AgentInput() {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Core state ──
  const [state, setState] = useState<AgentState>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [voiceSource, setVoiceSource] = useState(false)

  // ── Agent state ──
  const [agentResponse, setAgentResponse] = useState<AgentResponse | null>(null)
  const [sessionSnapshot, setSessionSnapshot] = useState<AgentSessionSnapshot | null>(null)
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([])

  // ── Command state ──
  const [commandPayload, setCommandPayload] = useState<CommandPayload | null>(null)
  const [commandInterpretation, setCommandInterpretation] = useState('')
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null)

  // ── Multi-step state ──
  const [multiSteps, setMultiSteps] = useState<MultiStepEntry[]>([])
  const [multiStepInterpretation, setMultiStepInterpretation] = useState('')

  // ── Capture state ──
  const [draft, setDraft] = useState<CaptureDraft | null>(null)
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null)
  const [messageSendResult, setMessageSendResult] = useState<MessageSendResult | null>(null)

  // ── Continuity state ──
  const [nextActions, setNextActions] = useState<NextAction[]>([])
  const doneTimerRef = useRef<NodeJS.Timeout | null>(null)

  const recorder = useAudioRecorder()

  // ── Load session snapshot on mount ──
  useEffect(() => {
    agentGetSnapshotAction().then((r) => {
      if (r.success) setSessionSnapshot(r.data)
    })
  }, [])

  // ── Auto-grow textarea ──
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  // ── Main submit: route through agent ──
  const submitText = useCallback(async (inputText: string) => {
    if (!inputText.trim()) return
    setState('thinking')
    setError(null)
    setSuggestions([])

    const result = await agentProcessInputAction({ text: inputText.trim() })

    if (!result.success) {
      setError(result.error)
      setState('error')
      return
    }

    const response = result.data
    setAgentResponse(response)
    setSessionSnapshot(response.sessionSnapshot)

    // Store suggestions
    if (response.routing.suggestions?.length) {
      setSuggestions(response.routing.suggestions)
    }

    const { routing } = response

    switch (routing.inputType) {
      case 'command': {
        if (routing.clarificationNeeded) {
          setState('clarification')
          return
        }
        if (routing.command) {
          setCommandPayload(routing.command)
          setCommandInterpretation(routing.interpretation)
          setState('command_preview')
        }
        break
      }

      case 'multi_step': {
        if (routing.commands) {
          const steps: MultiStepEntry[] = routing.commands.map((cmd: CommandPayload) => ({
            command: cmd,
            interpretation: COMMAND_INTENT_META[cmd.intent]?.label ?? cmd.intent,
            status: 'pending' as const,
          }))
          setMultiSteps(steps)
          setMultiStepInterpretation(routing.interpretation)
          setState('execution_plan')
        }
        break
      }

      case 'capture': {
        // Route to capture pipeline
        const captureText = routing.captureText ?? inputText.trim()
        const parseResult = await agentParseCaptureAction({ text: captureText })
        if (parseResult.success) {
          setDraft(parseResult.data)
          setState('draft')
        } else {
          setError(parseResult.error)
          setState('error')
        }
        break
      }

      case 'follow_up': {
        if (routing.command) {
          setCommandPayload(routing.command)
          setCommandInterpretation(routing.interpretation)
          setState('follow_up_preview')
        } else if (routing.clarificationNeeded) {
          setState('clarification')
        }
        break
      }

      case 'question': {
        // Answer displayed, no execution needed
        setState('question_answer')
        break
      }

      case 'clarification_response': {
        if (routing.command) {
          setCommandPayload(routing.command)
          setCommandInterpretation(routing.interpretation)
          setState('command_preview')
        }
        break
      }

      case 'correction': {
        if (routing.command) {
          setCommandPayload(routing.command)
          setCommandInterpretation(routing.interpretation)
          setState('command_preview')
        } else if (routing.clarificationNeeded) {
          setState('clarification')
        }
        break
      }
    }
  }, [])

  // ── Text submit ──
  const handleSubmit = useCallback(async () => {
    if (!text.trim() || state === 'thinking') return
    setVoiceSource(false)
    await submitText(text)
  }, [text, state, submitText])

  // ── Voice recording ──
  const handleStartRecording = useCallback(() => {
    setError(null)
    setVoiceSource(true)
    recorder.start()
    setState('recording')
  }, [recorder])

  const handleStopRecording = useCallback(async () => {
    setState('transcribing')
    const blob = await recorder.stop()

    if (!blob || blob.size === 0) {
      setError('No audio captured')
      setState('error')
      return
    }

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'capture.webm')
      const response = await fetch('/api/capture/transcribe', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok || !data.text) {
        setError(data.error || 'Transcription failed')
        setState('error')
        return
      }

      setText(data.text)
      await submitText(data.text)
    } catch {
      setError('Could not transcribe audio')
      setState('error')
    }
  }, [recorder, submitText])

  const handleCancelRecording = useCallback(() => {
    recorder.cancel()
    setState('idle')
    setVoiceSource(false)
  }, [recorder])

  // ── Flow reset: transition from done→idle while refreshing session snapshot ──
  // Continuous flow: keeps the system "warm" with context
  const flowReset = useCallback(() => {
    setState('idle')
    setText('')
    setDraft(null)
    setCommandPayload(null)
    setCommandInterpretation('')
    // Preserve commandResult briefly for context-aware placeholder
    setMultiSteps([])
    setMultiStepInterpretation('')
    setCaptureResult(null)
    setMessageSendResult(null)
    setVoiceSource(false)
    setAgentResponse(null)
    setNextActions([])
    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null }
    // Refresh session snapshot to get latest context
    agentGetSnapshotAction().then((r) => {
      if (r.success) setSessionSnapshot(r.data)
    })
    // Clear commandResult after a tick so placeholder can use it
    setTimeout(() => setCommandResult(null), 100)
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }, [])

  // ── Command confirm (shared for command, follow_up, correction) ──
  const handleCommandConfirm = useCallback(async () => {
    if (!commandPayload) return
    setState('executing')

    const response = await agentExecuteCommandAction(commandPayload, commandInterpretation)
    if (response.success) {
      setCommandResult(response.data)
      setState('done')

      // Compute continuity actions
      const actions = getNextActions(response.data)
      setNextActions(actions)

      if (response.data.intent === 'navigate' && 'path' in response.data) {
        setTimeout(() => router.push((response.data as { intent: 'navigate'; path: string }).path), 400)
      }

      // Continuous flow: refresh data but DON'T reset to idle.
      // Keep the "done" state visible with next-actions until user acts or timeout.
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
      router.refresh()
      // Only auto-collapse after extended period if no next actions
      if (actions.length === 0) {
        doneTimerRef.current = setTimeout(() => {
          flowReset()
        }, 5000)
      }
      // With next actions: stay in done indefinitely until user interacts
    } else {
      setError(response.error)
      setState('error')
    }
  }, [commandPayload, commandInterpretation, router])

  // ── Multi-step confirm ──
  const handleMultiStepConfirm = useCallback(async () => {
    if (multiSteps.length === 0) return
    setState('executing')

    const response = await agentExecuteMultiStepAction(multiSteps, multiStepInterpretation)
    if (response.success) {
      setMultiSteps(response.data)
      const lastSuccess = [...response.data].reverse().find((s: MultiStepEntry) => s.status === 'success')
      if (lastSuccess?.result?.intent === 'navigate' && 'path' in lastSuccess.result) {
        setTimeout(() => router.push((lastSuccess.result as { intent: 'navigate'; path: string }).path), 400)
      }
      setState('done')
      router.refresh()
      doneTimerRef.current = setTimeout(() => { flowReset() }, 5000)
    } else {
      setError(response.error)
      setState('error')
    }
  }, [multiSteps, multiStepInterpretation, router, flowReset])

  // ── Capture confirm ──
  const handleCaptureConfirm = useCallback(async () => {
    if (!draft) return
    setState('executing')

    const response = await agentExecuteCaptureAction(draft, agentResponse?.routing?.interpretation ?? '')
    if (response.success) {
      setCaptureResult(response.data)

      // Handle message sending
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
        if (sendResult.success) setMessageSendResult(sendResult.data)
      }

      setState('done')
      router.refresh()
      doneTimerRef.current = setTimeout(() => { flowReset() }, 5000)
    } else {
      setError(response.error)
      setState('error')
    }
  }, [draft, agentResponse, router, flowReset])

  // ── Multi-step remove step ──
  const removeMultiStep = useCallback((index: number) => {
    setMultiSteps(prev => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length === 1) {
        setCommandPayload(next[0].command)
        setCommandInterpretation(next[0].interpretation)
        setState('command_preview')
        return []
      }
      return next
    })
  }, [])

  // ── Suggestion action: inject suggestion as next input ──
  const handleSuggestionClick = useCallback((suggestion: AgentSuggestion) => {
    if (suggestion.actionHint) {
      setCommandPayload(suggestion.actionHint)
      setCommandInterpretation(suggestion.message)
      setState('command_preview')
      setSuggestions([])
    }
  }, [])

  // ── Soft reset: clear input state but preserve session ──
  const softReset = useCallback(() => {
    setState('idle')
    setText('')
    setDraft(null)
    setCommandPayload(null)
    setCommandInterpretation('')
    setCommandResult(null)
    setMultiSteps([])
    setMultiStepInterpretation('')
    setCaptureResult(null)
    setMessageSendResult(null)
    setVoiceSource(false)
    setAgentResponse(null)
    setNextActions([])
    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null }
    // NOTE: sessionSnapshot and suggestions are PRESERVED
    if (inputRef.current) inputRef.current.style.height = 'auto'
  }, [])

  // ── Hard reset: also clears suggestions ──
  const handleReset = useCallback(() => {
    softReset()
    setError(null)
    setSuggestions([])
    inputRef.current?.focus()
  }, [softReset])

  // ── Keyboard ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  // ── Elapsed time formatter ──
  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── Done message ──
  const multiStepDoneCount = multiSteps.filter(s => s.status === 'success').length
  const multiStepFailCount = multiSteps.filter(s => s.status === 'failed').length
  const doneMessage = multiSteps.length > 0
    ? (multiStepFailCount > 0 ? `${multiStepDoneCount} done, ${multiStepFailCount} failed` : `All ${multiStepDoneCount} commands executed`)
    : commandResult ? COMMAND_DONE_MESSAGES[commandResult.intent] ?? 'Done'
    : captureResult ? 'Saved' : ''

  return (
    <div className="os-input overflow-hidden">

      {/* ═══ IDLE / ERROR — Command line feel ═══ */}
      {(state === 'idle' || state === 'error') && (
        <div className="px-5 py-4">
          {/* Suggestions — subtle, inline */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    color: 'var(--color-cc-accent)',
                  }}
                >
                  {s.message}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={getContextualPlaceholder(sessionSnapshot, commandResult)}
              rows={1}
              className="flex-1 bg-transparent text-[19px] leading-relaxed placeholder:text-[var(--color-cc-text-dim)] resize-none outline-none py-1"
              style={{ color: 'var(--color-cc-text)', minHeight: '36px' }}
            />

            {/* Mic — small, ghost */}
            <button
              onClick={handleStartRecording}
              className="flex items-center justify-center rounded-full transition-all active:scale-[0.92] flex-shrink-0"
              style={{ width: '36px', height: '36px', color: 'var(--color-cc-text-muted)' }}
              aria-label="Record voice"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Submit — arrow, only when there's text */}
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="flex items-center justify-center rounded-full transition-all disabled:opacity-0 active:scale-[0.90] flex-shrink-0"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: text.trim() ? 'var(--color-cc-accent)' : 'transparent',
                color: '#fff',
              }}
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          </div>

          {state === 'error' && error && (
            <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--color-cc-fire-muted)' }}>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-cc-fire)' }}>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ RECORDING ═══ */}
      {state === 'recording' && (
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-cc-fire)' }} />
              <span className="text-[13px] tabular-nums font-medium" style={{ color: 'var(--color-cc-text)' }}>{formatElapsed(recorder.elapsed)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelRecording}
                className="text-[12px] font-medium px-3 py-1.5 rounded-full transition-all active:scale-[0.97]"
                style={{ color: 'var(--color-cc-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleStopRecording}
                className="flex items-center justify-center rounded-full transition-all active:scale-[0.93]"
                style={{ width: '36px', height: '36px', backgroundColor: 'var(--color-cc-fire)' }}
                aria-label="Stop recording"
              >
                <span className="block rounded-sm" style={{ width: '12px', height: '12px', backgroundColor: '#fff' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TRANSCRIBING ═══ */}
      {state === 'transcribing' && (
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(0,0,0,0.08)', borderTopColor: 'var(--color-cc-text-secondary)' }} />
          <span className="text-[13px]" style={{ color: 'var(--color-cc-text-muted)' }}>Transcribing...</span>
        </div>
      )}

      {/* ═══ THINKING ═══ */}
      {state === 'thinking' && (
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(0,0,0,0.08)', borderTopColor: 'var(--color-cc-accent)' }} />
          <span className="text-[13px] truncate" style={{ color: 'var(--color-cc-text-muted)' }}>
            {voiceSource && text ? text : 'Thinking...'}
          </span>
        </div>
      )}

      {/* ═══ COMMAND PREVIEW (also follow_up_preview) ═══ */}
      {(state === 'command_preview' || state === 'follow_up_preview') && commandPayload && (
        <div>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-2.5">
              {/* Intent icon */}
              {(() => {
                const meta = COMMAND_INTENT_META[commandPayload.intent]
                return meta ? (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: meta.color + '1a' }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke={meta.color}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                    </svg>
                  </div>
                ) : null
              })()}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: COMMAND_INTENT_META[commandPayload.intent]?.color ?? 'var(--color-cc-accent)' }}>
                    {state === 'follow_up_preview' ? 'Follow-up' : COMMAND_INTENT_META[commandPayload.intent]?.label}
                  </span>
                  {voiceSource && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ color: 'var(--color-cc-text-dim)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>
                <p className="text-[14px] leading-snug mt-0.5" style={{ color: 'var(--color-cc-text-secondary)' }}>
                  {commandInterpretation}
                </p>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }} />

          {/* Command details */}
          <div className="px-4 py-3">
            <div className="px-3 py-3 rounded-xl text-[14px] space-y-1.5" style={{ backgroundColor: 'var(--color-cc-bg)', color: 'var(--color-cc-text-secondary)' }}>
              {Object.entries(commandPayload)
                .filter(([k]) => k !== 'intent')
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>{k}</span>
                    <span className="text-[14px]" style={{ color: 'var(--color-cc-text)' }}>
                      {Array.isArray(v) ? v.join(', ') : String(v)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-4 pb-4 flex items-center gap-2">
            <button
              onClick={handleCommandConfirm}
              className="flex-1 text-[15px] font-semibold rounded-xl transition-all active:scale-[0.98]"
              style={{ backgroundColor: COMMAND_INTENT_META[commandPayload.intent]?.color ?? 'var(--color-cc-accent)', color: '#fff', height: '50px' }}
            >
              {COMMAND_INTENT_META[commandPayload.intent]?.confirmLabel ?? 'Execute'}
            </button>
            <button
              onClick={handleReset}
              className="text-[13px] font-medium rounded-xl transition-all active:scale-[0.97]"
              style={{ color: 'var(--color-cc-text-muted)', height: '48px', padding: '0 16px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══ EXECUTION PLAN (multi-step) ═══ */}
      {state === 'execution_plan' && multiSteps.length > 0 && (
        <div>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-cc-accent)' }}>
                Execution Plan
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--color-cc-surface-elevated)', color: 'var(--color-cc-text-muted)' }}>
                {multiSteps.length} steps
              </span>
            </div>
            <p className="text-[13px] mt-1" style={{ color: 'var(--color-cc-text-secondary)' }}>{multiStepInterpretation}</p>
          </div>

          <div style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }} />

          <div className="px-4 py-3 space-y-1.5">
            {multiSteps.map((step, i) => {
              const meta = COMMAND_INTENT_META[step.command.intent]
              return (
                <div key={i} className="flex items-center gap-2.5 px-3 rounded-xl" style={{ backgroundColor: 'var(--color-cc-surface)', minHeight: '44px' }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (meta?.color ?? '#666') + '1a' }}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={meta?.color ?? '#666'}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={meta?.icon ?? 'M12 4.5v15m7.5-7.5h-15'} />
                    </svg>
                  </div>
                  <span className="text-[13px] flex-1 truncate" style={{ color: 'var(--color-cc-text-secondary)' }}>{step.interpretation}</span>
                  <button onClick={() => removeMultiStep(i)} className="flex items-center justify-center rounded-lg" style={{ color: 'var(--color-cc-text-dim)', width: '36px', height: '36px' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          <div className="px-4 pb-4 flex items-center gap-2">
            <button onClick={handleMultiStepConfirm} className="flex-1 text-[14px] font-semibold rounded-xl transition-all active:scale-[0.98]" style={{ backgroundColor: 'var(--color-cc-accent)', color: '#fff', height: '48px' }}>
              Execute All
            </button>
            <button onClick={handleReset} className="text-[13px] font-medium rounded-xl" style={{ color: 'var(--color-cc-text-muted)', height: '48px', padding: '0 16px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══ CLARIFICATION ═══ */}
      {state === 'clarification' && agentResponse?.routing?.clarificationNeeded && (
        <div className="p-4">
          <div className="flex items-start gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#f59e0b1a' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="#f59e0b">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Clarification Needed</span>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-cc-text-secondary)' }}>
                {agentResponse.routing.clarificationNeeded.question}
              </p>
            </div>
          </div>

          {/* Option buttons */}
          {agentResponse.routing.clarificationNeeded.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {agentResponse.routing.clarificationNeeded.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => { setText(opt); submitText(opt) }}
                  className="text-[12px] font-medium px-3 py-2 rounded-lg transition-all active:scale-[0.96]"
                  style={{ backgroundColor: 'var(--color-cc-surface-elevated)', color: 'var(--color-cc-text)', minHeight: '44px' }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Free-form response */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            rows={1}
            className="w-full bg-transparent text-[15px] leading-relaxed placeholder:text-[var(--color-cc-text-dim)] resize-none outline-none mb-2"
            style={{ color: 'var(--color-cc-text)', minHeight: '44px' }}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSubmit} disabled={!text.trim()} className="flex-1 text-[14px] font-semibold rounded-xl transition-all disabled:opacity-25 active:scale-[0.98]" style={{ backgroundColor: 'var(--color-cc-accent)', color: '#fff', height: '48px' }}>
              Send
            </button>
            <button onClick={handleReset} className="text-[13px] font-medium rounded-xl" style={{ color: 'var(--color-cc-text-muted)', height: '48px', padding: '0 16px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══ QUESTION ANSWER ═══ */}
      {state === 'question_answer' && agentResponse && (
        <div className="p-4">
          <div className="flex items-start gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: '#3b82f61a' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="#3b82f6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#3b82f6' }}>Answer</span>
              <p className="text-[14px] mt-1 leading-relaxed" style={{ color: 'var(--color-cc-text)' }}>
                {agentResponse.routing.answer ?? agentResponse.routing.interpretation}
              </p>
            </div>
          </div>

          {/* Continue conversation */}
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Follow up or start something new..."
            rows={1}
            className="w-full bg-transparent text-[15px] leading-relaxed placeholder:text-[var(--color-cc-text-dim)] resize-none outline-none mb-2"
            style={{ color: 'var(--color-cc-text)', minHeight: '44px' }}
          />
          <div className="flex items-center gap-2">
            <button onClick={handleSubmit} disabled={!text.trim()} className="flex-1 text-[14px] font-semibold rounded-xl transition-all disabled:opacity-25 active:scale-[0.98]" style={{ backgroundColor: 'var(--color-cc-accent)', color: '#fff', height: '48px' }}>
              Send
            </button>
            <button onClick={handleReset} className="text-[13px] font-medium rounded-xl" style={{ color: 'var(--color-cc-text-muted)', height: '48px', padding: '0 16px' }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* ═══ DRAFT REVIEW (capture) ═══ */}
      {state === 'draft' && draft && (
        <div>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start gap-2.5">
              {/* Classification icon */}
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{
                backgroundColor: draft.classification === 'collaborator' ? '#f971161a'
                  : draft.classification === 'message' ? '#06b6d41a'
                  : draft.classification === 'note' ? '#22c55e1a'
                  : 'var(--color-cc-accent)' + '1a'
              }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke={
                  draft.classification === 'collaborator' ? '#f97316'
                    : draft.classification === 'message' ? '#06b6d4'
                    : draft.classification === 'note' ? '#22c55e'
                    : 'var(--color-cc-accent)'
                }>
                  <path strokeLinecap="round" strokeLinejoin="round" d={
                    draft.classification === 'collaborator'
                      ? 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0'
                      : draft.classification === 'message'
                      ? 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75'
                      : draft.classification === 'note'
                      ? 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'
                      : 'M12 4.5v15m7.5-7.5h-15'
                  } />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{
                  color: draft.classification === 'collaborator' ? '#f97316'
                    : draft.classification === 'message' ? '#06b6d4'
                    : draft.classification === 'note' ? '#22c55e'
                    : 'var(--color-cc-accent)'
                }}>
                  {draft.classification === 'collaborator' ? 'New Collaborator'
                    : draft.classification === 'message' ? 'Message Draft'
                    : draft.classification === 'note' ? 'Save Note'
                    : draft.classification.charAt(0).toUpperCase() + draft.classification.slice(1)}
                </span>
                <p className="text-[13px] leading-snug mt-0.5" style={{ color: 'var(--color-cc-text-secondary)' }}>
                  {draft.interpretation}
                </p>
              </div>
            </div>
          </div>

          {/* Draft details */}
          <div style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }} />
          <div className="px-4 py-3">
            <div className="px-3 py-2.5 rounded-xl text-[13px] space-y-1" style={{ backgroundColor: 'var(--color-cc-surface-elevated)', color: 'var(--color-cc-text-secondary)' }}>
              {draft.classification === 'note' && draft.note && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>title</span>
                    <span className="text-[13px]" style={{ color: 'var(--color-cc-text)' }}>{draft.note.title}</span>
                  </div>
                  {draft.note.projectName && (
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>project</span>
                      <span className="text-[13px]" style={{ color: 'var(--color-cc-text)' }}>{draft.note.projectName}</span>
                    </div>
                  )}
                </>
              )}
              {draft.classification === 'collaborator' && draft.collaborator && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>name</span>
                    <span className="text-[13px]" style={{ color: 'var(--color-cc-text)' }}>{draft.collaborator.name}</span>
                  </div>
                  {draft.collaborator.role && (
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>role</span>
                      <span className="text-[13px]" style={{ color: 'var(--color-cc-text)' }}>{draft.collaborator.role}</span>
                    </div>
                  )}
                  {draft.collaborator.skills?.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>skills</span>
                      <span className="text-[13px]" style={{ color: 'var(--color-cc-text)' }}>{draft.collaborator.skills.join(', ')}</span>
                    </div>
                  )}
                </>
              )}
              {draft.classification === 'message' && draft.message && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>to</span>
                    <span className="text-[13px]" style={{ color: 'var(--color-cc-text)' }}>{draft.message.recipientName}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>via</span>
                    <span className="text-[13px]" style={{ color: 'var(--color-cc-text)' }}>{draft.message.channel}</span>
                  </div>
                  {draft.message.subject && (
                    <div className="flex items-start gap-2">
                      <span className="text-[11px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5" style={{ color: 'var(--color-cc-text-muted)' }}>subject</span>
                      <span className="text-[13px]" style={{ color: 'var(--color-cc-text)' }}>{draft.message.subject}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="px-4 pb-4 flex items-center gap-2">
            <button onClick={handleCaptureConfirm} className="flex-1 text-[14px] font-semibold rounded-xl transition-all active:scale-[0.98]" style={{
              backgroundColor: draft.classification === 'collaborator' ? '#f97316'
                : draft.classification === 'message' ? '#06b6d4'
                : draft.classification === 'note' ? '#22c55e'
                : 'var(--color-cc-accent)',
              color: '#fff', height: '48px'
            }}>
              {draft.classification === 'collaborator' ? 'Add Collaborator'
                : draft.classification === 'message' ? 'Send Message'
                : draft.classification === 'note' ? 'Save Note'
                : 'Confirm'}
            </button>
            <button onClick={handleReset} className="text-[13px] font-medium rounded-xl" style={{ color: 'var(--color-cc-text-muted)', height: '48px', padding: '0 16px' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══ EXECUTING ═══ */}
      {state === 'executing' && (
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(0,0,0,0.08)', borderTopColor: commandPayload ? (COMMAND_INTENT_META[commandPayload.intent]?.color ?? 'var(--color-cc-accent)') : 'var(--color-cc-accent)' }} />
          <span className="text-[13px]" style={{ color: 'var(--color-cc-text-muted)' }}>
            {commandPayload
              ? (COMMAND_INTENT_META[commandPayload.intent]?.label === 'Navigate' ? 'Navigating...'
                : `${COMMAND_INTENT_META[commandPayload.intent]?.confirmLabel ?? 'Processing'}...`)
              : draft
              ? (draft.classification === 'note' ? 'Saving...'
                : draft.classification === 'message' ? 'Sending...'
                : draft.classification === 'collaborator' ? 'Adding...'
                : 'Saving...')
              : multiSteps.length > 0
              ? `Executing ${multiSteps.length} steps...`
              : 'Processing...'}
          </span>
        </div>
      )}

      {/* ═══ DONE ═══ */}
      {state === 'done' && (
        <div className="p-4">
          {/* Result card */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{
              backgroundColor: commandResult
                ? (COMMAND_INTENT_META[commandResult.intent]?.color ?? '#22c55e') + '1a'
                : '#22c55e1a'
            }}>
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={
                commandResult ? (COMMAND_INTENT_META[commandResult.intent]?.color ?? '#22c55e') : '#22c55e'
              }>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-bold uppercase tracking-wider" style={{
                color: commandResult ? (COMMAND_INTENT_META[commandResult.intent]?.color ?? '#22c55e') : '#22c55e'
              }}>
                {doneMessage}
              </span>
              {/* Entity name as clickable link */}
              {commandResult && 'entityName' in commandResult && commandResult.entityName && (
                <p className="text-[15px] font-medium mt-0.5 truncate" style={{ color: 'var(--color-cc-text)' }}>
                  {'entityLink' in commandResult && commandResult.entityLink ? (
                    <button
                      onClick={() => { router.push((commandResult as any).entityLink); softReset() }}
                      className="hover:underline text-left truncate block w-full"
                      style={{ color: 'var(--color-cc-accent)' }}
                    >
                      {commandResult.entityName}
                    </button>
                  ) : (
                    commandResult.entityName
                  )}
                </p>
              )}
              {/* Context: project, assignee, updated fields */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {commandResult && 'projectName' in commandResult && (commandResult as any).projectName && (
                  <span className="text-[12px] px-2 py-0.5 rounded-full" style={{
                    backgroundColor: 'var(--color-cc-surface-elevated)',
                    color: 'var(--color-cc-text-secondary)',
                  }}>
                    {(commandResult as any).projectName}
                  </span>
                )}
                {commandResult && 'assigneeName' in commandResult && (commandResult as any).assigneeName && (
                  <span className="text-[12px] px-2 py-0.5 rounded-full" style={{
                    backgroundColor: 'var(--color-cc-surface-elevated)',
                    color: 'var(--color-cc-text-secondary)',
                  }}>
                    {(commandResult as any).assigneeName}
                  </span>
                )}
                {commandResult && 'updatedFields' in commandResult && (commandResult as any).updatedFields?.length > 0 && (
                  <span className="text-[12px]" style={{ color: 'var(--color-cc-text-muted)' }}>
                    Changed: {(commandResult as any).updatedFields.join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* AI Suggestion pills */}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2" style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }}>
              {suggestions.slice(0, 3).map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (s.actionHint) {
                      setCommandPayload(s.actionHint)
                      setCommandInterpretation(s.message)
                      setState('command_preview')
                    } else {
                      setText(s.message)
                      submitText(s.message)
                    }
                  }}
                  className="text-[12px] font-medium px-3 py-2 rounded-xl transition-all active:scale-[0.96]"
                  style={{
                    backgroundColor: 'var(--color-cc-surface-elevated)',
                    color: 'var(--color-cc-accent)',
                  }}
                >
                  {s.message}
                </button>
              ))}
            </div>
          )}
          {/* Continuous flow — inline input in done state */}
          <div className="pt-2" style={{ borderTop: '1px solid var(--color-cc-border-subtle)' }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (text.trim()) {
                      if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null }
                      softReset()
                      setTimeout(() => submitText(text.trim()), 50)
                    }
                  }
                }}
                placeholder={getContextualPlaceholder(sessionSnapshot, commandResult)}
                rows={1}
                className="flex-1 bg-transparent text-[14px] leading-relaxed placeholder:text-[var(--color-cc-text-dim)] resize-none outline-none py-1"
                style={{ color: 'var(--color-cc-text)', minHeight: '28px' }}
              />
              <button
                onClick={() => {
                  if (text.trim()) {
                    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null }
                    const inputText = text.trim()
                    softReset()
                    setTimeout(() => submitText(inputText), 50)
                  }
                }}
                disabled={!text.trim()}
                className="flex items-center justify-center rounded-full transition-all disabled:opacity-0 active:scale-[0.90] flex-shrink-0"
                style={{
                  width: '28px',
                  height: '28px',
                  backgroundColor: text.trim() ? 'var(--color-cc-accent)' : 'transparent',
                  color: '#fff',
                }}
                aria-label="Send follow-up"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
          {/* Continuity — deterministic next actions */}
          {nextActions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2" style={{
              borderTop: suggestions.length > 0 ? 'none' : '1px solid var(--color-cc-border-subtle)',
            }}>
              {nextActions.map((action, i) => (
                <button
                  key={`na-${i}`}
                  onClick={() => {
                    if (doneTimerRef.current) { clearTimeout(doneTimerRef.current); doneTimerRef.current = null }
                    if (action.autoSubmit) {
                      softReset()
                      setTimeout(() => {
                        setText(action.command)
                        submitText(action.command)
                      }, 50)
                    } else {
                      softReset()
                      setTimeout(() => {
                        setText(action.command)
                        if (inputRef.current) {
                          inputRef.current.focus()
                          inputRef.current.setSelectionRange(action.command.length, action.command.length)
                        }
                      }, 50)
                    }
                  }}
                  className="text-[12px] font-medium px-3 py-2 rounded-xl transition-all active:scale-[0.96]"
                  style={{
                    backgroundColor: 'var(--color-cc-surface-elevated)',
                    color: 'var(--color-cc-text)',
                    border: '1px solid var(--color-cc-border-subtle)',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
