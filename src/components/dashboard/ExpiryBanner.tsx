'use client'
import { useState, useEffect } from 'react'
import { AlertTriangle, X, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ExpiringStudent {
  id: number
  fullName: string
  daysLeft: number
  planType: string
}

export function ExpiryBanner() {
  const [expiring, setExpiring] = useState<ExpiringStudent[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/students')
      .then(r => r.ok ? r.json() : [])
      .then((students: any[]) => {
        const now = Date.now()
        const results: ExpiringStudent[] = []
        for (const s of students) {
          if (!s.subscriptions?.length) continue
          const active = s.subscriptions.find((sub: any) => sub.isActive && new Date(sub.expiryDate).getTime() > now)
          if (!active) continue
          const daysLeft = Math.ceil((new Date(active.expiryDate).getTime() - now) / 86400000)
          if (daysLeft <= 3) {
            results.push({ id: s.id, fullName: s.fullName, daysLeft, planType: active.planType })
          }
        }
        setExpiring(results.sort((a, b) => a.daysLeft - b.daysLeft))
      })
      .catch(() => {})
  }, [])

  if (dismissed || expiring.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="max-w-4xl w-full mx-auto"
      >
        <div className="px-4 py-3 rounded-xl border border-amber-500/20 flex items-center gap-3" style={{ background: 'rgba(245, 158, 11, 0.06)' }}>
          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-400">
              {expiring.length} subscription{expiring.length !== 1 ? 's' : ''} expiring soon
            </p>
            <p className="text-[10px] text-amber-300/50 truncate">
              {expiring.slice(0, 3).map(s => `${s.fullName} (${s.daysLeft}d)`).join(', ')}
              {expiring.length > 3 && ` +${expiring.length - 3} more`}
            </p>
          </div>
          <button onClick={() => setDismissed(true)} className="p-1 rounded hover:bg-white/10 text-amber-400/50 hover:text-amber-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
