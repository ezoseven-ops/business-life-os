'use client'

import { useState, useCallback } from 'react'
import { CaptureInput } from '@/modules/capture/components/CaptureInput'
import { AgentInput } from './AgentInput'

// ─────────────────────────────────────────────
// CommandCenterInput — Mode Switcher
//
// Wraps both CaptureInput (classic mode) and
// AgentInput (persistent agent mode).
//
// Default: agent mode ON.
// Toggle allows switching to classic capture-only mode.
// ─────────────────────────────────────────────

export function CommandCenterInput() {
  const [agentMode, setAgentMode] = useState(true)

  const toggleMode = useCallback(() => {
    setAgentMode((prev) => !prev)
  }, [])

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={toggleMode}
          className="flex items-center gap-1.5 text-[11px] font-medium transition-all active:scale-[0.97] rounded-lg"
          style={{
            color: agentMode ? '#22c55e' : 'var(--color-cc-text-muted)',
            padding: '6px 10px',
            backgroundColor: agentMode ? '#22c55e0d' : 'transparent',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: agentMode ? '#22c55e' : 'var(--color-cc-text-dim)',
              boxShadow: agentMode ? '0 0 4px #22c55e60' : 'none',
            }}
          />
          {agentMode ? 'Agent Mode' : 'Classic Mode'}
        </button>
      </div>

      {agentMode ? <AgentInput /> : <CaptureInput />}
    </div>
  )
}
