'use client'
import { useState, useEffect, useCallback } from 'react'
import { Clock, UserCheck, XCircle, Users, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/ui/Toast'

interface WaitlistEntry {
  id: number
  position: number
  status: string
  createdAt: string
  student: { id: number; fullName: string; phone: string }
}

export function WaitlistPanel({ refreshTrigger }: { refreshTrigger?: number }) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/waitlist')
      if (res.ok) setEntries(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load, refreshTrigger])
  useEffect(() => {
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const handleAction = async (id: number, status: 'ADMITTED' | 'CANCELLED') => {
    setUpdating(id)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        toast(status === 'ADMITTED' ? t('waitlist.admitted') : t('waitlist.cancelled'))
        load()
      }
    } finally { setUpdating(null) }
  }

  const waiting = entries.filter(e => e.status === 'WAITING')
  if (loading || waiting.length === 0) return null

  return (
    <div className="hive-card !p-0 overflow-hidden">
      <div className="flex items-center justify-between p-4"
        style={{ borderBottom: '1px solid rgba(245, 197, 24, 0.08)', background: 'rgba(255,255,255,0.02)' }}
      >
        <h2 className="text-xs font-black text-orange-400/70 uppercase tracking-widest flex items-center gap-2">
          <Users size={14} />
          {t('waitlist.title')}
          <span className="px-2 py-0.5 rounded-full text-orange-400 text-[11px] font-black"
            style={{ background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.2)' }}
          >
            {waiting.length}
          </span>
        </h2>
      </div>

      <div className="divide-y divide-white/5">
        {waiting.map(entry => (
          <div key={entry.id} className="flex items-center justify-between px-4 py-3 group">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center">
                #{entry.position}
              </span>
              <div>
                <span className="text-sm font-bold text-white/80">{entry.student.fullName}</span>
                <div className="flex items-center gap-2 text-[10px] text-white/30">
                  <Clock size={10} />
                  {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleAction(entry.id, 'ADMITTED')}
                disabled={updating === entry.id}
                className="px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold flex items-center gap-1 hover:bg-green-500/20 transition-all disabled:opacity-50"
              >
                {updating === entry.id ? <Loader2 size={10} className="animate-spin" /> : <UserCheck size={10} />}
                {t('waitlist.admit')}
              </button>
              <button
                onClick={() => handleAction(entry.id, 'CANCELLED')}
                disabled={updating === entry.id}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold flex items-center gap-1 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                <XCircle size={10} /> {t('waitlist.cancel')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
