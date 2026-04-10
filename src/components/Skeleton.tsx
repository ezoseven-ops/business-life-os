// ─────────────────────────────────────────────
// Reusable Skeleton Primitives
//
// Consistent loading placeholders for route-level
// loading states. Pulse animation via CSS.
// ─────────────────────────────────────────────

function SkeletonBase({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ backgroundColor: 'var(--color-cc-surface-elevated)', ...style }}
    />
  )
}

export function SkeletonLine({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return <SkeletonBase style={{ width, height, borderRadius: 6 }} />
}

export function SkeletonBlock({ height = 80 }: { height?: number }) {
  return <SkeletonBase style={{ width: '100%', height }} />
}

export function SkeletonCard({ height = 120 }: { height?: number }) {
  return (
    <div className="card p-5 space-y-3" style={{ minHeight: height }}>
      <SkeletonLine width="60%" height={14} />
      <SkeletonLine width="90%" />
      <SkeletonLine width="40%" />
    </div>
  )
}

export function SkeletonList({ count = 3, height = 64 }: { count?: number; height?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-3" style={{ minHeight: height }}>
          <SkeletonBase className="flex-shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="70%" height={13} />
            <SkeletonLine width="45%" height={10} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonHeader() {
  return (
    <div className="px-4 py-3 flex items-center gap-3 " style={{ height: 56, borderBottom: '1px solid var(--color-cc-border)' }}>
      <SkeletonBase style={{ width: 24, height: 24, borderRadius: 6 }} />
      <SkeletonLine width={140} height={16} />
    </div>
  )
}

/** Dark theme skeleton for Command Center */
function SkeletonDarkBase({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ backgroundColor: 'var(--color-cc-surface-elevated)', ...style }}
    />
  )
}

export function SkeletonDarkCard({ height = 100 }: { height?: number }) {
  return (
    <div className="cc-card p-5 space-y-3" style={{ minHeight: height }}>
      <SkeletonDarkBase style={{ width: '50%', height: 12 }} />
      <SkeletonDarkBase style={{ width: '85%', height: 10 }} />
      <SkeletonDarkBase style={{ width: '60%', height: 10 }} />
    </div>
  )
}

export function SkeletonDarkLine({ width = '100%', height = 10 }: { width?: string | number; height?: number }) {
  return <SkeletonDarkBase style={{ width, height, borderRadius: 5 }} />
}

/** Agent thinking skeleton — dark themed, matches cc-card context */
export function AgentThinkingSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <SkeletonDarkBase style={{ width: 20, height: 20, borderRadius: 6 }} />
        <SkeletonDarkBase style={{ width: '50%', height: 12, borderRadius: 6 }} />
      </div>
      <SkeletonDarkBase style={{ width: '100%', height: 48, borderRadius: 12 }} />
      <SkeletonDarkBase style={{ width: '70%', height: 32, borderRadius: 12, opacity: 0.6 }} />
    </div>
  )
}
