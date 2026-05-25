interface BadgeProps {
  variant: 'active' | 'expired' | 'pending' | 'daily' | 'weekly' | 'monthly'
  children: React.ReactNode
  className?: string
}

const styles = {
  active:  'bg-green-500/15 text-green-400 border-green-500/30',
  expired: 'bg-red-500/15 text-red-400 border-red-500/30',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  daily:   'bg-sky-500/15 text-sky-400 border-sky-500/30',
  weekly:  'bg-violet-500/15 text-violet-400 border-violet-500/30',
  monthly: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[variant]} ${className}`}>
      {children}
    </span>
  )
}
