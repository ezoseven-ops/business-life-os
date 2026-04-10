'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProjectPhaseAction } from '../project.actions'
import { PHASE_ORDER, PHASE_META, type ProjectPhase } from '../project.types'

// ─────────────────────────────────────────────
// Phase Indicator
//
// Horizontal 4-stage bar showing project workflow phase.
// PLANNING → EXECUTION → REVIEW → COMPLETE
// Tap to advance (OWNER + TEAM only).
// ─────────────────────────────────────────────

export function PhaseIndicator({
  projectId,
  currentPhase,
  canEdit = false,
}: {
  projectId: string
  currentPhase: string
  canEdit?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const phase = (PHASE_ORDER.includes(currentPhase as ProjectPhase)
    ? currentPhase
    : 'PLANNING') as ProjectPhase

  const currentIdx = PHASE_ORDER.indexOf(phase)

  function handlePhaseClick(targetPhase: ProjectPhase) {
    if (!canEdit || isPending) return
    if (targetPhase === phase) return

    startTransition(async () => {
      await updateProjectPhaseAction(projectId, targetPhase)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1" style={{ opacity: isPending ? 0.6 : 1 }}>
      {PHASE_ORDER.map((p, idx) => {
        const meta = PHASE_META[p]
        const isActive = idx <= currentIdx
        const isCurrent = p === phase

        return (
          <button
            key={p}
            onClick={() => handlePhaseClick(p)}
            disabled={!canEdit || isPending}
            className="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-xl transition-all"
            style={{
              cursor: canEdit ? 'pointer' : 'default',
              backgroundColor: isCurrent ? meta.color + '10' : 'transparent',
            }}
            title={meta.label}
          >
            {/* Phase dot / connector */}
            <div className="flex items-center w-full px-1">
              {idx > 0 && (
                <div
                  className="flex-1 h-[2px] rounded-full"
                  style={{
                    backgroundColor: isActive ? meta.color : 'var(--color-cc-surface-elevated)',
                  }}
                />
              )}
              <div
                className="flex-shrink-0 rounded-full flex items-center justify-center"
                style={{
                  width: isCurrent ? 24 : 8,
                  height: isCurrent ? 24 : 8,
                  backgroundColor: isActive ? meta.color : 'var(--color-cc-surface-elevated)',
                }}
              >
                {isCurrent && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#fff">
                    <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                  </svg>
                )}
              </div>
              {idx < PHASE_ORDER.length - 1 && (
                <div
                  className="flex-1 h-[2px] rounded-full"
                  style={{
                    backgroundColor: idx < currentIdx ? PHASE_META[PHASE_ORDER[idx + 1]].color : 'var(--color-cc-surface-elevated)',
                  }}
                />
              )}
            </div>

            {/* Label */}
            <span
              className="text-[10px] font-semibold tracking-wide"
              style={{
                color: isCurrent ? meta.color : isActive ? 'var(--color-cc-text-muted)' : 'var(--color-cc-text-dim)',
              }}
            >
              {meta.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
