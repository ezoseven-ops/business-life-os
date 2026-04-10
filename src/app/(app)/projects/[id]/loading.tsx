import { SkeletonHeader, SkeletonCard, SkeletonLine, SkeletonList } from '@/components/Skeleton'

export default function ProjectDetailLoading() {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <SkeletonHeader />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-5 pb-24">
        {/* Project header card */}
        <div className="p-5 space-y-4 rounded-2xl" style={{ background: "var(--color-cc-surface-subtle)", border: "1px solid var(--color-cc-border)" }}>
          <SkeletonLine width="75%" height={14} />
          <div className="flex items-center gap-6 pt-3 border-t border-white/6">
            <div className="text-center space-y-1">
              <SkeletonLine width={32} height={22} />
              <SkeletonLine width={32} height={8} />
            </div>
            <div className="text-center space-y-1">
              <SkeletonLine width={32} height={22} />
              <SkeletonLine width={32} height={8} />
            </div>
            <div className="text-center space-y-1">
              <SkeletonLine width={32} height={22} />
              <SkeletonLine width={32} height={8} />
            </div>
          </div>
        </div>
        {/* Tab bar */}
        <SkeletonLine width="100%" height={40} />
        {/* Task list */}
        <SkeletonList count={4} height={56} />
      </div>
    </div>
  )
}
