'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, TrendingUp, Users, Minus, ChevronDown, ChevronUp, Loader2, Calendar as CalendarIcon, DollarSign, Activity, Trash2, Lock, FileText } from 'lucide-react'
import { ExcelExport } from '@/components/stats/ExcelExport'
import { PageTransition } from '@/components/animations/PageTransition'
import { SkeletonGrid } from '@/components/animations/SkeletonCard'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface DailyStats {
  date: string
  totalRevenue: number
  totalDiscounts: number
  totalCheckIns: number
  revenueByGateway: Record<string, number>
  transactions: Transaction[]
  logs: Log[]
}
interface Transaction {
  id: number
  student: { fullName: string } | null
  studentName: string
  planType: string
  gateway: string
  amountPaid: number
  discountAmount: number
  createdAt: string
}
interface Log {
  id: number
  student: { fullName: string } | null
  studentName: string
  checkInTime: string
  checkOutTime?: string
  date: string
}

const GATEWAY_COLORS: Record<string, string> = {
  Cash:          'text-green-400 bg-green-500/10 border-green-500/20',
  CliQ:          'text-sky-400 bg-sky-500/10 border-sky-500/20',
  eFAWATEERcom:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'Credit Card': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

export default function StatsPage() {
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10))
  const [stats, setStats]     = useState<DailyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [monthlyReport, setMonthlyReport] = useState<any>(null)
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7))
  const [reportLoading, setReportLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const isAdmin = userRole === 'ADMIN'

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUserRole(d.user.role) }).catch(() => {})
  }, [])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stats/daily?date=${date}`)
      if (res.ok) setStats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { fetchStats() }, [fetchStats])

  const fetchReport = useCallback(async () => {
    setReportLoading(true)
    try {
      const res = await fetch(`/api/reports?month=${reportMonth}`)
      if (res.ok) setMonthlyReport(await res.json())
    } finally { setReportLoading(false) }
  }, [reportMonth])

  useEffect(() => { if (showReport) fetchReport() }, [showReport, fetchReport])

  const handleDeleteTransaction = async () => {
    if (confirmDeleteId === null) return
    setDeleting(confirmDeleteId)
    try {
      await fetch(`/api/transactions/${confirmDeleteId}`, { method: 'DELETE' })
      setConfirmDeleteId(null)
      fetchStats()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <PageTransition>
    <div className="flex flex-col h-full p-8 gap-8 relative overflow-auto custom-scrollbar">
      <motion.header
        className="flex items-center justify-between pt-2"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #F5C518 0%, #D4A516 100%)', boxShadow: '0 8px 32px rgba(245, 197, 24, 0.3)' }}
              whileHover={{ scale: 1.08, rotate: 4 }}
            >
              <BarChart3 size={28} className="text-black" strokeWidth={2} />
            </motion.div>
            <h1 className="text-4xl font-black tracking-[0.2em] text-white uppercase">Statistics</h1>
          </div>
          <p className="text-xs font-bold text-white/30 tracking-widest uppercase ml-1">Financial & Attendance Data</p>
        </div>

        <div className="flex items-center gap-4 glass-panel p-2 rounded-2xl">
          <div className="relative flex items-center">
            <CalendarIcon size={16} className="absolute left-3 text-[#F5C518] pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm font-bold text-white outline-none focus:border-[#F5C518] transition-colors"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="pr-2">
            <ExcelExport date={date} />
          </div>
        </div>
      </motion.header>

      {loading ? (
        <SkeletonGrid count={3} />
      ) : stats && (
        <>
          {/* Glance Metrics */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          >
            <MetricCard
              icon={<DollarSign size={24} className="text-green-400" />}
              label="Gross Revenue"
              value={`${stats.totalRevenue.toFixed(2)} JD`}
              sub="Total Collected Today"
              accent="text-green-400"
              glow="bg-green-500/8"
            />
            <MetricCard
              icon={<Users size={24} className="text-[#F5C518]" />}
              label="Check-Ins"
              value={stats.totalCheckIns.toString()}
              sub="Total Visits Today"
              accent="text-[#F5C518]"
              glow="bg-yellow-500/8"
            />
            <MetricCard
              icon={<Minus size={24} className="text-red-400" />}
              label="Discounts Given"
              value={`${stats.totalDiscounts.toFixed(2)} JD`}
              sub="Total Promotional Discounts"
              accent="text-red-400"
              glow="bg-red-500/8"
            />
          </motion.div>

          {/* More Details Accordion — ADMIN ONLY */}
          {isAdmin ? (
            <div className="hive-card !rounded-2xl !p-0 relative overflow-hidden">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-5 text-sm font-bold text-white/80 hover:bg-white/3 transition-colors uppercase tracking-widest"
              >
                <span className="flex items-center gap-2">
                  <Activity size={16} className="text-[#F5C518]" />
                  Financial Breakdown & Audit
                </span>
                {expanded ? <ChevronUp size={18} className="text-[#F5C518]" /> : <ChevronDown size={18} className="text-white/30" />}
              </button>

              {expanded && (
                <div className="px-6 pb-6 space-y-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  {/* Revenue by gateway */}
                  <div>
                    <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Revenue by Payment Method</h3>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(stats.revenueByGateway).map(([gw, amt]) => (
                        <div key={gw} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${GATEWAY_COLORS[gw] ?? 'text-white/50 bg-white/3 border-white/10'}`}>
                          <span className="font-bold text-xs uppercase tracking-wider">{gw}</span>
                          <span className="font-black text-lg">{(amt as number).toFixed(2)} JD</span>
                        </div>
                      ))}
                      {Object.keys(stats.revenueByGateway).length === 0 && (
                        <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/8 text-white/30 text-sm font-medium">No transactions recorded.</div>
                      )}
                    </div>
                  </div>

                  {/* Transaction audit */}
                  <div>
                    <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">Transaction Log</h3>
                    {stats.transactions.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-white/10 rounded-xl text-white/25 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        No transactions to display.
                      </div>
                    ) : (
                      <div className="overflow-auto rounded-xl border border-white/8">
                        <table className="w-full text-sm text-left">
                          <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <tr>
                              {['Student', 'Plan', 'Gateway', 'Paid', 'Discount', 'Time', ''].map((h) => (
                                <th key={h} className="px-5 py-4 text-[10px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stats.transactions.map((t) => (
                              <tr key={t.id} className="hive-table-row group" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td className="px-5 py-4 font-bold text-white/90">{t.student?.fullName || t.studentName || <span className="text-white/30">Deleted Student</span>}</td>
                                <td className="px-5 py-4 font-medium text-white/40">{t.planType}</td>
                                <td className="px-5 py-4">
                                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${GATEWAY_COLORS[t.gateway] ?? 'text-white/50 bg-white/5 border-white/10'}`}>{t.gateway}</span>
                                </td>
                                <td className="px-5 py-4 font-black text-green-400 text-base">{t.amountPaid.toFixed(2)} JD</td>
                                <td className="px-5 py-4 font-bold text-red-400">
                                  {t.discountAmount > 0 ? `-${t.discountAmount.toFixed(2)} JD` : '—'}
                                </td>
                                <td className="px-5 py-4 text-white/40 font-bold text-xs">
                                  {new Date(t.createdAt).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-5 py-4">
                                  <button
                                    onClick={() => setConfirmDeleteId(t.id)}
                                    disabled={deleting === t.id}
                                    className="p-1.5 text-white/15 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                    title="Delete transaction"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                            <tr>
                              <td colSpan={3} className="px-5 py-4 text-xs font-black text-white/40 uppercase tracking-widest text-right">Day Totals</td>
                              <td className="px-5 py-4 font-black text-green-400 text-lg">{stats.totalRevenue.toFixed(2)} JD</td>
                              <td className="px-5 py-4 font-bold text-red-400 text-base">{stats.totalDiscounts > 0 ? `-${stats.totalDiscounts.toFixed(2)} JD` : '—'}</td>
                              <td colSpan={2} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hive-card !rounded-2xl flex items-center gap-3 px-6 py-5">
              <Lock size={16} className="text-white/25" />
              <span className="text-sm font-bold text-white/30 uppercase tracking-widest">Financial Breakdown — Admin Only</span>
            </div>
          )}

          {/* Attendance log */}
          <div className="hive-card !rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                <Users size={14} className="text-[#F5C518]" />
                Daily Attendance
              </h3>
              <span className="px-3 py-1 rounded-md text-xs font-bold text-white/60"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {stats.logs.length} Entries
              </span>
            </div>

            {stats.logs.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-white/10 rounded-xl text-white/25 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.02)' }}>
                No check-ins for this date.
              </div>
            ) : (
              <div className="overflow-auto max-h-[400px] rounded-xl border border-white/8 custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 z-10" style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <tr>
                      {['Student Name', 'Check-In', 'Check-Out', 'Duration'].map((h) => (
                        <th key={h} className="px-5 py-4 text-[10px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.logs.map((l) => {
                      const duration = l.checkOutTime
                        ? `${Math.round((new Date(l.checkOutTime).getTime() - new Date(l.checkInTime).getTime()) / 60000)} min`
                        : 'Currently Inside'
                      return (
                        <tr key={l.id} className="hive-table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="px-5 py-4 font-bold text-white/90 text-base">{l.student?.fullName || l.studentName || <span className="text-white/30">Deleted Student</span>}</td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-1 rounded text-white/60 font-bold text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              {new Date(l.checkInTime).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {l.checkOutTime ? (
                              <span className="px-2 py-1 rounded text-white/40 font-bold text-xs" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                {new Date(l.checkOutTime).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-white/25 font-medium">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {l.checkOutTime ? (
                              <span className="text-white/40 font-medium text-xs">{duration}</span>
                            ) : (
                              <span className="text-[#F5C518] font-bold text-xs px-2 py-1 rounded" style={{ background: 'rgba(245, 197, 24, 0.08)', border: '1px solid rgba(245, 197, 24, 0.15)' }}>{duration}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Monthly Report */}
      {isAdmin && (
        <div className="hive-card !rounded-2xl">
          <button
            onClick={() => setShowReport(!showReport)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <FileText size={14} className="text-[#F5C518]" />
              Monthly Report
            </h2>
            {showReport ? <ChevronUp size={16} className="text-white/30" /> : <ChevronDown size={16} className="text-white/30" />}
          </button>

          <AnimatePresence>
          {showReport && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="pt-4 space-y-4">
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#F5C518] outline-none"
                  style={{ colorScheme: 'dark' }}
                />

                {reportLoading ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-white/25" /></div>
                ) : monthlyReport ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Revenue</p>
                      <p className="text-xl font-black text-green-400 mt-1">{monthlyReport.totalRevenue?.toFixed(1)} JD</p>
                    </div>
                    <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Check-Ins</p>
                      <p className="text-xl font-black text-blue-400 mt-1">{monthlyReport.totalCheckIns}</p>
                    </div>
                    <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(168, 85, 247, 0.06)', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">New Subs</p>
                      <p className="text-xl font-black text-purple-400 mt-1">{monthlyReport.newSubscriptions}</p>
                    </div>
                    <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(245, 197, 24, 0.06)', border: '1px solid rgba(245, 197, 24, 0.15)' }}>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Staff Hours</p>
                      <p className="text-xl font-black text-[#F5C518] mt-1">{monthlyReport.staffHours?.toFixed(1)}h</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      <ConfirmModal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDeleteTransaction}
        title="Delete Transaction"
        message="Permanently delete this transaction record? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
    </PageTransition>
  )
}

function MetricCard({ icon, label, value, sub, accent, glow }: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent: string; glow: string
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
      className="hive-card metric-glow !rounded-2xl !p-6 group"
    >
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl transition-opacity opacity-30 group-hover:opacity-60 ${glow}`} />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>{icon}</div>
          <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest">{label}</p>
        </div>
        <div>
          <p className={`text-4xl font-black tracking-tight ${accent}`}>{value}</p>
          <p className="text-[11px] font-bold text-white/20 uppercase tracking-wider mt-2">{sub}</p>
        </div>
      </div>
    </motion.div>
  )
}
