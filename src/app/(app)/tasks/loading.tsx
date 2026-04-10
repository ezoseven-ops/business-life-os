import { SkeletonHeader, SkeletonLine, SkeletonList } from '@/components/Skeleton'

export default function TasksLoading() {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <SkeletonHeader />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-5 pb-24">
        {/* Status section header */}
        <SkeletonLine width={80} height={12} />
        <SkeletonList count={3} height={60} />
        <SkeletonLine width={100} height={12} />
        <SkeletonList count={2} height={60} />
      </div>
    </div>
  )
}
