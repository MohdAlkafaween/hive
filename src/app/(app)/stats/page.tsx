'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, TrendingUp, Users, Minus, ChevronDown, ChevronUp, Loader2, Calendar as CalendarIcon, DollarSign, Activity, Trash2, Lock, FileText, Coffee, RotateCcw, Ban, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ExcelExport } from '@/components/stats/ExcelExport'
import { todayString } from '@/lib/subscriptionLogic'
import { useI18n } from '@/lib/i18n'
import { PageTransition } from '@/components/animations/PageTransition'
import { SkeletonGrid } from '@/components/animations/SkeletonCard'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RevenueChart } from '@/components/stats/RevenueChart'

interface BaristaOrderStat {
  id: number
  menuItem: string
  quantity: number
  totalPrice: number
  costPrice: number
  paymentMethod: string
  receiptNumber: string | null
  student: { fullName: string } | null
  createdAt: string
}

interface DailyStats {
  date: string
  totalRevenue: number
  totalDiscounts: number
  totalCheckIns: number
  revenueByGateway: Record<string, number>
  transactions: Transaction[]
  logs: Log[]
  baristaOrders?: BaristaOrderStat[]
  baristaRevenue?: number
  baristaCost?: number
  baristaProfit?: number
  subscriptionRevenue?: number
  topMenuItems?: { name: string; count: number }[]
  expenses?: { id: number; description: string; amount: number; category: string | null; addedByName: string; createdAt: string }[]
  totalExpenses?: number
  netProfit?: number
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
  type?: string
  voidedAt?: string
  voidReason?: string
  refundOf?: number
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
  const { t } = useI18n()
  const [date, setDate]       = useState(todayString())
  const [stats, setStats]     = useState<DailyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [voidTx, setVoidTx] = useState<Transaction | null>(null)
  const [voidAction, setVoidAction] = useState<'VOID' | 'REFUND'>('REFUND')
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [monthlyReport, setMonthlyReport] = useState<any>(null)
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7))
  const [reportLoading, setReportLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)

  const { toast } = useToast()
  const isAdmin = userRole === 'ADMIN'
  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'MANAGER'

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

  const handleVoidRefund = async () => {
    if (!voidTx || !voidReason.trim()) return
    setVoiding(true)
    try {
      const res = await fetch(`/api/transactions/${voidTx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: voidAction, reason: voidReason.trim() }),
      })
      if (res.ok) {
        toast(voidAction === 'REFUND' ? t('void.refundSuccess') : t('void.voidSuccess'))
        setVoidTx(null)
        setVoidReason('')
        fetchStats()
      } else {
        const err = await res.json().catch(() => null)
        toast(err?.error || 'Failed')
      }
    } finally { setVoiding(false) }
  }

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
            <h1 className="text-4xl font-black tracking-[0.2em] text-white uppercase">{t('stats.title')}</h1>
          </div>
          <p className="text-xs font-bold text-white/30 tracking-widest uppercase ml-1">{t('stats.financialAttendance')}</p>
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          >
            <MetricCard
              icon={<DollarSign size={24} className="text-green-400" />}
              label={t('stats.grossRevenue')}
              value={`${stats.totalRevenue.toFixed(2)} JD`}
              sub={`${t('stats.subscriptions')}: ${(stats.subscriptionRevenue ?? stats.totalRevenue).toFixed(2)} JD`}
              accent="text-green-400"
              glow="bg-green-500/8"
            />
            <MetricCard
              icon={<Coffee size={24} className="text-amber-400" />}
              label={t('stats.cafeRevenue')}
              value={`${(stats.baristaRevenue ?? 0).toFixed(2)} JD`}
              sub={`${t('stats.profit')}: ${(stats.baristaProfit ?? 0).toFixed(2)} JD`}
              accent="text-amber-400"
              glow="bg-amber-500/8"
            />
            <MetricCard
              icon={<Users size={24} className="text-[#F5C518]" />}
              label={t('stats.checkIns')}
              value={stats.totalCheckIns.toString()}
              sub={t('stats.totalVisits')}
              accent="text-[#F5C518]"
              glow="bg-yellow-500/8"
            />
            <MetricCard
              icon={<Minus size={24} className="text-red-400" />}
              label={t('stats.discountsGiven')}
              value={`${stats.totalDiscounts.toFixed(2)} JD`}
              sub={t('stats.totalDiscounts')}
              accent="text-red-400"
              glow="bg-red-500/8"
            />
          </motion.div>

          {/* Revenue & Check-In Chart */}
          <div className="hive-card !rounded-2xl">
            <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-[#F5C518]" />
              {t('stats.revenueTrends')}
            </h2>
            <RevenueChart />
          </div>

          {/* More Details Accordion — ADMIN ONLY */}
          {isAdmin ? (
            <div className="hive-card !rounded-2xl !p-0 relative overflow-hidden">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-5 text-sm font-bold text-white/80 hover:bg-white/3 transition-colors uppercase tracking-widest"
              >
                <span className="flex items-center gap-2">
                  <Activity size={16} className="text-[#F5C518]" />
                  {t('stats.breakdown')}
                </span>
                {expanded ? <ChevronUp size={18} className="text-[#F5C518]" /> : <ChevronDown size={18} className="text-white/30" />}
              </button>

              {expanded && (
                <div className="px-6 pb-6 space-y-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  {/* Revenue by gateway */}
                  <div>
                    <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">{t('stats.revenueByMethod')}</h3>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(stats.revenueByGateway).map(([gw, amt]) => (
                        <div key={gw} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${GATEWAY_COLORS[gw] ?? 'text-white/50 bg-white/3 border-white/10'}`}>
                          <span className="font-bold text-xs uppercase tracking-wider">{gw}</span>
                          <span className="font-black text-lg">{(amt as number).toFixed(2)} JD</span>
                        </div>
                      ))}
                      {Object.keys(stats.revenueByGateway).length === 0 && (
                        <div className="px-4 py-3 rounded-xl bg-white/3 border border-white/8 text-white/30 text-sm font-medium">{t('stats.noTransactions')}</div>
                      )}
                    </div>
                  </div>

                  {/* Transaction audit */}
                  <div>
                    <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4">{t('stats.transactionLog')}</h3>
                    {stats.transactions.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-white/10 rounded-xl text-white/25 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        {t('stats.noTransactions')}
                      </div>
                    ) : (
                      <div className="overflow-auto rounded-xl border border-white/8">
                        <table className="w-full text-sm text-left">
                          <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <tr>
                              {[t('stats.student'), t('profile.plan'), t('profile.gateway'), t('profile.paid'), t('profile.discount'), t('profile.time'), ''].map((h, i) => (
                                <th key={i} className="px-5 py-4 text-[10px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {stats.transactions.map((tx) => (
                              <tr key={tx.id} className={`hive-table-row group ${tx.type === 'VOID' ? 'opacity-50 line-through' : ''}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td className="px-5 py-4 font-bold text-white/90">
                                  <div className="flex items-center gap-2">
                                    {tx.student?.fullName || tx.studentName || <span className="text-white/30">{t('stats.deletedStudent')}</span>}
                                    {tx.type === 'VOID' && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 no-underline">{t('void.voided')}</span>}
                                    {tx.type === 'REFUND' && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 no-underline">{t('void.refund')}</span>}
                                  </div>
                                </td>
                                <td className="px-5 py-4 font-medium text-white/40">{tx.planType}</td>
                                <td className="px-5 py-4">
                                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${GATEWAY_COLORS[tx.gateway] ?? 'text-white/50 bg-white/5 border-white/10'}`}>{tx.gateway}</span>
                                </td>
                                <td className={`px-5 py-4 font-black text-base ${tx.type === 'REFUND' ? 'text-blue-400' : tx.type === 'VOID' ? 'text-red-400' : 'text-green-400'}`}>{tx.amountPaid.toFixed(2)} JD</td>
                                <td className="px-5 py-4 font-bold text-red-400">
                                  {tx.discountAmount > 0 ? `-${tx.discountAmount.toFixed(2)} JD` : '—'}
                                </td>
                                <td className="px-5 py-4 text-white/40 font-bold text-xs">
                                  {new Date(tx.createdAt).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-1">
                                    {tx.type === 'SALE' && isAdminOrManager && (
                                      <button
                                        onClick={() => { setVoidTx(tx); setVoidAction('REFUND'); setVoidReason('') }}
                                        className="p-1.5 text-white/15 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title={t('void.voidRefund')}
                                      >
                                        <RotateCcw size={14} />
                                      </button>
                                    )}
                                    {isAdmin && tx.type !== 'VOID' && (
                                      <button
                                        onClick={() => setConfirmDeleteId(tx.id)}
                                        disabled={deleting === tx.id}
                                        className="p-1.5 text-white/15 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                        title="Delete transaction"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                            <tr>
                              <td colSpan={3} className="px-5 py-4 text-xs font-black text-white/40 uppercase tracking-widest text-right">{t('stats.dayTotals')}</td>
                              <td className="px-5 py-4 font-black text-green-400 text-lg">{(stats.subscriptionRevenue ?? stats.totalRevenue).toFixed(2)} JD</td>
                              <td className="px-5 py-4 font-bold text-red-400 text-base">{stats.totalDiscounts > 0 ? `-${stats.totalDiscounts.toFixed(2)} JD` : '—'}</td>
                              <td colSpan={2} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Barista / Café Orders */}
                  <div>
                    <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Coffee size={14} className="text-amber-400" />
                      {t('stats.cafeOrders')} ({stats.baristaOrders?.length || 0})
                    </h3>
                    {!stats.baristaOrders || stats.baristaOrders.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-white/10 rounded-xl text-white/25 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        {t('stats.noCafeOrders')}
                      </div>
                    ) : (
                      <>
                        {/* Top items */}
                        {stats.topMenuItems && stats.topMenuItems.length > 0 && (
                          <div className="flex flex-wrap gap-3 mb-4">
                            {stats.topMenuItems.map((item, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-400">
                                <span className="font-bold text-xs">{item.name}</span>
                                <span className="text-[10px] font-bold bg-amber-500/15 px-1.5 py-0.5 rounded">x{item.count}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="overflow-auto rounded-xl border border-white/8">
                          <table className="w-full text-sm text-left">
                            <thead style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              <tr>
                                {[t('stats.item'), t('stats.qty'), t('stats.amount'), t('stats.payment'), t('stats.customer'), t('profile.time')].map((h, i) => (
                                  <th key={i} className="px-4 py-3 text-[10px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {stats.baristaOrders.map((o) => (
                                <tr key={o.id} className="hive-table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                  <td className="px-4 py-3 font-bold text-white/90">{o.menuItem}</td>
                                  <td className="px-4 py-3 text-white/50 font-bold">x{o.quantity}</td>
                                  <td className="px-4 py-3 font-black text-amber-400">{o.totalPrice.toFixed(2)} JD</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase border ${
                                      o.paymentMethod === 'CASH' ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                    }`}>{o.paymentMethod}</span>
                                  </td>
                                  <td className="px-4 py-3 text-white/40">{o.student?.fullName || '—'}</td>
                                  <td className="px-4 py-3 text-white/40 font-bold text-xs">
                                    {new Date(o.createdAt).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                              <tr>
                                <td colSpan={2} className="px-4 py-3 text-xs font-black text-white/40 uppercase tracking-widest text-right">{t('stats.cafeTotal')}</td>
                                <td className="px-4 py-3 font-black text-amber-400 text-lg">{(stats.baristaRevenue ?? 0).toFixed(2)} JD</td>
                                <td colSpan={3} className="px-4 py-3 text-xs text-white/25">
                                  {t('stats.cost')}: {(stats.baristaCost ?? 0).toFixed(2)} JD · {t('stats.profit')}: {(stats.baristaProfit ?? 0).toFixed(2)} JD
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )}

                    {/* Expenses Section */}
                    {stats.expenses && stats.expenses.length > 0 && (
                      <div className="pt-6">
                        <h4 className="text-[11px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                          <Minus size={14} /> {t('stats.expenses')} ({stats.expenses.length})
                        </h4>
                        <div className="space-y-1.5">
                          {stats.expenses.map(exp => (
                            <div key={exp.id} className="flex items-center justify-between p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-white/70 font-bold">{exp.description}</span>
                                {exp.category && <span className="text-[10px] text-white/20 ms-2 px-1.5 py-0.5 rounded bg-white/5">{t(`barista.expenseCategories.${exp.category.toLowerCase()}` as any) || exp.category}</span>}
                                <span className="text-[10px] text-white/15 ms-2">{exp.addedByName}</span>
                              </div>
                              <span className="text-red-400 font-bold text-sm flex-shrink-0">-{exp.amount.toFixed(2)} JD</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <span className="text-xs font-black text-white/40 uppercase tracking-widest">{t('stats.totalExpenses')}</span>
                          <span className="text-red-400 font-black text-lg">-{(stats.totalExpenses ?? 0).toFixed(2)} JD</span>
                        </div>
                      </div>
                    )}

                    {/* Net Profit Summary */}
                    {(stats.baristaRevenue != null || stats.totalExpenses != null) && (
                      <div className="pt-6 mt-4" style={{ borderTop: '2px solid rgba(245,197,24,0.2)' }}>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-black text-white/60 uppercase tracking-widest">{t('stats.netProfit')}</span>
                          <span className={`font-black text-2xl ${(stats.netProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(stats.netProfit ?? 0).toFixed(2)} JD
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hive-card !rounded-2xl flex items-center gap-3 px-6 py-5">
              <Lock size={16} className="text-white/25" />
              <span className="text-sm font-bold text-white/30 uppercase tracking-widest">{t('stats.adminOnly')}</span>
            </div>
          )}

          {/* Attendance log */}
          <div className="hive-card !rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                <Users size={14} className="text-[#F5C518]" />
                {t('stats.dailyAttendance')}
              </h3>
              <span className="px-3 py-1 rounded-md text-xs font-bold text-white/60"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {stats.logs.length} {t('stats.entries')}
              </span>
            </div>

            {stats.logs.length === 0 ? (
              <div className="p-10 text-center border border-dashed border-white/10 rounded-xl text-white/25 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.02)' }}>
                {t('stats.noCheckIns')}
              </div>
            ) : (
              <div className="overflow-auto max-h-[400px] rounded-xl border border-white/8 custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 z-10" style={{ background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <tr>
                      {[t('stats.student'), t('stats.checkIn'), t('stats.checkOut'), t('stats.duration')].map((h, i) => (
                        <th key={i} className="px-5 py-4 text-[10px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.logs.map((l) => {
                      const duration = l.checkOutTime
                        ? `${Math.round((new Date(l.checkOutTime).getTime() - new Date(l.checkInTime).getTime()) / 60000)} ${t('common.min')}`
                        : t('stats.currentlyInside')
                      return (
                        <tr key={l.id} className="hive-table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="px-5 py-4 font-bold text-white/90 text-base">{l.student?.fullName || l.studentName || <span className="text-white/30">{t('stats.deletedStudent')}</span>}</td>
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
              {t('stats.monthlyReport')}
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
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('stats.revenue')}</p>
                      <p className="text-xl font-black text-green-400 mt-1">{(monthlyReport.totalRevenue ?? 0).toFixed(1)} JD</p>
                    </div>
                    <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('stats.checkIns')}</p>
                      <p className="text-xl font-black text-blue-400 mt-1">{monthlyReport.totalCheckIns ?? 0}</p>
                    </div>
                    <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(168, 85, 247, 0.06)', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('stats.newSubs')}</p>
                      <p className="text-xl font-black text-purple-400 mt-1">{monthlyReport.newSubscriptions ?? 0}</p>
                    </div>
                    <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(245, 197, 24, 0.06)', border: '1px solid rgba(245, 197, 24, 0.15)' }}>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('stats.staffHours')}</p>
                      <p className="text-xl font-black text-[#F5C518] mt-1">{(monthlyReport.staffHours ?? 0).toFixed(1)}h</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-white/10 rounded-xl text-white/25 text-sm">
                    {t('stats.noData')}
                  </div>
                )}
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
        title={t('stats.deleteTransaction')}
        message={t('stats.deleteTransactionMsg')}
        confirmLabel={t('common.delete')}
        variant="danger"
      />

      {/* Void/Refund Modal */}
      <AnimatePresence>
        {voidTx && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setVoidTx(null)} />
            <motion.div className="relative w-full max-w-md rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <button onClick={() => setVoidTx(null)} className="absolute top-5 right-5 text-white/30 hover:text-white"><X size={18} /></button>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <RotateCcw size={18} className="text-orange-400" /> {t('void.voidRefund')}
              </h3>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5 mb-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-white/50">{t('stats.student')}</span><span className="text-white font-bold">{voidTx.student?.fullName || voidTx.studentName}</span></div>
                <div className="flex justify-between"><span className="text-white/50">{t('profile.plan')}</span><span className="text-white">{voidTx.planType}</span></div>
                <div className="flex justify-between"><span className="text-white/50">{t('profile.paid')}</span><span className="text-green-400 font-bold">{voidTx.amountPaid.toFixed(2)} JD</span></div>
                <div className="flex justify-between"><span className="text-white/50">{t('profile.gateway')}</span><span className="text-white/70">{voidTx.gateway}</span></div>
              </div>

              <div className="mb-4">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5 block">{t('void.action')}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setVoidAction('REFUND')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border ${voidAction === 'REFUND' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                    <RotateCcw size={14} /> {t('void.fullRefund')}
                  </button>
                  <button type="button" onClick={() => setVoidAction('VOID')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border ${voidAction === 'VOID' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                    <Ban size={14} /> {t('void.voidOnly')}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1 block">{t('void.reason')} *</label>
                <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={2}
                  className="w-full bg-white/5 border border-white/10 focus:border-orange-400 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all resize-none"
                  placeholder={t('void.reasonPlaceholder')} />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setVoidTx(null)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all">{t('common.cancel')}</button>
                <button onClick={handleVoidRefund} disabled={voiding || !voidReason.trim()} className="flex-1 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                  {voiding ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  {t('common.confirm')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
