'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Tag, Users, Shield, Ticket, Calendar, Hash, Percent, DollarSign, ChevronDown, ChevronUp, User, KeyRound, ClipboardList, LogIn, LogOut, Eye, EyeOff, ChevronLeft, ChevronRight, Filter, ArrowLeft, Phone, Mail, Clock, Edit3, Save, X, UserX, UserCheck as UserCheckIcon, CalendarDays, Database, Download, Upload, HardDrive, Monitor, Banknote, ScanLine, MessageSquare } from 'lucide-react'
import { RegistersSection } from '@/components/admin/RegistersSection'
import { PlansSection } from '@/components/admin/PlansSection'
import { PageTransition } from '@/components/animations/PageTransition'
import { todayString } from '@/lib/subscriptionLogic'
import { useI18n } from '@/lib/i18n'
import { AnimatedTabs } from '@/components/animations/AnimatedTabs'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

interface PromoUsage {
  id: number
  discount: number
  createdAt: string
  studentName: string
  student: { id: number; fullName: string; phone: string } | null
}

interface PromoCode {
  id: number
  code: string
  discountType: string
  discountAmount: number
  bonusEntries: number
  isActive: boolean
  maxUses: number
  timesUsed: number
  expiresAt: string | null
  createdAt: string
  usages: PromoUsage[]
}

interface UserAccount {
  id: number
  email: string
  name: string
  phone: string
  role: string
  permissions: string
  isActive: boolean
  createdAt: string
  createdBy: { id: number; email: string; name: string } | null
  lastLogin: string | null
  totalLogins: number
}

interface UserDetail extends UserAccount {
  auditLogs: { id: number; event: string; ip: string; details: string | null; createdAt: string }[]
  attendance: { month: string; days: number[]; count: number }[]
}

const ALL_PAGES = [
  { path: '/', label: 'Dashboard', desc: 'Main check-in screen' },
  { path: '/directory', label: 'Directory', desc: 'Student list & profiles' },
  { path: '/logs', label: 'Logs', desc: 'Check-in/out history' },
  { path: '/stats', label: 'Statistics', desc: 'Reports & analytics' },
  { path: '/barista', label: 'Barista POS', desc: 'Drinks & orders' },
  { path: '/orders', label: 'Orders', desc: 'Customer order queue' },
  { path: '/feedback', label: 'Feedback', desc: 'Customer reviews' },
  { path: '/admin', label: 'Admin Panel', desc: 'Staff & promos management' },
]

interface AuditLogEntry {
  id: number
  userId: number | null
  email: string
  role: string
  event: string
  ip: string
  details: string | null
  createdAt: string
  user: { id: number; email: string; role: string } | null
}

interface ShiftEntry {
  id: number
  userId: number
  email: string
  role: string
  date: string
  clockIn: string
  clockOut: string | null
}

type ActiveTab = 'promos' | 'users' | 'audit' | 'shifts' | 'registers' | 'backup' | 'plans' | 'settings'

export default function AdminPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<ActiveTab>('promos')

  return (
    <PageTransition>
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #F5C518 0%, #D4A516 100%)', boxShadow: '0 8px 32px rgba(245, 197, 24, 0.3)' }}
          whileHover={{ scale: 1.08, rotate: 4 }}
        >
          <Shield size={20} className="text-black" />
        </motion.div>
        <div>
          <h1 className="text-xl font-bold text-white">{t('admin.title')}</h1>
          <p className="text-xs text-white/25">{t('admin.manageDesc')}</p>
        </div>
      </motion.div>

      {/* Tab switcher */}
      <AnimatedTabs
        tabs={[
          { id: 'promos', label: t('admin.promoCodes'), icon: <Ticket size={16} /> },
          { id: 'users', label: t('admin.staffPasswords'), icon: <KeyRound size={16} /> },
          { id: 'shifts', label: t('admin.staffShifts'), icon: <Clock size={16} /> },
          { id: 'audit', label: t('admin.auditLog'), icon: <ClipboardList size={16} /> },
          { id: 'registers', label: t('register.history'), icon: <Banknote size={16} /> },
          { id: 'backup', label: t('admin.backup'), icon: <Database size={16} /> },
          { id: 'plans', label: t('admin.plans'), icon: <Tag size={16} /> },
          { id: 'settings', label: t('admin.settings'), icon: <Monitor size={16} /> },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as ActiveTab)}
      />

      {tab === 'promos' && <PromoSection />}
      {tab === 'users' && <UsersSection />}
      {tab === 'shifts' && <ShiftsSection />}
      {tab === 'audit' && <AuditLogSection />}
      {tab === 'registers' && <RegistersSection />}
      {tab === 'backup' && <BackupSection />}
      {tab === 'plans' && <PlansSection />}
      {tab === 'settings' && <SettingsSection />}
    </div>
    </PageTransition>
  )
}

