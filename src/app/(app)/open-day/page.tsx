'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import {
  executeOpenDayAction,
  getOpenDayAction,
} from '@/modules/operational/open-day/open-day.actions'

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
    totalTasksToday: number
    totalTasksOverdue: number
    totalEventsToday: number
    totalFollowUps: number
    totalUnreadMessages: number
    criticalItemCount: number
  }
  criticalItemCount: number
  projectCount: number
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

export default function OpenDayPage() {
  const [dateStr, setDateStr] = useState(todayStr())
  const [loading, setLoading] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExecuteResult | null>(null)
  const [existing, setExisting] = useState<ExistingRecord | null>(null)
  const [mode, setMode] = useState<'idle' | 'executed' | 'loaded'>('idle')

  async function handleExecute() {
    if (loading) return
    setError('')
    setResult(null)
    setExisting(null)
    setLoading(true)
    try {
      const res = await executeOpenDayAction(dateStr)
      if (res.success) {
        setResult(res.data as ExecuteResult)
        setMode('executed')
      } else {
        setError(res.error || 'Failed to execute Open Day')
      }
    } catch {
      setError('Failed to execute Open Day')
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
      const res = await getOpenDayAction(dateStr)
      if (res.success) {
        if (res.data) {
          setExisting(res.data as ExistingRecord)
          setMode('loaded')
        } else {
          setError('No Open Day record found for this date.')
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
      <Header title="Open Day" backHref="/" />

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
            {loading ? 'Running...' : 'Run Open Day'}
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
            <div className="flex items-center gap-2">
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

            {/* AI Summary */}
            <div
              className="rounded-2xl px-4 py-4"
              style={{
                background: 'rgba(124,110,246,0.06)',
                border: '1px solid rgba(124,110,246,0.12)',
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--color-cc-accent, #7c6ef6)' }}
              >
                Operator Briefing
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-cc-text, #fff)' }}
              >
                {result.aiSummary}
              </p>
            </div>

            {/* Stats row */}
            <div
              className="grid grid-cols-3 gap-3"
            >
              <StatCard label="Tasks Today" value={result.summary.totalTasksToday} />
              <StatCard label="Overdue" value={result.summary.totalTasksOverdue} warn />
              <StatCard label="Events" value={result.summary.totalEventsToday} />
              <StatCard label="Follow-ups" value={result.summary.totalFollowUps} />
              <StatCard label="Unread" value={result.summary.totalUnreadMessages} />
              <StatCard label="Critical" value={result.criticalItemCount} warn />
            </div>

            {/* Meta */}
            <div
              className="text-xs space-y-1"
              style={{ color: 'var(--color-cc-text-muted, #6b6b85)' }}
            >
              <p>Projects in scope: {result.projectCount}</p>
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
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--color-cc-accent, #7c6ef6)' }}
              >
                Stored Briefing
              </p>
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
}: {
  label: string
  value: number
  warn?: boolean
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
