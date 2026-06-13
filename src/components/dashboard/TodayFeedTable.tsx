'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, RefreshCw, Clock, AlertTriangle, CalendarDays, EyeOff, UserX, Loader2, Smartphone, User, Bell, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/ui/Toast'

interface LogEntry {
  id: number
  checkInTime: string
  checkOutTime?: string
  studentName: string
  minutesRemaining?: number | null
  method?: string
  processedBy?: number | null
  processedByUser?: { name: string; email: string } | null
  student: {
    id: number;
    fullName: string;
    phone: string;
    subscriptions?: { isActive: boolean; visitsUsed: number; totalVisitsAllowed: number | null; expiryDate: string }[]
  } | null
}

interface Notifications {
  expiringCheckIns: { id: number; studentName: string; studentId: number | null; minutesRemaining: number }[]
  expiredSubscriptions: { studentId: number; studentName: string }[]
  autoCheckedOut: number
}

interface TodayFeedTableProps {
  refreshTrigger?: number
  onLogsFetched?: (logs: LogEntry[]) => void
  onNotifications?: (notifications: Notifications) => void
  userRole?: string | null
}

export function TodayFeedTable({ refreshTrigger, onLogsFetched, onNotifications, userRole }: TodayFeedTableProps) {
  const router = useRouter()
  const { t } = useI18n()
  const { toast } = useToast()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [showCheckoutAll, setShowCheckoutAll] = useState(false)
  const [checkoutAllLoading, setCheckoutAllLoading] = useState(false)
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('hive-hidden-logs')
      if (stored) {
        const { ids } = JSON.parse(stored)
        return new Set(ids)
      }
    } catch {}
    return new Set()
  })

  const isAdmin = userRole === 'ADMIN'
  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER'

  const handleCheckoutAll = async () => {
    setCheckoutAllLoading(true)
    try {
      const res = await fetch('/api/checkout/auto', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        toast(t('dash.checkoutAllDone').replace('{count}', String(data.count)))
        await fetchLogs()
      }
    } finally {
      setCheckoutAllLoading(false)
      setShowCheckoutAll(false)
    }
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/logs/today')
      if (res.ok) {
        const data = await res.json()
        // Handle both new format (object with logs + notifications) and legacy format (array)
        const logsList = Array.isArray(data) ? data : (data.logs || [])
        setLogs(logsList)
        onLogsFetched?.(logsList)
        if (!Array.isArray(data) && data.notifications) {
          onNotifications?.(data.notifications)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [onLogsFetched, onNotifications])

  useEffect(() => { fetchLogs() }, [fetchLogs, refreshTrigger])

  useEffect(() => {
    const interval = setInterval(fetchLogs, 30_000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  const handleCheckOut = async (logId: number) => {
    setCheckingOut(logId)
    try {
      await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      })
      await fetchLogs()
    } finally {
      setCheckingOut(null)
    }
  }

  const handleHideLog = () => {
    if (confirmId === null) return
    setHiddenIds(prev => {
      const next = new Set([...prev, confirmId])
      try {
        localStorage.setItem('hive-hidden-logs', JSON.stringify({ ids: [...next] }))
      } catch {}
      return next
    })
    setConfirmId(null)
  }

  const visibleLogs = logs.filter(l => !hiddenIds.has(l.id))
  const insideCount = visibleLogs.filter(l => !l.checkOutTime).length
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="hive-card !p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between p-4"
        style={{ borderBottom: '1px solid rgba(245, 197, 24, 0.08)', background: 'rgba(255,255,255,0.02)' }}
      >
        <h2 className="text-xs font-black text-white/50 uppercase tracking-widest flex items-center gap-3">
          {t('dash.todaysCheckIns')}
          <span className="px-2 py-0.5 rounded-full text-[#F5C518] text-[11px] font-black"
            style={{ background: 'rgba(245, 197, 24, 0.1)', border: '1px solid rgba(245, 197, 24, 0.2)' }}
          >
            {visibleLogs.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {isAdminOrManager && insideCount > 0 && (
            <button
              onClick={() => setShowCheckoutAll(true)}
              className="px-2.5 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center gap-1 hover:bg-orange-500/20 transition-all"
            >
              <UserX size={12} /> {t('dash.checkoutAll')}
            </button>
          )}
          <button onClick={fetchLogs} className="text-white/30 hover:text-[#F5C518] transition-colors p-1" title="Refresh">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {visibleLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 p-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 pulse-dot"
              style={{ background: 'rgba(245, 197, 24, 0.08)', border: '1px solid rgba(245, 197, 24, 0.15)' }}
            >
              <CalendarDays size={32} className="text-[#F5C518]" />
            </div>
            <p className="text-lg font-bold text-white/60 mb-1">{t('dash.readyForVisitors')}</p>
            <p className="text-sm text-white/25">{t('dash.scanRfid')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10"
              style={{ background: 'rgba(10, 10, 10, 0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <tr>
                <th className="text-left px-3 md:px-5 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest">{t('dash.name')}</th>
                <th className="text-left px-3 md:px-5 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest">{t('dash.checkIn')}</th>
                <th className="text-left px-3 md:px-5 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest hidden sm:table-cell">{t('dash.checkOut')}</th>
                <th className="text-left px-3 md:px-5 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest hidden lg:table-cell">{t('dash.duration')}</th>
                <th className="px-3 md:px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => {
                let warning = null;
                const sub = log.student?.subscriptions?.find(s => s.isActive);
                const now = new Date()
                if (sub) {
                  const visitsLeft = sub.totalVisitsAllowed ? sub.totalVisitsAllowed - sub.visitsUsed : Infinity;
                  const daysLeft = Math.ceil((new Date(sub.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (visitsLeft <= 2 || daysLeft <= 2) {
                    warning = visitsLeft <= 2
                      ? `${visitsLeft} ${visitsLeft === 1 ? t('dash.visitLeft') : t('dash.visitsLeft')}`
                      : `${daysLeft} ${daysLeft === 1 ? t('dash.dayLeft') : t('dash.daysLeft')}`;
                  }
                }

                return (
                  <tr key={log.id} className="hive-table-row group cursor-default"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-3 md:px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0">
                          {log.student ? (
                            <button
                              onClick={() => {
                                sessionStorage.setItem('hive-navigate-to-profile', String(log.student!.id))
                                router.push('/directory')
                              }}
                              className="font-bold text-white/90 text-[15px] leading-tight hover:text-[#F5C518] transition-colors cursor-pointer text-left"
                            >
                              {log.student!.fullName}
                            </button>
                          ) : (
                            <span className="font-bold text-white/40 text-[15px] leading-tight">{log.studentName || t('dash.deletedStudent')}</span>
                          )}
                          <p className="text-xs font-medium text-white/25 mt-0.5">
                            {log.student?.phone || (!log.student ? t('dash.accountDeleted') : '')}
                            {log.processedByUser ? (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-white/20"><User size={9} /> {t('log.processedBy')} {log.processedByUser.name || log.processedByUser.email.split('@')[0]}</span>
                            ) : log.processedBy === null || log.processedBy === undefined ? (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-white/15"><Smartphone size={9} /> {t('log.selfCheckIn')}</span>
                            ) : null}
                          </p>
                        </div>
                        {warning && (
                          <span className="ml-2 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap"
                            style={{ background: 'rgba(245, 197, 24, 0.1)', color: '#F5C518', border: '1px solid rgba(245, 197, 24, 0.2)' }}
                          >
                            <AlertTriangle size={10} />
                            {warning}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 md:px-5 py-3.5 text-white/60 font-mono font-semibold text-sm">
                      {fmt(log.checkInTime)}
                    </td>
                    <td className="px-3 md:px-5 py-3.5 hidden sm:table-cell">
                      {log.checkOutTime ? (
                        <span className="text-white/40 font-mono font-medium text-sm px-2 py-1 rounded"
                          style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                          {fmt(log.checkOutTime)}
                          {log.method === 'AUTO_CHECKOUT' && (
                            <span className="ml-1.5 text-[9px] font-bold text-orange-400 uppercase">auto</span>
                          )}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#F5C518] uppercase tracking-wider px-2 py-1 rounded w-fit"
                          style={{ background: 'rgba(245, 197, 24, 0.08)', border: '1px solid rgba(245, 197, 24, 0.15)' }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] animate-pulse" />
                          {t('dash.inside')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 md:px-5 py-3.5 hidden lg:table-cell">
                      {(() => {
                        const start = new Date(log.checkInTime).getTime()
                        const end = log.checkOutTime ? new Date(log.checkOutTime).getTime() : Date.now()
                        const hours = (end - start) / (1000 * 60 * 60)
                        const h = Math.floor(hours)
                        const m = Math.floor((hours - h) * 60)
                        const label = h > 0 ? `${h}h ${m}m` : `${m}m`
                        const isExpiring = !log.checkOutTime && log.minutesRemaining != null && log.minutesRemaining <= 60
                        const isLong = hours >= 20
                        const isWarning = hours >= 16 && hours < 20
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              isExpiring ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              isLong ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                              isWarning ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                              'text-white/40'
                            }`}>
                              {(isExpiring || isLong) && <AlertTriangle size={10} className="inline mr-1" />}
                              {label}
                            </span>
                            {!log.checkOutTime && log.minutesRemaining != null && log.minutesRemaining <= 60 && (
                              <span className="text-[9px] font-bold text-red-400 animate-pulse">
                                {t('dash.minutesLeft').replace('{min}', String(log.minutesRemaining))}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-3 md:px-5 py-3.5 text-right w-auto md:w-48">
                      <div className="flex items-center justify-end gap-2">
                        {!log.checkOutTime && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={checkingOut === log.id}
                            onClick={() => handleCheckOut(log.id)}
                            className="px-4 py-2 opacity-60 group-hover:opacity-100 bg-[#F5C518] hover:bg-[#D5A711] border-[#F5C518] text-black font-bold transition-all"
                          >
                            <LogOut size={14} className="mr-1.5" />
                            {t('dash.checkOut')}
                          </Button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmId(log.id)}
                            className="p-2 text-white/20 hover:text-white/50 hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Dismiss from dashboard"
                          >
                            <EyeOff size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={handleHideLog}
        title={t('dash.dismissCheckIn')}
        message={t('dash.dismissMsg')}
        confirmLabel={t('dash.dismiss')}
        variant="warning"
      />

      <ConfirmModal
        open={showCheckoutAll}
        onClose={() => setShowCheckoutAll(false)}
        onConfirm={handleCheckoutAll}
        title={t('dash.checkoutAll')}
        message={t('dash.checkoutAllMsg').replace('{count}', String(insideCount))}
        confirmLabel={checkoutAllLoading ? '...' : t('dash.checkoutAll')}
        variant="danger"
      />
    </div>
  )
}
