import { SkeletonHeader, SkeletonCard } from '@/components/Skeleton'

export default function CalendarLoading() {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: '#f9fafb' }}>
      <SkeletonHeader />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-3 pb-24">
        <SkeletonCard height={72} />
        <SkeletonCard height={72} />
        <SkeletonCard height={72} />
        <SkeletonCard height={72} />
      </div>
    </div>
  )
}
