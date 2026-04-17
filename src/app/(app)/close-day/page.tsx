'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import { useSpeech } from '@/hooks/useSpeech'
import {
  executeCloseDayAction,
  getCloseDayAction,
} from '@/modules/operational/close-day/close-day.actions'

// ─── Helpers ───

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Types for display ───

type ExecuteResult = {
  recordId: string
  aiSummary: string
  isAI: boolean
  wasUpdate: boolean
  summary: {
    aiNarrative?: string
    totalDelivered: number
    totalNotDelivered: number
    totalCarryOver: number
    completionRate: number
  }
  deliveredCount: number
  notDeliveredCount: number
  carryOverCount: number
  escalationCount: number
  riskCount: number
  date: string
  dayOfWeek: string
}

type ExistingRecord = {
  id: string
  date: string
  data: unknown
  aiSummary: string
  createdAt: string
}

// ─── Component ───

export default function CloseDayPage() {
  const [dateStr, setDateStr] = useState(todayStr())
  const [loading, setLoading] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExecuteResult | null>(null)
  const [existing, setExisting] = useState<ExistingRecord | null>(null)
  const [mode, setMode] = useState<'idle' | 'executed' | 'loaded'>('idle')
  const { speak, stop, isSpeaking } = useSpeech()

  async function handleExecute() {
    if (loading) return
    setError('')
    setResult(null)
    setExisting(null)
    setLoading(true)
    try {
      const res = await executeCloseDayAction(dateStr)
      if (res.success) {
        setResult(res.data as ExecuteResult)
        setMode('executed')
      } else {
        setError(res.error || 'Failed to execute Close Day')
      }
    } catch {
      setError('Failed to execute Close Day')
    } finally {
      setLoading(false)
    }
  }

  async function handleLoad() {
    if (loadingExisting) return
    setError('')
    setResult(null)
    setExisting(null)
    setLoadingExisting(true)
    try {
      const res = await getCloseDayAction(dateStr)
      if (res.success) {
        if (res.data) {
          setExisting(res.data as unknown as ExistingRecord)
          setMode('loaded')
        } else {
          setError('No Close Day record found for this date.')
          setMode('idle')
        }
      } else {
        setError(res.error || 'Failed to load record')
      }
    } catch {
      setError('Failed to load record')
    } finally {
      setLoadingExisting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--color-cc-bg)]">
      <Header title="Close Day" backHref="/" />

      <div className="px-4 pt-4 pb-8 max-w-lg mx-auto space-y-5">

        {/* Date selector */}
        <div className="space-y-2">
          <label
            className="block text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
          >
            Date
          </label>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => {
              setDateStr(e.target.value)
              setMode('idle')
              setResult(null)
              setExisting(null)
              setError('')
            }}
            className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--color-cc-text, #fff)',
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleLoad}
            disabled={loadingExisting || loading}
            className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-40"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--color-cc-text-secondary, #e0e0e8)',
            }}
          >
            {loadingExisting ? 'Loading...' : 'Load Existing'}
          </button>
          <button
            onClick={handleExecute}
            disabled={loading || loadingExisting}
            className="flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.97] disabled:opacity-40"
            style={{
              background: 'var(--color-cc-accent, #7c6ef6)',
              color: '#fff',
            }}
          >
            {loading ? 'Running...' : 'Run Close Day'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {/* Execute result */}
        {mode === 'executed' && result && (
          <div className="space-y-4">
            {/* Status badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: '#2dd882' }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
              >
                {result.wasUpdate ? 'Record updated' : 'Record created'} — {result.dayOfWeek}, {result.date}
                {' '} — {result.isAI ? 'AI summary' : 'Fallback summary'}
              </span>
            </div>

            {/* Completion rate */}
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{
                background: 'rgba(45, 216, 130, 0.06)',
                border: '1px solid rgba(45, 216, 130, 0.12)',
              }}
            >
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
              >
                Completion Rate
              </span>
              <span
                className="text-xl font-bold"
                style={{
                  color: result.summary.completionRate >= 0.8 ? '#2dd882'
                    : result.summary.completionRate >= 0.5 ? '#ffb545'
                    : '#ef4444',
                }}
              >
                {Math.round(result.summary.completionRate * 100)}%
              </span>
            </div>

            {/* AI Summary */}
            <div
              className="rounded-2xl px-4 py-4"
              style={{
                background: 'rgba(124,110,246,0.06)',
                border: '1px solid rgba(124,110,246,0.12)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-cc-accent, #7c6ef6)' }}
                >
                  Operator Debrief
                </p>
                <button
                  onClick={() => isSpeaking ? stop() : speak(result.aiSummary)}
                  className="text-xs font-semibold px-3 py-1 rounded-lg transition-all active:scale-[0.95]"
                  style={{
                    background: isSpeaking ? 'rgba(239,68,68,0.12)' : 'rgba(124,110,246,0.12)',
                    color: isSpeaking ? '#ef4444' : 'var(--color-cc-accent, #7c6ef6)',
                  }}
                >
                  {isSpeaking ? 'Stop' : 'Play Debrief'}
                </button>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-cc-text, #fff)' }}
              >
                {result.aiSummary}
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Delivered" value={result.deliveredCount} good />
              <StatCard label="Not Delivered" value={result.notDeliveredCount} warn />
              <StatCard label="Carry Over" value={result.carryOverCount} />
              <StatCard label="Escalations" value={result.escalationCount} warn />
              <StatCard label="Risks" value={result.riskCount} warn />
              <StatCard label="Tomorrow" value={result.summary.totalCarryOver} />
            </div>

            {/* Meta */}
            <div
              className="text-xs space-y-1"
              style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
            >
              <p>Record ID: {result.recordId}</p>
            </div>
          </div>
        )}

        {/* Loaded existing record */}
        {mode === 'loaded' && existing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: 'var(--color-cc-accent, #7c6ef6)' }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
              >
                Existing record — created {new Date(existing.createdAt).toLocaleString()}
              </span>
            </div>

            <div
              className="rounded-2xl px-4 py-4"
              style={{
                background: 'rgba(124,110,246,0.06)',
                border: '1px solid rgba(124,110,246,0.12)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-cc-accent, #7c6ef6)' }}
                >
                  Stored Debrief
                </p>
                <button
                  onClick={() => isSpeaking ? stop() : speak(existing.aiSummary)}
                  className="text-xs font-semibold px-3 py-1 rounded-lg transition-all active:scale-[0.95]"
                  style={{
                    background: isSpeaking ? 'rgba(239,68,68,0.12)' : 'rgba(124,110,246,0.12)',
                    color: isSpeaking ? '#ef4444' : 'var(--color-cc-accent, #7c6ef6)',
                  }}
                >
                  {isSpeaking ? 'Stop' : 'Play Debrief'}
                </button>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-cc-text, #fff)' }}
              >
                {existing.aiSummary}
              </p>
            </div>

            <div
              className="text-xs"
              style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
            >
              <p>Record ID: {existing.id}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stat Card ───

function StatCard({
  label,
  value,
  warn = false,
  good = false,
}: {
  label: string
  value: number
  warn?: boolean
  good?: boolean
}) {
  const hasValue = value > 0
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-center"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <p
        className="text-lg font-bold"
        style={{
          color: warn && hasValue
            ? '#ef4444'
            : good && hasValue
            ? '#2dd882'
            : 'var(--color-cc-text, #fff)',
        }}
      >
        {value}
      </p>
      <p
        className="text-[10px] font-medium uppercase tracking-wider mt-0.5"
        style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
      >
        {label}
      </p>
    </div>
  )
}
