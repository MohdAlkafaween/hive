'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, RefreshCw, Clock, AlertTriangle, CalendarDays, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface LogEntry {
  id: number
  checkInTime: string
  checkOutTime?: string
  studentName: string
  student: {
    id: number;
    fullName: string;
    phone: string;
    subscriptions?: { isActive: boolean; visitsUsed: number; totalVisitsAllowed: number | null; expiryDate: string }[]
  } | null
}

interface TodayFeedTableProps {
  refreshTrigger?: number
  onLogsFetched?: (logs: LogEntry[]) => void
  userRole?: string | null
}

export function TodayFeedTable({ refreshTrigger, onLogsFetched, userRole }: TodayFeedTableProps) {
  const router = useRouter()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('hive-hidden-logs')
      if (stored) {
        const { date, ids } = JSON.parse(stored)
        if (date === new Date().toISOString().slice(0, 10)) return new Set(ids)
      }
    } catch {}
    return new Set()
  })

  const isAdmin = userRole === 'ADMIN'

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/logs/today')
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
        onLogsFetched?.(data)
      }
    } finally {
      setLoading(false)
    }
  }, [onLogsFetched])

  useEffect(() => { fetchLogs() }, [fetchLogs, refreshTrigger])

  useEffect(() => {
    const interval = setInterval(fetchLogs, 30_000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  // At midnight: cleanup old checked-out logs, then refresh
  useEffect(() => {
    const now = new Date()
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
    const msUntilMidnight = tomorrow.getTime() - now.getTime()
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/logs/cleanup', { method: 'POST' })
      } catch {}
      fetchLogs()
    }, msUntilMidnight)
    return () => clearTimeout(timer)
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
        localStorage.setItem('hive-hidden-logs', JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          ids: [...next],
        }))
      } catch {}
      return next
    })
    setConfirmId(null)
  }

  const visibleLogs = logs.filter(l => !hiddenIds.has(l.id))
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })
  const now = new Date()

  return (
    <div className="hive-card !p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between p-4"
        style={{ borderBottom: '1px solid rgba(245, 197, 24, 0.08)', background: 'rgba(255,255,255,0.02)' }}
      >
        <h2 className="text-xs font-black text-white/50 uppercase tracking-widest flex items-center gap-3">
          Today&apos;s Check-Ins
          <span className="px-2 py-0.5 rounded-full text-[#F5C518] text-[11px] font-black"
            style={{ background: 'rgba(245, 197, 24, 0.1)', border: '1px solid rgba(245, 197, 24, 0.2)' }}
          >
            {visibleLogs.length}
          </span>
        </h2>
        <button onClick={fetchLogs} className="text-white/30 hover:text-[#F5C518] transition-colors p-1" title="Refresh">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {visibleLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30 p-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 pulse-dot"
              style={{ background: 'rgba(245, 197, 24, 0.08)', border: '1px solid rgba(245, 197, 24, 0.15)' }}
            >
              <CalendarDays size={32} className="text-[#F5C518]" />
            </div>
            <p className="text-lg font-bold text-white/60 mb-1">Ready for today&apos;s visitors</p>
            <p className="text-sm text-white/25">Scan an RFID card or search to check someone in.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10"
              style={{ background: 'rgba(10, 10, 10, 0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest">Name</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest">Check-In</th>
                <th className="text-left px-5 py-3 text-[10px] font-bold text-white/30 uppercase tracking-widest">Check-Out</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => {
                let warning = null;
                const sub = log.student?.subscriptions?.find(s => s.isActive);
                if (sub) {
                  const visitsLeft = sub.totalVisitsAllowed ? sub.totalVisitsAllowed - sub.visitsUsed : Infinity;
                  const daysLeft = Math.ceil((new Date(sub.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (visitsLeft <= 2 || daysLeft <= 2) {
                    warning = visitsLeft <= 2 ? `${visitsLeft} visit${visitsLeft === 1 ? '' : 's'} left` : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
                  }
                }

                return (
                  <tr key={log.id} className="hive-table-row group cursor-default"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div>
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
                            <span className="font-bold text-white/40 text-[15px] leading-tight">{log.studentName || 'Deleted Student'}</span>
                          )}
                          <p className="text-xs font-medium text-white/25 mt-0.5">{log.student?.phone || (!log.student ? 'account deleted' : '')}</p>
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
                    <td className="px-5 py-3.5 text-white/60 font-mono font-semibold text-sm">
                      {fmt(log.checkInTime)}
                    </td>
                    <td className="px-5 py-3.5">
                      {log.checkOutTime ? (
                        <span className="text-white/40 font-mono font-medium text-sm px-2 py-1 rounded"
                          style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                          {fmt(log.checkOutTime)}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[#F5C518] uppercase tracking-wider px-2 py-1 rounded w-fit"
                          style={{ background: 'rgba(245, 197, 24, 0.08)', border: '1px solid rgba(245, 197, 24, 0.15)' }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] animate-pulse" />
                          Inside
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right w-48">
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
                            Check-Out
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
        title="Dismiss Check-In"
        message="Hide this entry from the dashboard? The log will still be available on the Logs page."
        confirmLabel="Dismiss"
        variant="warning"
      />
    </div>
  )
}
