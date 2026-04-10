import { SkeletonHeader, SkeletonCard } from '@/components/Skeleton'

export default function SettingsLoading() {
  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--color-cc-bg)' }}>
      <SkeletonHeader />
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4 pb-24">
        <SkeletonCard height={80} />
        <SkeletonCard height={60} />
        <SkeletonCard height={100} />
      </div>
    </div>
  )
}
