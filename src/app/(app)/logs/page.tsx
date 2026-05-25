'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays, Clock, Coffee, Loader2, ChevronLeft, ChevronRight,
  User, Phone, LogIn, LogOut, DollarSign, Search, Trash2, AlertTriangle
} from 'lucide-react'
import { PageTransition } from '@/components/animations/PageTransition'
import { AnimatedTabs } from '@/components/animations/AnimatedTabs'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

type LogTab = 'checkins' | 'barista'

interface DateEntry { date: string; count: number; revenue?: number }
interface CheckInLog {
  id: number
  checkInTime: string
  checkOutTime: string | null
  date: string
  studentName: string
  student: { id: number; fullName: string; phone: string; major: string | null } | null
}
interface BaristaLog {
  id: number
  quantity: number
  totalPrice: number
  createdAt: string
  menuItem: { name: string; price: number }
}

export default function LogsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<LogTab>('checkins')
  const [dates, setDates] = useState<DateEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [checkInLogs, setCheckInLogs] = useState<CheckInLog[]>([])
  const [baristaLogs, setBaristaLogs] = useState<BaristaLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  // Bulk erase state
  const [showBulkErase, setShowBulkErase] = useState(false)
  const [eraseFrom, setEraseFrom] = useState('')
  const [eraseTo, setEraseTo] = useState('')
  const [erasing, setErasing] = useState(false)
  const [eraseResult, setEraseResult] = useState<string | null>(null)

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')

  const isAdmin = userRole === 'ADMIN'

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUserRole(d.user.role) }).catch(() => {})
  }, [])

  const fetchDates = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = tab === 'checkins' ? '/api/logs/history' : '/api/barista/logs'
      const res = await fetch(endpoint)
      if (res.ok) setDates(await res.json())
    } catch {} finally { setLoading(false) }
  }, [tab])

  useEffect(() => {
    setDates([])
    setSelectedDate(null)
    setCheckInLogs([])
    setBaristaLogs([])
    fetchDates()
  }, [fetchDates])

  const fetchLogsForDate = useCallback(async (date: string) => {
    setLogsLoading(true)
    setSelectedDate(date)
    try {
      if (tab === 'checkins') {
        const res = await fetch(`/api/logs/history?date=${date}`)
        if (res.ok) setCheckInLogs(await res.json())
      } else {
        const res = await fetch(`/api/barista/logs?date=${date}`)
        if (res.ok) setBaristaLogs(await res.json())
      }
    } catch {} finally { setLogsLoading(false) }
  }, [tab])

  const navigateToProfile = (studentId: number) => {
    sessionStorage.setItem('hive-navigate-to-profile', String(studentId))
    router.push('/directory')
  }

  const handleDeleteLog = (logId: number) => {
    setConfirmTitle('Delete Log')
    setConfirmMessage('Are you sure you want to permanently delete this check-in log? This cannot be undone.')
    setConfirmAction(() => async () => {
      setDeleting(logId)
      try {
        await fetch(`/api/logs/${logId}`, { method: 'DELETE' })
        if (selectedDate) fetchLogsForDate(selectedDate)
        fetchDates()
      } finally { setDeleting(null) }
      setConfirmOpen(false)
    })
    setConfirmOpen(true)
  }

  const handleBulkErase = () => {
    if (!eraseFrom || !eraseTo) return
    setConfirmTitle('Bulk Erase Logs')
    setConfirmMessage(`Permanently delete ALL check-in logs from ${eraseFrom} to ${eraseTo}. This action cannot be undone.`)
    setConfirmAction(() => async () => {
      setConfirmOpen(false)
      setErasing(true)
      setEraseResult(null)
      try {
        const res = await fetch('/api/logs/bulk-delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromDate: eraseFrom, toDate: eraseTo }),
        })
        const data = await res.json()
        if (res.ok) {
          setEraseResult(`Successfully deleted ${data.deleted} log${data.deleted !== 1 ? 's' : ''}.`)
          setSelectedDate(null)
          setCheckInLogs([])
          fetchDates()
        } else {
          setEraseResult(data.error || 'Failed to delete logs.')
        }
      } catch {
        setEraseResult('Connection error.')
      } finally { setErasing(false) }
    })
    setConfirmOpen(true)
  }

  const handleEraseAll = () => {
    setConfirmTitle('Erase ALL Logs')
    setConfirmMessage('This will permanently delete ALL check-in logs from every date. This action is irreversible. Are you absolutely sure?')
    setConfirmAction(() => async () => {
      setConfirmOpen(false)
      setErasing(true)
      setEraseResult(null)
      try {
        const res = await fetch('/api/logs/bulk-delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromDate: '2000-01-01', toDate: '2099-12-31' }),
        })
        const data = await res.json()
        if (res.ok) {
          setEraseResult(`Successfully deleted ${data.deleted} log${data.deleted !== 1 ? 's' : ''}.`)
          setSelectedDate(null)
          setCheckInLogs([])
          fetchDates()
        } else {
          setEraseResult(data.error || 'Failed to delete logs.')
        }
      } catch {
        setEraseResult('Connection error.')
      } finally { setErasing(false) }
    })
    setConfirmOpen(true)
  }

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-JO', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const today = new Date().toISOString().slice(0, 10)

  const logsByHour = checkInLogs.reduce<Record<string, CheckInLog[]>>((acc, log) => {
    const hour = new Date(log.checkInTime).getHours()
    const label = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`
    if (!acc[label]) acc[label] = []
    acc[label].push(log)
    return acc
  }, {})

  const filteredHours = Object.entries(logsByHour)
    .map(([hour, logs]) => {
      const filtered = searchQuery
        ? logs.filter(l =>
            (l.student?.fullName || l.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (l.student?.phone || '').includes(searchQuery)
          )
        : logs
      return [hour, filtered] as [string, CheckInLog[]]
    })
    .filter(([, logs]) => logs.length > 0)
    .sort(([a], [b]) => b.localeCompare(a))

  const filteredBarista = searchQuery
    ? baristaLogs.filter(l => l.menuItem.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : baristaLogs

  return (
    <PageTransition>
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #F5C518 0%, #D4A516 100%)', boxShadow: '0 8px 32px rgba(245, 197, 24, 0.3)' }}
            whileHover={{ scale: 1.08, rotate: 4 }}
          >
            <CalendarDays size={20} className="text-black" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold text-white">Activity Logs</h1>
            <p className="text-xs text-white/30">Full history of check-ins and barista orders</p>
          </div>
        </div>

        {/* Admin: Bulk Erase button */}
        {isAdmin && tab === 'checkins' && (
          <button
            onClick={() => { setShowBulkErase(!showBulkErase); setEraseResult(null) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              showBulkErase
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20'
            }`}
          >
            <Trash2 size={14} />
            Erase Logs
          </button>
        )}
      </motion.div>

      {/* Bulk Erase Panel */}
      <AnimatePresence>
        {showBulkErase && isAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="hive-card !rounded-2xl"
              style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.03)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-red-400" />
                <h3 className="text-sm font-bold text-red-400">Bulk Erase Check-In Logs</h3>
              </div>
              <p className="text-xs text-white/30 mb-4">
                Permanently delete all check-in logs within a date range. This action cannot be undone.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">From Date</label>
                  <input
                    type="date"
                    value={eraseFrom}
                    onChange={(e) => setEraseFrom(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5">To Date</label>
                  <input
                    type="date"
                    value={eraseTo}
                    onChange={(e) => setEraseTo(e.target.value)}
                    className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)] transition-all"
                  />
                </div>
                <button
                  onClick={handleBulkErase}
                  disabled={!eraseFrom || !eraseTo || erasing}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {erasing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {erasing ? 'Erasing...' : 'Erase Range'}
                </button>
                <button
                  onClick={handleEraseAll}
                  disabled={erasing}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-red-600/30 text-red-300 border border-red-500/40 hover:bg-red-600/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Erase All
                </button>
              </div>
              {eraseResult && (
                <p className={`mt-3 text-xs font-semibold ${eraseResult.startsWith('Successfully') ? 'text-green-400' : 'text-red-400'}`}>
                  {eraseResult}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab switcher */}
      <AnimatedTabs
        tabs={[
          { id: 'checkins', label: 'Check-In Logs', icon: <LogIn size={16} /> },
          { id: 'barista', label: 'Barista Logs', icon: <Coffee size={16} /> },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as LogTab)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left panel: Date list */}
        <div className="hive-card !rounded-2xl !p-0 overflow-hidden flex flex-col max-h-[70vh]">
          <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">
              {tab === 'checkins' ? 'Check-In Days' : 'Order Days'}
            </h2>
            <p className="text-xs text-white/20 mt-0.5">{dates.length} days recorded</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-white/20" />
              </div>
            ) : dates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/20">
                <CalendarDays size={32} className="mb-2 opacity-40" />
                <p className="text-sm font-medium">No logs recorded yet</p>
              </div>
            ) : (
              <div>
                {dates.map((entry) => {
                  const isToday = entry.date === today
                  const isSelected = entry.date === selectedDate

                  return (
                    <button
                      key={entry.date}
                      onClick={() => fetchLogsForDate(entry.date)}
                      className={`w-full text-left px-4 py-3.5 flex items-center justify-between transition-all hover:bg-white/3 ${
                        isSelected ? 'bg-[#F5C518]/5 border-l-[3px] border-l-[#F5C518]' : ''
                      }`}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-white/60'}`}>
                          {fmtDate(entry.date)}
                          {isToday && (
                            <span className="ml-2 text-[10px] font-bold text-[#F5C518] px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(245, 197, 24, 0.1)', border: '1px solid rgba(245, 197, 24, 0.2)' }}
                            >
                              TODAY
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white bg-white/10 px-2 py-1 rounded-lg min-w-[28px] text-center">
                          {entry.count}
                        </span>
                        {tab === 'barista' && entry.revenue !== undefined && (
                          <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">
                            {entry.revenue.toFixed(1)} JD
                          </span>
                        )}
                        <ChevronRight size={14} className="text-white/20" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Logs for selected date */}
        <div className="hive-card !rounded-2xl !p-0 overflow-hidden flex flex-col max-h-[70vh]">
          {!selectedDate ? (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20 p-8">
              <ChevronLeft size={32} className="mb-2 opacity-40" />
              <p className="text-sm font-medium">Select a day to view logs</p>
              <p className="text-xs mt-1 text-white/15">Click on any date from the left panel</p>
            </div>
          ) : (
            <>
              <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-white">{fmtDate(selectedDate)}</h2>
                    <p className="text-xs text-white/25 mt-0.5">
                      {tab === 'checkins'
                        ? `${checkInLogs.length} check-in${checkInLogs.length !== 1 ? 's' : ''}`
                        : `${baristaLogs.length} order${baristaLogs.length !== 1 ? 's' : ''}`
                      }
                    </p>
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={tab === 'checkins' ? 'Search student...' : 'Search item...'}
                      className="pl-8 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:border-[#F5C518] focus:outline-none focus:shadow-[0_0_0_3px_rgba(245,197,24,0.12)] w-48 text-white placeholder-white/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {logsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-white/20" />
                  </div>
                ) : tab === 'checkins' ? (
                  filteredHours.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/20">
                      <LogIn size={32} className="mb-2 opacity-40" />
                      <p className="text-sm font-medium">No check-ins found</p>
                    </div>
                  ) : (
                    <div>
                      {filteredHours.map(([hour, logs]) => (
                        <div key={hour}>
                          <div className="px-4 py-2 sticky top-0 z-10" style={{ background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div className="flex items-center gap-2">
                              <Clock size={12} className="text-[#F5C518]" />
                              <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider font-mono">{hour}</span>
                              <span className="text-[10px] font-medium text-white/20">({logs.length})</span>
                            </div>
                          </div>

                          {logs.map((log) => (
                            <div key={log.id} className="hive-table-row px-4 py-3 flex items-center justify-between group"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${log.student ? 'bg-gradient-to-br from-[#F5C518] to-[#D4A516]' : 'bg-white/10'}`}>
                                  <span className={`font-bold text-xs ${log.student ? 'text-black' : 'text-white/30'}`}>
                                    {(log.student?.fullName || log.studentName || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  {log.student ? (
                                    <button
                                      onClick={() => navigateToProfile(log.student!.id)}
                                      className="font-bold text-sm text-white/90 hover:text-[#F5C518] transition-colors cursor-pointer truncate block text-left"
                                    >
                                      {log.student!.fullName}
                                    </button>
                                  ) : (
                                    <span className="font-bold text-sm text-white/40 truncate block">{log.studentName || 'Deleted Student'}</span>
                                  )}
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {log.student?.phone && (
                                      <span className="text-xs text-white/25 flex items-center gap-1">
                                        <Phone size={10} />
                                        {log.student.phone}
                                      </span>
                                    )}
                                    {log.student?.major && (
                                      <span className="text-xs text-white/25">{log.student.major}</span>
                                    )}
                                    {!log.student && <span className="text-[10px] text-red-400/50">account deleted</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <LogIn size={12} className="text-green-400" />
                                  <span className="font-mono font-semibold text-white/50">{fmt(log.checkInTime)}</span>
                                </div>
                                {log.checkOutTime ? (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <LogOut size={12} className="text-red-400" />
                                    <span className="font-mono font-medium text-white/35">{fmt(log.checkOutTime)}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-[#F5C518] px-2 py-0.5 rounded"
                                    style={{ background: 'rgba(245, 197, 24, 0.08)', border: '1px solid rgba(245, 197, 24, 0.15)' }}
                                  >
                                    No checkout
                                  </span>
                                )}

                                {/* Admin delete button */}
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteLog(log.id)}
                                    disabled={deleting === log.id}
                                    className="p-1.5 text-white/15 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                    title="Delete this log"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  filteredBarista.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/20">
                      <Coffee size={32} className="mb-2 opacity-40" />
                      <p className="text-sm font-medium">No orders found</p>
                    </div>
                  ) : (
                    <div>
                      <div className="px-4 py-3" style={{ background: 'rgba(34, 197, 94, 0.05)', borderBottom: '1px solid rgba(34, 197, 94, 0.1)' }}>
                        <div className="flex items-center gap-2">
                          <DollarSign size={14} className="text-green-400" />
                          <span className="text-sm font-bold text-green-400">
                            Day Total: {filteredBarista.reduce((s, o) => s + o.totalPrice, 0).toFixed(2)} JD
                          </span>
                          <span className="text-xs text-green-400/50">({filteredBarista.length} orders)</span>
                        </div>
                      </div>
                      <div>
                        {filteredBarista.map((order) => (
                          <div key={order.id} className="hive-table-row px-4 py-3 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <Coffee size={16} className="text-white/30" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-white/90">{order.menuItem.name}</p>
                                <p className="text-xs text-white/25">
                                  x{order.quantity} @ {order.menuItem.price.toFixed(2)} JD
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-sm text-green-400">
                                +{order.totalPrice.toFixed(2)} JD
                              </span>
                              <span className="text-xs text-white/25 font-mono">
                                {fmt(order.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    <ConfirmModal
      open={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      onConfirm={confirmAction || (async () => {})}
      title={confirmTitle}
      message={confirmMessage}
      confirmLabel="Delete"
      variant="danger"
    />
    </PageTransition>
  )
}
