'use client'

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`hive-card !rounded-2xl animate-pulse ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-white/8 animate-shimmer" />
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-white/8 rounded-full w-1/3 animate-shimmer" />
          <div className="h-2 bg-white/5 rounded-full w-1/4 animate-shimmer" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-8 bg-white/8 rounded-lg w-2/3 animate-shimmer" />
        <div className="h-2 bg-white/5 rounded-full w-1/2 animate-shimmer" />
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
