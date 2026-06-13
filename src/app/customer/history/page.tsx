'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { Clock, Calendar, Loader2 } from 'lucide-react'

interface LogEntry { id: number; date: string; checkInTime: string; checkOutTime: string | null; method: string | null }
interface SubEntry { id: number; planType: string; startDate: string; expiryDate: string; totalVisitsAllowed: number; visitsUsed: number; isActive: boolean; isFrozen: boolean }

export default function CustomerHistoryPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'checkins' | 'subscriptions'>('checkins')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [subs, setSubs] = useState<SubEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/customer/history').then(r => r.ok ? r.json() : null),
      fetch('/api/customer/subscription?history=true').then(r => r.ok ? r.json() : null),
    ]).then(([h, s]) => {
      if (h?.logs) setLogs(h.logs)
      if (s?.subscriptions) setSubs(s.subscriptions)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtDuration = (i: string, o: string | null) => {
    if (!o) return t('customer.stillInside')
    const m = Math.round((new Date(o).getTime() - new Date(i).getTime()) / 60000)
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">{t('customer.history')}</h1>
      <div className="flex gap-2">
        <button onClick={() => setTab('checkins')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'checkins' ? 'bg-[#F5C518]/15 text-[#F5C518] border border-[#F5C518]/30' : 'bg-white/5 text-white/40 border border-transparent hover:text-white/60'}`}>
          <Clock size={14} className="inline mr-1.5 -mt-0.5" /> {t('customer.checkInHistory')}
        </button>
        <button onClick={() => setTab('subscriptions')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'subscriptions' ? 'bg-[#F5C518]/15 text-[#F5C518] border border-[#F5C518]/30' : 'bg-white/5 text-white/40 border border-transparent hover:text-white/60'}`}>
          <Calendar size={14} className="inline mr-1.5 -mt-0.5" /> {t('customer.subHistory')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
      ) : tab === 'checkins' ? (
        <div className="rounded-2xl divide-y divide-white/5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {logs.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">{t('customer.noCheckIns')}</p>
          ) : logs.map(log => (
            <div key={log.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-white text-sm font-medium">{fmtDate(log.checkInTime)}</p>
                <p className="text-white/40 text-xs mt-0.5">{fmtTime(log.checkInTime)} - {log.checkOutTime ? fmtTime(log.checkOutTime) : t('customer.stillInside')}</p>
              </div>
              <span className="text-white/30 text-xs font-mono">{fmtDuration(log.checkInTime, log.checkOutTime)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl divide-y divide-white/5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {subs.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">{t('customer.noSubs')}</p>
          ) : subs.map(sub => (
            <div key={sub.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#F5C518] font-bold text-sm">{sub.planType}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sub.isActive ? 'bg-green-500/15 text-green-400' : sub.isFrozen ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-white/30'}`}>
                  {sub.isActive ? t('customer.active') : sub.isFrozen ? t('customer.frozen') : t('customer.expired')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>{fmtDate(sub.startDate)} - {fmtDate(sub.expiryDate)}</span>
                <span>{sub.visitsUsed}/{sub.totalVisitsAllowed === -1 ? '∞' : sub.totalVisitsAllowed} {t('customer.visits')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
