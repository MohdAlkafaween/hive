'use client'

export function SkeletonRow({ columns = 5, className = '' }: { columns?: number; className?: string }) {
  return (
    <tr className={`border-b border-[#E5E7EB]/50 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className={`h-3 bg-gray-200 rounded-full animate-shimmer ${
            i === 0 ? 'w-32' : i === columns - 1 ? 'w-8' : 'w-20'
          }`} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonTable({ rows = 5, columns = 5, className = '' }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl glass-panel ${className}`}>
      <table className="w-full text-sm text-left">
        <thead className="bg-[#FDFCF8] border-b border-[#E5E7EB]">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-5 py-4">
                <div className="h-2 bg-gray-200 rounded-full w-16 animate-shimmer" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