/* ======================== STAFF AUDIT LOG SECTION ======================== */
function AuditLogSection() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [eventFilter, setEventFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState<string>('')
  const [staffList, setStaffList] = useState<UserAccount[]>([])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (eventFilter) params.set('event', eventFilter)
      if (staffFilter) params.set('userId', staffFilter)
      const res = await fetch(`/api/auth/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      }
    } catch {} finally { setLoading(false) }
  }, [page, eventFilter, staffFilter])

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/users')
      if (res.ok) setStaffList(await res.json())
    } catch {}
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])
  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [eventFilter, staffFilter])

  const eventColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    LOGIN: { bg: 'rgba(34, 197, 94, 0.1)', text: 'text-green-400', icon: <LogIn size={14} /> },
    LOGOUT: { bg: 'rgba(239, 68, 68, 0.1)', text: 'text-red-400', icon: <LogOut size={14} /> },
    PASSWORD_RESET_BY_ADMIN: { bg: 'rgba(245, 197, 24, 0.1)', text: 'text-[#F5C518]', icon: <KeyRound size={14} /> },
  }

  const roleColors: Record<string, string> = {
    ADMIN: 'text-red-400',
    MANAGER: 'text-amber-400',
    STAFF: 'text-blue-400',
  }
  const roleBgs: Record<string, string> = {
    ADMIN: 'rgba(239, 68, 68, 0.1)',
    MANAGER: 'rgba(245, 158, 11, 0.1)',
    STAFF: 'rgba(59, 130, 246, 0.1)',
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-white/30">{total} {t('admin.auditLog')}</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-white/20" />
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#F5C518] outline-none transition-all"
              style={{ colorScheme: 'dark' }}
            >
              <option value="">{t('admin.allEvents')}</option>
              <option value="LOGIN">{t('admin.logins')}</option>
              <option value="LOGOUT">{t('admin.logouts')}</option>
              <option value="PASSWORD_RESET_BY_ADMIN">{t('admin.passwordResets')}</option>
            </select>
          </div>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#F5C518] outline-none transition-all"
            style={{ colorScheme: 'dark' }}
          >
            <option value="">{t('admin.allStaff')}</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.email} ({s.role === 'STAFF' ? t('admin.staff') : s.role})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-white/25" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-white/25">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{t('admin.noAuditEvents')}</p>
          <p className="text-xs text-white/20">{t('admin.auditDesc')}</p>
        </div>
      ) : (
        <div className="hive-card !rounded-2xl !p-0 overflow-hidden">
          <div className="overflow-auto max-h-[600px]" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <tr>
                  {[t('admin.event'), t('admin.staffMember'), t('admin.role'), t('admin.ipAddress'), t('admin.details'), t('admin.time')].map((h, i) => (
                    <th key={i} className="px-5 py-4 text-[10px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const ec = eventColors[log.event] || { bg: 'rgba(255,255,255,0.05)', text: 'text-white/40', icon: <Hash size={14} /> }
                  return (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hive-table-row"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${ec.text}`}
                          style={{ background: ec.bg }}
                        >
                          {ec.icon}
                          {log.event === 'PASSWORD_RESET_BY_ADMIN' ? 'PWD Reset' : log.event}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-white/80">{log.email}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${roleColors[log.role] || 'text-white/40'}`}
                          style={{ background: roleBgs[log.role] || 'rgba(255,255,255,0.05)' }}
                        >
                          {log.role === 'STAFF' ? t('admin.staff') : log.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-white/25">{log.ip}</td>
                      <td className="px-5 py-4 text-xs text-white/30 max-w-[200px] truncate" title={log.details || ''}>
                        {log.details || '—'}
                      </td>
                      <td className="px-5 py-4 text-xs text-white/40 font-bold whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString('en-JO', { month: 'short', day: 'numeric' })}{' '}
                        {new Date(log.createdAt).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-xs text-white/25">{t('admin.page')} {page} {t('admin.of')} {totalPages} ({total} {t('admin.total')})</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ======================== PROMO CODES SECTION ======================== */
function PromoSection() {
  const { t } = useI18n()
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENTAGE' | 'BONUS_ENTRIES'>('AMOUNT')
  const [discount, setDiscount] = useState('')
  const [bonusEntries, setBonusEntries] = useState('')
  const [maxUses, setMaxUses] = useState('0')
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch('/api/promo')
      if (res.ok) setPromos(await res.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPromos() }, [fetchPromos])

  const handleCreate = async () => {
    if (!code.trim()) { setError(t('admin.code') + ' *'); return }
    if (discountType === 'BONUS_ENTRIES' && (!bonusEntries || Number(bonusEntries) <= 0)) { setError(t('admin.bonusEntries') + ' *'); return }
    if (discountType !== 'BONUS_ENTRIES' && !discount) { setError(t('admin.amount') + ' *'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          discountType,
          discountAmount: discountType === 'BONUS_ENTRIES' ? 0 : Number(discount),
          bonusEntries: discountType === 'BONUS_ENTRIES' ? Number(bonusEntries) : 0,
          maxUses: Number(maxUses) || 0,
          expiresAt: expiresAt || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create'); return }
      setCode(''); setDiscount(''); setBonusEntries(''); setDiscountType('AMOUNT'); setMaxUses('0'); setExpiresAt(''); setShowForm(false)
      fetchPromos()
    } finally { setSaving(false) }
  }

  const handleToggle = async (id: number, currentActive: boolean) => {
    await fetch(`/api/promo/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentActive }),
    })
    fetchPromos()
  }

  const handleDelete = (id: number) => {
    setConfirmDeleteId(id)
  }

  const executeDeletePromo = async () => {
    if (confirmDeleteId === null) return
    await fetch(`/api/promo/${confirmDeleteId}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    fetchPromos()
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-white/25" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-white/30">{promos.length} {t('admin.promoCodes')}</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all"
        >
          <Plus size={16} />
          {t('admin.newPromo')}
        </button>
      </div>

      <AnimatePresence>
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -10 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -10 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="hive-card !rounded-2xl overflow-hidden"
        >
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Tag size={16} className="text-[#F5C518]" />
            {t('admin.createPromo')}
          </h3>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.code')} *</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER25"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.discountType')} *</label>
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDiscountType('AMOUNT')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-all ${
                    discountType === 'AMOUNT'
                      ? 'bg-[#F5C518] text-black'
                      : 'bg-white/5 text-white/40 hover:bg-white/8'
                  }`}
                >
                  <DollarSign size={14} />
                  {t('admin.amount')}
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('PERCENTAGE')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-all ${
                    discountType === 'PERCENTAGE'
                      ? 'bg-[#F5C518] text-black'
                      : 'bg-white/5 text-white/40 hover:bg-white/8'
                  }`}
                >
                  <Percent size={14} />
                  {t('admin.percentage')}
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('BONUS_ENTRIES')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-all ${
                    discountType === 'BONUS_ENTRIES'
                      ? 'bg-[#F5C518] text-black'
                      : 'bg-white/5 text-white/40 hover:bg-white/8'
                  }`}
                >
                  <Plus size={14} />
                  {t('admin.entries')}
                </button>
              </div>
            </div>

            {discountType === 'BONUS_ENTRIES' ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.bonusEntries')} *</label>
                <input
                  type="number"
                  value={bonusEntries}
                  onChange={(e) => setBonusEntries(e.target.value)}
                  placeholder="e.g. 5"
                  min="1"
                  max="999"
                  step="1"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20"
                />
                <p className="text-[10px] text-white/20">{t('admin.bonusEntriesDesc')}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
                  {discountType === 'PERCENTAGE' ? `${t('admin.discountPct')} *` : `${t('admin.discountJd')} *`}
                </label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder={discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 10'}
                  min="0.01"
                  max={discountType === 'PERCENTAGE' ? '100' : undefined}
                  step={discountType === 'PERCENTAGE' ? '1' : '0.5'}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.maxUses')}</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                min="0"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.expiresAt')}</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400 p-2 rounded-lg mt-3" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>{error}</p>}

          <div className="flex gap-3 pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-sm hover:bg-white/10 transition-all">
              {t('common.cancel')}
            </button>
            <button onClick={handleCreate} disabled={saving} className="px-5 py-2 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? t('admin.creating') : t('admin.create')}
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {promos.length === 0 && !showForm ? (
        <div className="text-center py-16 text-white/25">
          <Ticket size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{t('admin.noPromos')}</p>
          <p className="text-xs text-white/20">{t('admin.createPromoDesc')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {promos.map((promo, index) => {
            const expired = promo.expiresAt && new Date() > new Date(promo.expiresAt)
            const exhausted = promo.maxUses > 0 && promo.timesUsed >= promo.maxUses
            const isExpanded = expandedId === promo.id

            return (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className={`rounded-xl transition-all border ${
                  !promo.isActive || expired || exhausted ? 'border-white/5 opacity-60' : 'border-white/10 hover:border-[#F5C518]/30'
                }`}
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <span className="font-mono font-bold text-sm text-white tracking-wide">{promo.code}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80' }}>
                        {promo.discountType === 'BONUS_ENTRIES' ? <Plus size={12} /> : promo.discountType === 'PERCENTAGE' ? <Percent size={12} /> : <DollarSign size={12} />}
                        {promo.discountType === 'BONUS_ENTRIES' ? `+${promo.bonusEntries} ${t('admin.entries')}` : promo.discountType === 'PERCENTAGE' ? `${promo.discountAmount}%` : `${promo.discountAmount} JD`}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
                        <Hash size={12} />
                        {promo.timesUsed}{promo.maxUses > 0 ? `/${promo.maxUses}` : '/∞'} {t('admin.used')}
                      </span>
                      {promo.expiresAt && (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${expired ? 'text-red-400' : 'text-white/40'}`}
                          style={{ background: expired ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)' }}>
                          <Calendar size={12} />
                          {expired ? t('admin.expired') : `${t('admin.expiresAt').split(' ')[0]} ${new Date(promo.expiresAt).toLocaleDateString()}`}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                        promo.isActive && !expired && !exhausted ? 'text-green-400' : 'text-red-400'
                      }`} style={{ background: promo.isActive && !expired && !exhausted ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${promo.isActive && !expired && !exhausted ? 'bg-green-400' : 'bg-red-400'}`} />
                        {!promo.isActive ? t('admin.disabled') : expired ? t('admin.expired') : exhausted ? t('admin.usedUp') : t('admin.active')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {promo.usages.length > 0 && (
                      <button onClick={() => setExpandedId(isExpanded ? null : promo.id)}
                        className="p-2 rounded-lg hover:bg-white/8 transition-all text-white/30 hover:text-white flex items-center gap-1" title="View usage history">
                        <User size={16} /><span className="text-xs font-bold">{promo.usages.length}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    <button onClick={() => handleToggle(promo.id, promo.isActive)}
                      className="p-2 rounded-lg hover:bg-white/8 transition-all text-white/30 hover:text-white" title={promo.isActive ? 'Disable' : 'Enable'}>
                      {promo.isActive ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} />}
                    </button>
                    <button onClick={() => handleDelete(promo.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-all text-white/30 hover:text-red-400" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                {isExpanded && promo.usages.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }} className="px-4 py-3 rounded-b-xl overflow-hidden"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">{t('admin.usageHistory')}</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {promo.usages.map((usage) => (
                        <div key={usage.id} className="flex items-center justify-between rounded-lg px-3 py-2 border border-white/8 text-sm" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <User size={12} className="text-white/30" />
                            </div>
                            <div>
                              <span className="font-semibold text-white/80">{usage.student?.fullName || usage.studentName || t('dash.deletedStudent')}</span>
                              {usage.student?.phone && <span className="text-xs text-white/25 ml-2">{usage.student.phone}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-green-400 px-2 py-0.5 rounded" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                              -{usage.discount.toFixed(2)} JD
                            </span>
                            <span className="text-xs text-white/25">
                              {new Date(usage.createdAt).toLocaleDateString('en-JO', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={executeDeletePromo}
        title={t('admin.deletePromo')}
        message={t('admin.deletePromoMsg')}
        confirmLabel={t('common.delete')}
        variant="danger"
      />
    </div>
  )
}

/* ======================== USERS SECTION (LIST + DETAIL SUBPAGE) ======================== */
function UsersSection() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  if (selectedUserId) {
    return <StaffDetailView userId={selectedUserId} onBack={() => setSelectedUserId(null)} />
  }
  return <StaffListView onSelect={(id) => setSelectedUserId(id)} />
}

/* --- Staff List View --- */
function StaffListView({ onSelect }: { onSelect: (id: number) => void }) {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffPhone, setStaffPhone] = useState('')
  const [role, setRole] = useState('STAFF')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['/', '/directory', '/logs'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/users')
      if (res.ok) setUsers(await res.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleCreate = async () => {
    if (!email.trim() || !password) { setError(`${t('admin.email')} & ${t('admin.password')} *`); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role, name: staffName, phone: staffPhone, permissions: role === 'MANAGER' ? selectedPermissions : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create user'); return }
      setEmail(''); setPassword(''); setStaffName(''); setStaffPhone(''); setRole('STAFF'); setSelectedPermissions(['/', '/directory', '/logs']); setShowForm(false)
      fetchUsers()
    } finally { setSaving(false) }
  }

  const roleColors: Record<string, string> = {
    ADMIN: 'text-red-400', MANAGER: 'text-amber-400', STAFF: 'text-blue-400', BARISTA: 'text-emerald-400',
  }
  const roleBgs: Record<string, string> = {
    ADMIN: 'rgba(239, 68, 68, 0.1)', MANAGER: 'rgba(245, 158, 11, 0.1)', STAFF: 'rgba(59, 130, 246, 0.1)', BARISTA: 'rgba(16, 185, 129, 0.1)',
  }

  const togglePermission = (path: string) => {
    setSelectedPermissions(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    )
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-white/25" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-white/30">{users.length} {t('admin.staff')}</p>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all">
          <Plus size={16} /> {t('admin.newAccount')}
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0, y: -10 }} animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -10 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="hive-card !rounded-2xl overflow-hidden">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users size={16} className="text-[#F5C518]" /> {t('admin.createStaff')}
          </h3>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.fullName')}</label>
              <input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="e.g. Ahmad Khalil"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.phoneNumber')}</label>
              <input value={staffPhone} onChange={(e) => setStaffPhone(e.target.value)} placeholder="07XXXXXXXX"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.email')} *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@hive.study"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.password')} *</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, letter + number"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.role')}</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
                style={{ colorScheme: 'dark' }}>
                <option value="BARISTA">{t('admin.barista') || 'Barista'}</option>
                <option value="STAFF">{t('admin.staff')}</option>
                <option value="MANAGER">{t('admin.managerCustom')}</option>
                <option value="ADMIN">{t('admin.adminFull')}</option>
              </select>
            </div>
            {/* Permissions checkboxes for MANAGER */}
            {role === 'MANAGER' && (
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.pagePermissions')}</label>
                <p className="text-[10px] text-white/20">{t('admin.selectPages')}</p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {ALL_PAGES.map(page => (
                    <label key={page.path}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        selectedPermissions.includes(page.path)
                          ? 'border-[#F5C518]/40 bg-[rgba(245,197,24,0.06)]'
                          : 'border-white/8 bg-white/3 hover:border-white/15'
                      }`}>
                      <input type="checkbox" checked={selectedPermissions.includes(page.path)}
                        onChange={() => togglePermission(page.path)}
                        className="w-3.5 h-3.5 rounded accent-[#F5C518]" />
                      <div>
                        <span className={`text-xs font-semibold ${selectedPermissions.includes(page.path) ? 'text-[#F5C518]' : 'text-white/50'}`}>{page.label}</span>
                        <p className="text-[9px] text-white/20">{page.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {role === 'ADMIN' && (
              <div className="col-span-2 p-3 rounded-lg border border-red-500/20" style={{ background: 'rgba(239,68,68,0.05)' }}>
                <p className="text-xs text-red-400 font-semibold flex items-center gap-1.5"><Shield size={14} /> {t('admin.fullAdminAccess')}</p>
                <p className="text-[10px] text-white/25 mt-1">{t('admin.fullAdminDesc')}</p>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-red-400 p-2 rounded-lg mt-3" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>{error}</p>}
          <div className="flex gap-3 pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-medium text-sm hover:bg-white/10 transition-all">{t('common.cancel')}</button>
            <button onClick={handleCreate} disabled={saving} className="px-5 py-2 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? t('admin.creating') : t('admin.createAccount')}
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Staff cards */}
      {users.length === 0 ? (
        <div className="text-center py-16 text-white/25">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{t('admin.noStaff')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user, index) => (
            <motion.div key={user.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              onClick={() => onSelect(user.id)}
              className="border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-[#F5C518]/30 transition-all cursor-pointer group"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white/30 ${!user.isActive ? 'opacity-40' : ''}`}
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <User size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white/80">{user.name || user.email}</p>
                    {!user.isActive && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>DISABLED</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/25">
                    {user.name && <span>{user.email}</span>}
                    {user.phone && <span className="flex items-center gap-1"><Phone size={10} />{user.phone}</span>}
                    {!user.name && <span>{new Date(user.createdAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-2 hidden sm:block">
                  {user.lastLogin ? (
                    <p className="text-[10px] text-white/20">Last seen {new Date(user.lastLogin).toLocaleDateString('en-JO', { month: 'short', day: 'numeric' })}</p>
                  ) : (
                    <p className="text-[10px] text-white/15">{t('admin.neverLoggedIn')}</p>
                  )}
                  <p className="text-[10px] text-white/15">{user.totalLogins} login{user.totalLogins !== 1 ? 's' : ''}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleColors[user.role] || 'text-white/40'}`}
                  style={{ background: roleBgs[user.role] || 'rgba(255,255,255,0.05)' }}>
                  {user.role === 'STAFF' ? t('admin.staff') : user.role === 'MANAGER' ? t('admin.managerCustom').split(' ')[0] : user.role}
                </span>
                <ChevronRight size={16} className="text-white/15 group-hover:text-[#F5C518] transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

/* --- Staff Detail View (Subpage) --- */
function StaffDetailView({ userId, onBack }: { userId: number; onBack: () => void }) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Password reset
  const [showReset, setShowReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Permissions editing (for MANAGER)
  const [editingPerms, setEditingPerms] = useState(false)
  const [editPerms, setEditPerms] = useState<string[]>([])
  const [savingPerms, setSavingPerms] = useState(false)

  // Attendance month
  const [attendanceMonth, setAttendanceMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })

  const fetchUser = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/users/${userId}`)
      if (res.ok) {
        const data = await res.json()
        setUser(data)
        setEditName(data.name || '')
        setEditPhone(data.phone || '')
        try { setEditPerms(JSON.parse(data.permissions || '[]')) } catch { setEditPerms([]) }
      }
    } catch {} finally { setLoading(false) }
  }, [userId])

  useEffect(() => { fetchUser() }, [fetchUser])

  const handleSaveProfile = async () => {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      })
      if (res.ok) {
        setEditing(false)
        fetchUser()
      }
    } finally { setEditSaving(false) }
  }

  const handleToggleActive = async () => {
    if (!user) return
    const res = await fetch(`/api/auth/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    if (res.ok) fetchUser()
  }

  const handleSavePermissions = async () => {
    setSavingPerms(true)
    try {
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editPerms }),
      })
      if (res.ok) {
        setEditingPerms(false)
        fetchUser()
      }
    } finally { setSavingPerms(false) }
  }

  const handleResetPassword = async () => {
    if (!newPassword) return
    setResetting(true); setResetError(''); setResetSuccess('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setResetError(data.error); return }
      setResetSuccess(t('admin.passwordResetSuccess'))
      setNewPassword('')
      setShowNewPassword(false)
      setTimeout(() => { setShowReset(false); setResetSuccess('') }, 2000)
    } finally { setResetting(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/auth/users/${userId}`, { method: 'DELETE' })
      if (res.ok) onBack()
      else {
        const data = await res.json()
        toast(data.error || 'Failed to delete')
      }
    } finally { setDeleting(false) }
  }

  const roleColors: Record<string, string> = {
    ADMIN: 'text-red-400', MANAGER: 'text-amber-400', STAFF: 'text-blue-400', BARISTA: 'text-emerald-400',
  }
  const roleBgs: Record<string, string> = {
    ADMIN: 'rgba(239, 68, 68, 0.1)', MANAGER: 'rgba(245, 158, 11, 0.1)', STAFF: 'rgba(59, 130, 246, 0.1)', BARISTA: 'rgba(16, 185, 129, 0.1)',
  }

  const eventColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    LOGIN: { bg: 'rgba(34, 197, 94, 0.1)', text: 'text-green-400', icon: <LogIn size={12} /> },
    LOGOUT: { bg: 'rgba(239, 68, 68, 0.1)', text: 'text-red-400', icon: <LogOut size={12} /> },
    PASSWORD_RESET_BY_ADMIN: { bg: 'rgba(245, 197, 24, 0.1)', text: 'text-[#F5C518]', icon: <KeyRound size={12} /> },
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-white/25" /></div>
  if (!user) return <div className="text-center py-12 text-white/25">{t('admin.noStaff')}</div>

  // Build attendance calendar for the selected month
  const currentAttendance = user.attendance.find(a => a.month === attendanceMonth)
  const attendanceDays = currentAttendance?.days || []
  const [yearStr, monthStr] = attendanceMonth.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sun

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
      className="space-y-5">

      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
        <ArrowLeft size={16} /> {t('admin.backToList')}
      </button>

      {/* Profile card */}
      <div className="hive-card !rounded-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold ${!user.isActive ? 'opacity-40' : ''}`}
              style={{ background: roleBgs[user.role] || 'rgba(255,255,255,0.06)', color: roleColors[user.role]?.replace('text-', '') }}>
              <span className={roleColors[user.role]}>{(user.name || user.email)[0].toUpperCase()}</span>
            </div>
            <div>
              {editing ? (
                <div className="flex flex-col gap-2">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#F5C518] outline-none w-56"
                    autoFocus />
                  <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone number"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#F5C518] outline-none w-56" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{user.name || t('admin.unnamedStaff')}</h2>
                    {!user.isActive && <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-400 border border-red-500/20" style={{ background: 'rgba(239,68,68,0.1)' }}>DISABLED</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/30 mt-1">
                    <span className="flex items-center gap-1"><Mail size={11} />{user.email}</span>
                    {user.phone && <span className="flex items-center gap-1"><Phone size={11} />{user.phone}</span>}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all"><X size={16} /></button>
                <button onClick={handleSaveProfile} disabled={editSaving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-xs transition-all">
                  {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('admin.save')}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white text-xs font-medium transition-all">
                <Edit3 size={14} /> {t('profile.edit')}
              </button>
            )}
          </div>
        </div>

        {/* Role change */}
        <div className="flex items-center gap-3 mt-5 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.changeRole')}</span>
          <select
            value={user.role}
            onChange={async (e) => {
              const newRole = e.target.value
              if (newRole === user.role) return
              const res = await fetch(`/api/auth/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
              })
              if (res.ok) {
                toast(t('admin.roleChanged'), 'success')
                fetchUser()
              } else {
                const d = await res.json().catch(() => ({}))
                toast(d.error || 'Failed', 'error')
              }
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#F5C518] outline-none"
            style={{ colorScheme: 'dark' }}
          >
            <option value="STAFF">{t('admin.staff')}</option>
            <option value="MANAGER">{t('admin.managerCustom')}</option>
            <option value="ADMIN">{t('admin.adminFull')}</option>
          </select>
          <span className="text-[10px] text-white/20">{t('admin.roleChangeNote')}</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: t('admin.role'), value: user.role === 'STAFF' ? t('admin.staff') : user.role === 'MANAGER' ? t('admin.managerCustom').split(' ')[0] : user.role, color: roleColors[user.role] },
            { label: t('admin.totalLogins'), value: user.totalLogins.toString(), color: 'text-white' },
            { label: t('admin.lastActive'), value: user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-JO', { month: 'short', day: 'numeric', year: 'numeric' }) : t('admin.never'), color: 'text-white' },
            { label: t('profile.memberSince'), value: new Date(user.createdAt).toLocaleDateString('en-JO', { month: 'short', day: 'numeric', year: 'numeric' }), color: 'text-white' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-sm font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setShowReset(!showReset)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#F5C518] transition-all hover:bg-[rgba(245,197,24,0.1)] border border-transparent hover:border-[rgba(245,197,24,0.2)]">
            <KeyRound size={14} /> {t('admin.resetPassword')}
          </button>
          {user.role !== 'ADMIN' && (
            <>
              <button onClick={handleToggleActive}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-transparent ${
                  user.isActive
                    ? 'text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/20'
                    : 'text-green-400 hover:bg-green-500/10 hover:border-green-500/20'
                }`}>
                {user.isActive ? <><UserX size={14} /> {t('admin.disableAccount')}</> : <><UserCheckIcon size={14} /> {t('admin.enableAccount')}</>}
              </button>
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-red-400 transition-all hover:bg-red-500/10 border border-transparent hover:border-red-500/20 ml-auto">
                <Trash2 size={14} /> {t('admin.deleteAccount')}
              </button>
            </>
          )}
        </div>

        {/* Created by info */}
        {user.createdBy && (
          <div className="mt-3 pt-3 flex items-center gap-2 text-xs text-white/20" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <User size={12} />
            <span>{t('admin.createdBy')} <span className="text-white/40 font-semibold">{user.createdBy.name || user.createdBy.email}</span></span>
          </div>
        )}
      </div>

      {/* Manager Permissions */}
      {user.role === 'MANAGER' && (
        <div className="hive-card !rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield size={16} className="text-amber-400" /> {t('admin.pagePermissions')}
            </h3>
            {editingPerms ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingPerms(false)} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all"><X size={14} /></button>
                <button onClick={handleSavePermissions} disabled={savingPerms}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-xs transition-all">
                  {savingPerms ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {t('admin.save')}
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingPerms(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white text-xs font-medium transition-all">
                <Edit3 size={12} /> {t('profile.edit')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_PAGES.map(page => {
              const hasAccess = editingPerms ? editPerms.includes(page.path) : (() => { try { return JSON.parse(user.permissions || '[]').includes(page.path) } catch { return false } })()
              return (
                <div key={page.path}
                  onClick={() => { if (editingPerms) setEditPerms(prev => prev.includes(page.path) ? prev.filter(p => p !== page.path) : [...prev, page.path]) }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all ${editingPerms ? 'cursor-pointer' : ''} ${
                    hasAccess
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-white/6 bg-white/2'
                  }`}>
                  {editingPerms && (
                    <input type="checkbox" checked={hasAccess} readOnly className="w-3.5 h-3.5 rounded accent-[#F5C518]" />
                  )}
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`w-2 h-2 rounded-full ${hasAccess ? 'bg-green-400' : 'bg-white/10'}`} />
                    <span className={`text-xs font-semibold ${hasAccess ? 'text-white/70' : 'text-white/25'}`}>{page.label}</span>
                  </div>
                  <span className={`text-[9px] font-bold uppercase ${hasAccess ? 'text-green-400' : 'text-white/15'}`}>
                    {hasAccess ? t('admin.allowed') : t('admin.denied')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Password Reset */}
      <AnimatePresence>
      {showReset && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="hive-card !rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(245, 197, 24, 0.2)' }}>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound size={16} className="text-[#F5C518]" /> {t('admin.resetPassword')}
          </h3>
          {resetSuccess ? (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-lg text-green-400 text-sm" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {resetSuccess}
            </div>
          ) : (
            <>
              <div className="mt-3 relative">
                <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('admin.newPasswordPlaceholder')} autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleResetPassword() }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-sm text-white focus:border-[#F5C518] outline-none placeholder:text-white/20" />
                <button onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50">
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {resetError && <p className="text-sm text-red-400 mt-2">{resetError}</p>}
              <div className="flex gap-3 mt-3">
                <button onClick={() => { setShowReset(false); setNewPassword(''); setResetError('') }}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-all">{t('common.cancel')}</button>
                <button onClick={handleResetPassword} disabled={resetting || !newPassword}
                  className="px-5 py-2 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40">
                  {resetting ? <Loader2 size={14} className="animate-spin" /> : t('admin.reset')}
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
      {confirmDelete && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="hive-card !rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
            <Trash2 size={16} /> {t('admin.permanentlyDelete')}
          </h3>
          <p className="text-sm text-white/40 mt-2">{t('admin.deleteAccountMsg').replace('{email}', user.email)}</p>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm hover:bg-white/10 transition-all">{t('common.cancel')}</button>
            <button onClick={handleDelete} disabled={deleting}
              className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all flex items-center gap-2">
              {deleting && <Loader2 size={14} className="animate-spin" />}
              {deleting ? t('admin.deleting') : t('admin.yesDelete')}
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Attendance Calendar */}
      <div className="hive-card !rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarDays size={16} className="text-[#F5C518]" /> {t('admin.monthlyAttendance')}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const d = new Date(year, month - 2, 1)
              setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
            }} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/30 hover:text-white transition-all">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-white/60 min-w-[120px] text-center">
              {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => {
              const d = new Date(year, month, 1)
              setAttendanceMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
            }} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/30 hover:text-white transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3 text-[10px] font-bold text-white/20 uppercase tracking-wider">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/60" /> {t('admin.present')}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(255,255,255,0.04)' }} /> {t('admin.absent')}</span>
          <span className="ml-auto">{attendanceDays.length} {attendanceDays.length !== 1 ? t('admin.daysThisMonth') : t('admin.dayThisMonth')}</span>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-white/15 py-1">{d}</div>
          ))}
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const isPresent = attendanceDays.includes(day)
            const now = new Date(); const isToday = attendanceMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` && day === now.getDate()
            return (
              <div key={day} className={`relative text-center py-2 rounded-lg text-xs font-semibold transition-all ${
                isPresent
                  ? 'text-green-300'
                  : 'text-white/15'
              } ${isToday ? 'ring-1 ring-[#F5C518]/40' : ''}`}
                style={{ background: isPresent ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255,255,255,0.02)' }}>
                {day}
              </div>
            )
          })}
        </div>
      </div>

      {/* Activity Log */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <ClipboardList size={16} className="text-[#F5C518]" /> {t('admin.recentActivity')}
        </h3>
        {user.auditLogs.length === 0 ? (
          <p className="text-sm text-white/20 text-center py-8">{t('admin.noActivity')}</p>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {user.auditLogs.map((log) => {
              const ec = eventColors[log.event] || { bg: 'rgba(255,255,255,0.05)', text: 'text-white/40', icon: <Hash size={12} /> }
              return (
                <div key={log.id} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${ec.text}`}
                      style={{ background: ec.bg }}>
                      {ec.icon}
                      {log.event === 'PASSWORD_RESET_BY_ADMIN' ? 'PWD Reset' : log.event}
                    </span>
                    {log.details && <span className="text-xs text-white/25 max-w-[200px] truncate">{log.details}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-white/15">{log.ip}</span>
                    <span className="text-white/30 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('en-JO', { month: 'short', day: 'numeric' })}{' '}
                      {new Date(log.createdAt).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ======================== STAFF SHIFTS SECTION ======================== */
function ShiftsSection() {
  const { t } = useI18n()
  const [shifts, setShifts] = useState<ShiftEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(todayString())

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shifts?date=${selectedDate}`)
      if (res.ok) setShifts(await res.json())
    } catch {} finally { setLoading(false) }
  }, [selectedDate])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })
  const getDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return 'Active'
    const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  const roleColors: Record<string, string> = {
    ADMIN: 'text-red-400', MANAGER: 'text-amber-400', STAFF: 'text-blue-400', BARISTA: 'text-emerald-400',
  }
  const roleBgs: Record<string, string> = {
    ADMIN: 'rgba(239, 68, 68, 0.1)', MANAGER: 'rgba(245, 158, 11, 0.1)', STAFF: 'rgba(59, 130, 246, 0.1)', BARISTA: 'rgba(16, 185, 129, 0.1)',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/30">{shifts.length} {t('admin.staffShifts')}</p>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#F5C518] outline-none"
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-white/25" /></div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-16 text-white/25">
          <Clock size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">{t('admin.noShifts')}</p>
          <p className="text-xs text-white/20">{t('admin.shiftsAutoLogged')}</p>
        </div>
      ) : (
        <div className="hive-card !rounded-2xl !p-0 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead style={{ background: 'rgba(10,10,10,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <tr>
                {[t('admin.staff'), t('admin.role'), t('admin.clockIn'), t('admin.clockOut'), t('admin.duration')].map((h, i) => (
                  <th key={i} className="px-5 py-4 text-[10px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="hover:bg-white/3 transition-colors">
                  <td className="px-5 py-4 font-semibold text-white/80">{shift.email.split('@')[0]}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${roleColors[shift.role] || 'text-white/40'}`}
                      style={{ background: roleBgs[shift.role] || 'rgba(255,255,255,0.05)' }}>
                      {shift.role === 'STAFF' ? t('admin.staff') : shift.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-white/60">{formatTime(shift.clockIn)}</td>
                  <td className="px-5 py-4 font-mono text-white/60">{shift.clockOut ? formatTime(shift.clockOut) : <span className="text-green-400 text-xs font-bold">Active</span>}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-bold ${shift.clockOut ? 'text-white/50' : 'text-green-400'}`}>
                      {getDuration(shift.clockIn, shift.clockOut)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ======================== BACKUP & SETTINGS SECTION ======================== */
function BackupSection() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Backup history
  const [backupLogs, setBackupLogs] = useState<{ id: number; success: boolean; fileName: string | null; fileSize: number | null; trigger: string; error: string | null; timestamp: string }[]>([])
  const [lastSuccess, setLastSuccess] = useState<any>(null)
  const [triggering, setTriggering] = useState(false)

  // Auto-backup settings
  const [backupFreq, setBackupFreq] = useState('24')
  const [backupRetention, setBackupRetention] = useState('30')
  const [savingBackupSettings, setSavingBackupSettings] = useState(false)

  useEffect(() => {
    fetch('/api/backup/status')
      .then(r => r.ok ? r.json() : { logs: [], lastSuccess: null })
      .then(data => {
        setBackupLogs(data.logs || [])
        setLastSuccess(data.lastSuccess)
      })
      .catch(() => {})
  }, [])

  const handleTriggerBackup = async () => {
    setTriggering(true)
    try {
      const res = await fetch('/api/backup/trigger', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast(t('admin.backupTriggered'), 'success')
        const statusRes = await fetch('/api/backup/status')
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          setBackupLogs(statusData.logs || [])
          setLastSuccess(statusData.lastSuccess)
        }
      } else {
        toast(data.error || 'Backup failed', 'error')
      }
    } catch {
      toast('Backup trigger failed', 'error')
    } finally {
      setTriggering(false)
    }
  }

  const handleSaveBackupSettings = async () => {
    setSavingBackupSettings(true)
    try {
      await Promise.all([
        fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'backupFrequencyHours', value: backupFreq }) }),
        fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'backupRetentionDays', value: backupRetention }) }),
      ])
      toast('Saved!', 'success')
    } catch {
      toast('Failed to save', 'error')
    } finally {
      setSavingBackupSettings(false)
    }
  }

  // Settings
  const [maxCapacity, setMaxCapacity] = useState('')
  const [savingCapacity, setSavingCapacity] = useState(false)
  const [capacityStatus, setCapacityStatus] = useState('')

  // Plan pricing
  const [planPrices, setPlanPrices] = useState({ Daily: '3', Weekly: '15', Monthly: '50' })
  const [planVisits, setPlanVisits] = useState({ Daily: '999', Weekly: '7', Monthly: '30' })
  const [planDays, setPlanDays] = useState({ Daily: '1', Weekly: '10', Monthly: '40' })
  const [savingPlans, setSavingPlans] = useState(false)
  const [planStatus, setPlanStatus] = useState('')

  // Public display settings
  const [displayEnabled, setDisplayEnabled] = useState(false)
  const [displayConnection, setDisplayConnection] = useState('hdmi')
  const [savingDisplay, setSavingDisplay] = useState(false)
  const [displayStatus, setDisplayStatus] = useState('')

  // QR code settings
  const [qrEnabled, setQrEnabled] = useState(false)
  const [savingQr, setSavingQr] = useState(false)
  const [qrStatus, setQrStatus] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, unknown>) => {
        if (s.maxCapacity) setMaxCapacity(String(s.maxCapacity))
        if (s.planPriceDaily) setPlanPrices(prev => ({ ...prev, Daily: String(s.planPriceDaily) }))
        if (s.planPriceWeekly) setPlanPrices(prev => ({ ...prev, Weekly: String(s.planPriceWeekly) }))
        if (s.planPriceMonthly) setPlanPrices(prev => ({ ...prev, Monthly: String(s.planPriceMonthly) }))
        if (s.planVisitsDaily) setPlanVisits(prev => ({ ...prev, Daily: String(s.planVisitsDaily) }))
        if (s.planVisitsWeekly) setPlanVisits(prev => ({ ...prev, Weekly: String(s.planVisitsWeekly) }))
        if (s.planVisitsMonthly) setPlanVisits(prev => ({ ...prev, Monthly: String(s.planVisitsMonthly) }))
        if (s.planDaysDaily) setPlanDays(prev => ({ ...prev, Daily: String(s.planDaysDaily) }))
        if (s.planDaysWeekly) setPlanDays(prev => ({ ...prev, Weekly: String(s.planDaysWeekly) }))
        if (s.planDaysMonthly) setPlanDays(prev => ({ ...prev, Monthly: String(s.planDaysMonthly) }))
        if (s.publicDisplayEnabled) setDisplayEnabled(s.publicDisplayEnabled === 'true')
        if (s.publicDisplayConnection) setDisplayConnection(String(s.publicDisplayConnection))
        if (s.qrEnabled !== undefined) setQrEnabled(s.qrEnabled === 'true')
        if (s.backupFrequencyHours) setBackupFreq(String(s.backupFrequencyHours))
        if (s.backupRetentionDays) setBackupRetention(String(s.backupRetentionDays))
      })
      .catch(() => {})
  }, [])

  const handleSavePlans = async () => {
    setSavingPlans(true)
    setPlanStatus('')
    try {
      const settings = [
        { key: 'planPriceDaily', value: planPrices.Daily },
        { key: 'planPriceWeekly', value: planPrices.Weekly },
        { key: 'planPriceMonthly', value: planPrices.Monthly },
        { key: 'planVisitsDaily', value: planVisits.Daily },
        { key: 'planVisitsWeekly', value: planVisits.Weekly },
        { key: 'planVisitsMonthly', value: planVisits.Monthly },
        { key: 'planDaysDaily', value: planDays.Daily },
        { key: 'planDaysWeekly', value: planDays.Weekly },
        { key: 'planDaysMonthly', value: planDays.Monthly },
      ]
      await Promise.all(settings.map(s =>
        fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s),
        })
      ))
      setPlanStatus('Saved!')
    } catch {
      setPlanStatus('Failed to save')
    } finally {
      setSavingPlans(false)
      setTimeout(() => setPlanStatus(''), 2000)
    }
  }

  const handleSaveDisplay = async () => {
    setSavingDisplay(true)
    setDisplayStatus('')
    try {
      await Promise.all([
        fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'publicDisplayEnabled', value: String(displayEnabled) }) }),
        fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'publicDisplayConnection', value: displayConnection }) }),
      ])
      setDisplayStatus('Saved!')
    } catch {
      setDisplayStatus('Failed')
    } finally {
      setSavingDisplay(false)
      setTimeout(() => setDisplayStatus(''), 2000)
    }
  }

  const handleSaveQr = async () => {
    setSavingQr(true)
    setQrStatus('')
    try {
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'qrEnabled', value: String(qrEnabled) }) })
      setQrStatus('Saved!')
    } catch {
      setQrStatus('Failed')
    } finally {
      setSavingQr(false)
      setTimeout(() => setQrStatus(''), 2000)
    }
  }

  const handleSaveCapacity = async () => {
    setSavingCapacity(true)
    setCapacityStatus('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maxCapacity', value: maxCapacity }),
      })
      if (res.ok) setCapacityStatus('Saved!')
      else setCapacityStatus('Failed to save')
    } finally {
      setSavingCapacity(false)
      setTimeout(() => setCapacityStatus(''), 2000)
    }
  }

  const handleBackup = async () => {
    setDownloading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) { setStatus({ type: 'error', message: 'Failed to download backup' }); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const _d = new Date(); a.download = `hive-backup-${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}.db`
      a.click()
      URL.revokeObjectURL(url)
      setStatus({ type: 'success', message: 'Backup downloaded successfully!' })
    } catch {
      setStatus({ type: 'error', message: 'Failed to download backup' })
    } finally {
      setDownloading(false)
    }
  }

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!window.confirm('⚠️ Restoring will REPLACE all current data. Are you absolutely sure?')) return
    setUploading(true)
    setStatus(null)
    try {
      const formData = new FormData()
      // Field name must be 'database' — that's what POST /api/backup reads.
      formData.append('database', file)
      // The server requires this header as a safety gate (see src/app/api/backup/route.ts).
      // The user already confirmed via the window.confirm above.
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'X-Confirm-Restore': 'true' },
        body: formData,
      })
      if (res.ok) {
        setStatus({ type: 'success', message: 'Database restored successfully! Please refresh the page.' })
      } else {
        const data = await res.json().catch(() => ({}))
        setStatus({ type: 'error', message: data.error || 'Restore failed' })
      }
    } catch {
      setStatus({ type: 'error', message: 'Restore failed' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Capacity Setting */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Users size={16} className="text-[#F5C518]" />
          {t('admin.capacitySettings')}
        </h3>
        <p className="text-xs text-white/30 mb-4">{t('admin.capacityDesc')}</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(e.target.value)}
            placeholder="e.g. 50"
            min="0"
            className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] outline-none"
          />
          <button
            onClick={handleSaveCapacity}
            disabled={savingCapacity}
            className="px-4 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2"
          >
            {savingCapacity ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t('admin.save')}
          </button>
          {capacityStatus && <span className="text-xs font-bold text-green-400">{capacityStatus}</span>}
        </div>
      </div>

      {/* Plan Pricing Config */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <DollarSign size={16} className="text-[#F5C518]" />
          {t('admin.planPricing')}
        </h3>
        <p className="text-xs text-white/30 mb-4">{t('admin.planPricingDesc')}</p>
        <div className="grid grid-cols-3 gap-4">
          {(['Daily', 'Weekly', 'Monthly'] as const).map((plan) => (
            <div key={plan} className="p-4 rounded-xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-sm font-bold text-[#F5C518] mb-3">{plan}</p>
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-white/25 uppercase">{t('admin.priceJd')}</label>
                  <input type="number" value={planPrices[plan]} onChange={(e) => setPlanPrices(p => ({ ...p, [plan]: e.target.value }))} min="0" step="0.5"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-[#F5C518] outline-none mt-1" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-white/25 uppercase">{t('admin.visits')}</label>
                  <input type="number" value={planVisits[plan]} onChange={(e) => setPlanVisits(p => ({ ...p, [plan]: e.target.value }))} min="1"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-[#F5C518] outline-none mt-1" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-white/25 uppercase">{t('admin.calendarDays')}</label>
                  <input type="number" value={planDays[plan]} onChange={(e) => setPlanDays(p => ({ ...p, [plan]: e.target.value }))} min="1"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:border-[#F5C518] outline-none mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={handleSavePlans} disabled={savingPlans}
            className="px-4 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2">
            {savingPlans ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('admin.savePlans')}
          </button>
          {planStatus && <span className="text-xs font-bold text-green-400">{planStatus}</span>}
        </div>
      </div>

      {/* QR Code Toggle */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <Hash size={16} className="text-[#F5C518]" />
          {t('admin.qrToggle')}
        </h3>
        <p className="text-xs text-white/30 mb-4">
          {t('admin.qrDesc')}
        </p>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-12 h-6 rounded-full transition-all ${qrEnabled ? 'bg-[#F5C518]' : 'bg-white/10'}`}
              onClick={() => setQrEnabled(!qrEnabled)}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${qrEnabled ? 'left-7' : 'left-1'}`} />
            </div>
            <span className={`text-sm font-bold ${qrEnabled ? 'text-[#F5C518]' : 'text-white/30'}`}>
              {qrEnabled ? t('admin.qrEnabled') : t('admin.qrDisabled')}
            </span>
          </label>
        </div>

        {!qrEnabled && (
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-400/80 mb-4">
            {t('admin.qrWarning')}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={handleSaveQr} disabled={savingQr}
            className="px-4 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2">
            {savingQr ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('admin.save')}
          </button>
          {qrStatus && <span className="text-xs font-bold text-green-400">{qrStatus}</span>}
        </div>
      </div>

      {/* Public Display Settings (#17) */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Monitor size={16} className="text-[#F5C518]" />
          {t('admin.display')}
        </h3>
        <p className="text-xs text-white/30 mb-4">{t('admin.displayDesc')}</p>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-12 h-6 rounded-full transition-all ${displayEnabled ? 'bg-[#F5C518]' : 'bg-white/10'}`}
              onClick={() => setDisplayEnabled(!displayEnabled)}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${displayEnabled ? 'left-7' : 'left-1'}`} />
            </div>
            <span className={`text-sm font-bold ${displayEnabled ? 'text-[#F5C518]' : 'text-white/30'}`}>
              {displayEnabled ? t('admin.displayActive') : t('admin.displayDisabled')}
            </span>
          </label>
        </div>

        {displayEnabled && (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.connectionType')}</label>
              <select value={displayConnection} onChange={(e) => setDisplayConnection(e.target.value)}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] outline-none"
                style={{ colorScheme: 'dark' }}>
                <option value="hdmi">HDMI / External Monitor</option>
                <option value="browser">Browser Tab (open /display)</option>
              </select>
            </div>
            <p className="text-[10px] text-white/20">
              {displayConnection === 'hdmi'
                ? 'Open localhost:3000/display in a fullscreen browser on the external monitor.'
                : 'Navigate to /display in any browser tab to show the occupancy screen.'}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button onClick={handleSaveDisplay} disabled={savingDisplay}
            className="px-4 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2">
            {savingDisplay ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('admin.save')}
          </button>
          {displayStatus && <span className="text-xs font-bold text-green-400">{displayStatus}</span>}
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <HardDrive size={16} className="text-[#F5C518]" />
          {t('admin.dbBackup')}
        </h3>
        <p className="text-xs text-white/30 mb-6">
          {t('admin.dbBackupDesc')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Download */}
          <div className="p-5 rounded-xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                <Download size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{t('admin.downloadBackup')}</p>
                <p className="text-[10px] text-white/25">{t('admin.exportSqlite')}</p>
              </div>
            </div>
            <button
              onClick={handleBackup}
              disabled={downloading}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-40"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? t('admin.downloadingDb') : t('admin.downloadDbFile')}
            </button>
          </div>

          {/* Restore */}
          <div className="p-5 rounded-xl border border-red-500/10" style={{ background: 'rgba(239, 68, 68, 0.02)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                <Upload size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{t('admin.restoreBackup')}</p>
                <p className="text-[10px] text-red-400/60">⚠️ {t('admin.replacesData')}</p>
              </div>
            </div>
            <label className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? t('admin.restoringDb') : t('admin.uploadDbFile')}
              <input type="file" accept=".db,.sqlite,.sqlite3" className="hidden" onChange={handleRestore} disabled={uploading} />
            </label>
          </div>
        </div>

        {status && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
            status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {status.type === 'success' ? '✓' : '✕'} {status.message}
          </div>
        )}
      </div>

      {/* Auto-Backup Settings */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Clock size={16} className="text-[#F5C518]" />
          {t('admin.autoBackup')}
        </h3>
        <p className="text-xs text-white/30 mb-4">{t('admin.autoBackupDesc')}</p>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-[10px] text-white/40 mb-1">{t('admin.backupFrequency')}</label>
            <select
              value={backupFreq}
              onChange={(e) => setBackupFreq(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] outline-none"
            >
              <option value="6">6h</option>
              <option value="12">12h</option>
              <option value="24">24h</option>
              <option value="48">48h</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-white/40 mb-1">{t('admin.retentionDays')}</label>
            <select
              value={backupRetention}
              onChange={(e) => setBackupRetention(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] outline-none"
            >
              <option value="7">7 {t('admin.daysLabel')}</option>
              <option value="14">14 {t('admin.daysLabel')}</option>
              <option value="30">30 {t('admin.daysLabel')}</option>
              <option value="90">90 {t('admin.daysLabel')}</option>
            </select>
          </div>
          <button
            onClick={handleSaveBackupSettings}
            disabled={savingBackupSettings}
            className="px-4 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2"
          >
            {savingBackupSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {t('admin.save')}
          </button>
          <button
            onClick={handleTriggerBackup}
            disabled={triggering}
            className="px-4 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2"
          >
            {triggering ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            {t('admin.triggerBackup')}
          </button>
        </div>
        {lastSuccess && (
          <p className="text-xs text-white/30">
            {t('admin.lastBackup')}: {new Date(lastSuccess.timestamp).toLocaleString()} — {(lastSuccess.fileSize / 1024).toFixed(1)} KB
          </p>
        )}
      </div>

      {/* Backup History */}
      {backupLogs.length > 0 && (
        <div className="hive-card !rounded-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <ClipboardList size={16} className="text-[#F5C518]" />
            {t('admin.backupHistory')}
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {backupLogs.slice(0, 20).map((log) => (
              <div key={log.id} className={`flex items-center justify-between p-3 rounded-xl border ${log.success ? 'border-green-500/10 bg-green-500/5' : 'border-red-500/10 bg-red-500/5'}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div>
                    <p className="text-xs font-medium text-white">{log.fileName || 'Failed'}</p>
                    <p className="text-[10px] text-white/30">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    log.trigger === 'STARTUP' ? 'bg-blue-500/10 text-blue-400' :
                    log.trigger === 'SCHEDULED' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-white/5 text-white/40'
                  }`}>{log.trigger}</span>
                  {log.success && log.fileSize != null && <span className="text-[10px] text-white/20">{(log.fileSize / 1024).toFixed(1)} KB</span>}
                  {log.error && <span className="text-[10px] text-red-400 max-w-[150px] truncate">{log.error}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ======================== SETTINGS SECTION ======================== */
function SettingsSection() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [businessName, setBusinessName] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  const [receiptSavePath, setReceiptSavePath] = useState('')
  const [testingPath, setTestingPath] = useState(false)
  const [pathTestResult, setPathTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Kiosk mode toggle
  const [kioskEnabled, setKioskEnabled] = useState(false)
  const [savingKiosk, setSavingKiosk] = useState(false)

  // Feedback toggle
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const [savingFeedback, setSavingFeedback] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, string>) => {
        if (s.businessName) setBusinessName(s.businessName)
        if (s.receiptFooter) setReceiptFooter(s.receiptFooter)
        if (s.receiptSavePath !== undefined) setReceiptSavePath(s.receiptSavePath)
        if (s.kioskEnabled) setKioskEnabled(s.kioskEnabled === 'true')
        if (s.feedbackEnabled) setFeedbackEnabled(s.feedbackEnabled === 'true')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const settings = [
        { key: 'businessName', value: businessName.trim() || 'HIVE Study House' },
        { key: 'receiptFooter', value: receiptFooter.trim() },
        { key: 'receiptSavePath', value: receiptSavePath.trim() },
      ]
      let allOk = true
      for (const s of settings) {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s),
        })
        if (!res.ok) allOk = false
      }
      toast(allOk ? t('common.saved') : t('common.saveFailed'), allOk ? 'success' : 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveKiosk = async () => {
    setSavingKiosk(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'kioskEnabled', value: String(kioskEnabled) }),
      })
      if (res.ok) toast(t('common.saved'), 'success')
      else toast(t('common.saveFailed'), 'error')
    } catch {
      toast(t('common.saveFailed'), 'error')
    } finally {
      setSavingKiosk(false)
    }
  }

  const handleSaveFeedback = async () => {
    setSavingFeedback(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'feedbackEnabled', value: String(feedbackEnabled) }),
      })
      if (res.ok) toast(t('common.saved'), 'success')
      else toast(t('common.saveFailed'), 'error')
    } catch {
      toast(t('common.saveFailed'), 'error')
    } finally {
      setSavingFeedback(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-white/25" /></div>

  return (
    <div className="space-y-6">
      {/* Feedback Toggle */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <MessageSquare size={16} className="text-[#F5C518]" />
          {t('admin.feedbackMode')}
        </h3>
        <p className="text-xs text-white/30 mb-4">{t('admin.feedbackModeDesc')}</p>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-12 h-6 rounded-full transition-all ${feedbackEnabled ? 'bg-[#F5C518]' : 'bg-white/10'}`}
              onClick={() => setFeedbackEnabled(!feedbackEnabled)}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${feedbackEnabled ? 'left-7' : 'left-1'}`} />
            </div>
            <span className={`text-sm font-bold ${feedbackEnabled ? 'text-[#F5C518]' : 'text-white/30'}`}>
              {feedbackEnabled ? t('admin.feedbackEnabled') : t('admin.feedbackDisabled')}
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSaveFeedback} disabled={savingFeedback}
            className="px-4 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2">
            {savingFeedback ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('admin.save')}
          </button>
        </div>
      </div>

      {/* Kiosk Mode Toggle */}
      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <ScanLine size={16} className="text-[#F5C518]" />
          {t('admin.kioskMode')}
        </h3>
        <p className="text-xs text-white/30 mb-4">{t('admin.kioskModeDesc')}</p>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-12 h-6 rounded-full transition-all ${kioskEnabled ? 'bg-[#F5C518]' : 'bg-white/10'}`}
              onClick={() => setKioskEnabled(!kioskEnabled)}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${kioskEnabled ? 'left-7' : 'left-1'}`} />
            </div>
            <span className={`text-sm font-bold ${kioskEnabled ? 'text-[#F5C518]' : 'text-white/30'}`}>
              {kioskEnabled ? t('admin.kioskEnabled') : t('admin.kioskDisabled')}
            </span>
          </label>
        </div>

        {!kioskEnabled && (
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-400/80 mb-4">
            {t('admin.kioskDisabledWarning')}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={handleSaveKiosk} disabled={savingKiosk}
            className="px-4 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2">
            {savingKiosk ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('admin.save')}
          </button>
        </div>
      </div>

      <div className="hive-card !rounded-2xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-5">
          <Monitor size={16} className="text-[#F5C518]" />
          {t('admin.receiptSettings')}
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.businessName')}</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t('admin.businessNamePlaceholder')}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20 transition-all"
              maxLength={100}
            />
            <p className="text-[10px] text-white/20">{t('admin.businessNameDesc')}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('admin.receiptFooter')}</label>
            <textarea
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder={t('admin.receiptFooterPlaceholder')}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20 transition-all resize-none"
              maxLength={300}
            />
            <p className="text-[10px] text-white/20">{t('admin.receiptFooterDesc')}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('settings.receiptSavePath')}</label>
            <div className="flex gap-2">
              <input
                value={receiptSavePath}
                onChange={(e) => { setReceiptSavePath(e.target.value); setPathTestResult(null) }}
                placeholder={process.platform === 'win32' ? 'C:\\Receipts' : '/home/hive/receipts'}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-[#F5C518] focus:outline-none focus:ring-1 focus:ring-[#F5C518] placeholder:text-white/20 transition-all font-mono"
                maxLength={500}
              />
              <button
                type="button"
                onClick={async () => {
                  setTestingPath(true)
                  setPathTestResult(null)
                  try {
                    const res = await fetch('/api/settings/test-receipt-path', { method: 'POST' })
                    const data = await res.json()
                    setPathTestResult(data)
                  } catch { setPathTestResult({ success: false, error: 'Request failed' }) }
                  finally { setTestingPath(false) }
                }}
                disabled={testingPath}
                className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 text-xs font-bold transition-all disabled:opacity-40 whitespace-nowrap"
              >
                {testingPath ? <Loader2 size={12} className="animate-spin" /> : t('settings.testPath')}
              </button>
            </div>
            <p className="text-[10px] text-white/20">{t('settings.receiptSavePathDesc')}</p>
            {pathTestResult && (
              <p className={`text-[10px] font-bold ${pathTestResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                {pathTestResult.success ? t('settings.pathWritable') : (pathTestResult.error || t('settings.pathNotWritable'))}
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? '...' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
