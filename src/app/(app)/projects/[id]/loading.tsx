import { SkeletonHeader, SkeletonCard, SkeletonLine, SkeletonList } from '@/components/Skeleton'

export default function ProjectDetailLoading() {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <SkeletonHeader />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-5 pb-24">
        {/* Project header card */}
        <div className="card p-5 space-y-4">
          <SkeletonLine width="75%" height={14} />
          <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
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
