import { SkeletonHeader, SkeletonCard, SkeletonList } from '@/components/Skeleton'

export default function ProjectsLoading() {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <SkeletonHeader />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-3 pb-24">
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
        <SkeletonCard height={90} />
      </div>
    </div>
  )
}
