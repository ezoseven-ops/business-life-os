import { SkeletonHeader, SkeletonList } from '@/components/Skeleton'

export default function PeopleLoading() {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <SkeletonHeader />
      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        <SkeletonList count={5} height={64} />
      </div>
    </div>
  )
}
