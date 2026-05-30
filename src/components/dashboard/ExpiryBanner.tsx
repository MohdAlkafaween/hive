'use client'
import { useState, useEffect } from 'react'
import { AlertTriangle, X, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/lib/i18n'

interface ExpiringStudent {
  id: number
  fullName: string
  daysLeft: number
  planType: string
}

export function ExpiryBanner() {
  const { t } = useI18n()
  const [expiring, setExpiring] = useState<ExpiringStudent[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.expiring) {
          setExpiring(data.expiring)
        }
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
              {expiring.length} {t('dash.subsExpiringSoon')}
            </p>
            <p className="text-[10px] text-amber-300/50 truncate">
              {expiring.slice(0, 3).map(s => `${s.fullName} (${s.daysLeft}${t('common.daysShort')})`).join(', ')}
              {expiring.length > 3 && ` +${expiring.length - 3} ${t('common.more')}`}
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
