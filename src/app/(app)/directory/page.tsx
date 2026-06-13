'use client'
import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Users, Loader2, FolderOpen, Calendar, ChevronRight, ArrowUpDown, Filter, Download } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ProfileView } from '@/components/directory/ProfileView'
import { useI18n } from '@/lib/i18n'
import { PageTransition } from '@/components/animations/PageTransition'
import { AnimatedNumber } from '@/components/animations/AnimatedNumber'
import { SkeletonTable } from '@/components/animations/SkeletonRow'

interface Student {
  id: number
  fullName: string
  phone: string
  major?: string
  rfidUuid?: string
  lifetimeCheckIns: number
  createdAt: string
  subscriptions: { planType: string; isActive: boolean; expiryDate: string; startDate: string; visitsUsed: number; totalVisitsAllowed: number }[]
  transactions?: { amountPaid: number; gateway: string }[]
}

function DirectoryContent() {
  const { t } = useI18n()
  const [students, setStudents] = useState<Student[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [query, setQuery]        = useState('')
  const [loading, setLoading]    = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'checkins'>('name')
  const [filterSub, setFilterSub] = useState<'all' | 'active' | 'expired' | 'none'>('all')

  const searchParams = useSearchParams()
  const router = useRouter()
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchStudents = useCallback(async (search?: string) => {
    setLoading(true)
    try {
      const url = search ? `/api/students?search=${encodeURIComponent(search)}` : '/api/students?limit=200'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        // API returns { students, total } for paginated, or array for search
        if (Array.isArray(data)) {
          setStudents(data)
        } else {
          setStudents(data.students)
          setTotalStudents(data.total)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  useEffect(() => {
    const id = searchParams.get('student')
    if (id) setSelectedId(Number(id))
  }, [searchParams])

  useEffect(() => {
    const navId = sessionStorage.getItem('hive-navigate-to-profile')
    if (navId) {
      sessionStorage.removeItem('hive-navigate-to-profile')
      setSelectedId(Number(navId))
    }
  }, [])

  // Debounced server-side search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      fetchStudents()
      return
    }
    debounceRef.current = setTimeout(() => {
      fetchStudents(query.trim())
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, fetchStudents])

  const displayStudents = useMemo(() => {
    let list = students.filter(s => {
      if (filterSub === 'all') return true
      const sub = s.subscriptions[0]
      if (filterSub === 'none') return !sub
      if (filterSub === 'active') return sub?.isActive && new Date(sub.expiryDate) > new Date()
      if (filterSub === 'expired') return !sub?.isActive || (sub && new Date(sub.expiryDate) <= new Date())
      return true
    })
    if (sortBy === 'name') list.sort((a, b) => a.fullName.localeCompare(b.fullName))
    else if (sortBy === 'recent') list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else if (sortBy === 'checkins') list.sort((a, b) => b.lifetimeCheckIns - a.lifetimeCheckIns)
    return list
  }, [students, sortBy, filterSub])

  const handleExport = async () => {
    const XLSX = await import('xlsx')
    const rows = displayStudents.map(s => {
      const sub = s.subscriptions[0]
      const active = sub?.isActive && new Date(sub.expiryDate) > new Date()
      const tx = s.transactions?.[0]
      const fmtVisits = sub
        ? (sub.totalVisitsAllowed === -1 ? `${sub.visitsUsed} / Unlimited` : `${sub.visitsUsed} / ${sub.totalVisitsAllowed}`)
        : '-'
      return {
        'Full Name': s.fullName,
        'Phone': s.phone,
        'Major': s.major || '-',
        'Status': active ? 'Active' : sub ? 'Expired' : 'No Subscription',
        'Subscription Plan': sub?.planType || '-',
        'Start Date': sub ? new Date(sub.startDate).toLocaleDateString('en-JO') : '-',
        'Expiry Date': sub ? new Date(sub.expiryDate).toLocaleDateString('en-JO') : '-',
        'Visits': fmtVisits,
        'Amount Paid': tx ? `${tx.amountPaid} JD` : '-',
        'Payment Method': tx?.gateway || '-',
        'Total Check-ins': s.lifetimeCheckIns,
        'Registration Date': new Date(s.createdAt).toLocaleDateString('en-JO'),
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    XLSX.writeFile(wb, `HIVE-Students-${today}.xlsx`)
  }

  if (selectedId) {
    return (
      <ProfileView
        studentId={selectedId}
        onBack={() => { setSelectedId(null); router.replace('/directory') }}
      />
    )
  }

  return (
    <PageTransition>
    <div className="flex flex-col h-full p-2 md:p-8 gap-4 md:gap-8 relative">
      <motion.header
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #F5C518 0%, #D4A516 100%)', boxShadow: '0 8px 32px rgba(245, 197, 24, 0.3)' }}
              whileHover={{ scale: 1.08, rotate: 4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <FolderOpen size={28} className="text-black" strokeWidth={2} />
            </motion.div>
            <h1 className="text-2xl md:text-4xl font-black tracking-[0.2em] text-white uppercase">{t('dir.directory')}</h1>
          </div>
          <p className="text-xs font-bold text-white/30 tracking-widest uppercase ml-1">{t('dir.studentManagement')}</p>
        </div>

        <motion.div
          className="flex items-center gap-4 glass-panel px-6 py-3 rounded-2xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(245, 197, 24, 0.1)', border: '1px solid rgba(245, 197, 24, 0.2)' }}
          >
            <Users size={20} className="text-[#F5C518]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('dir.totalMembers')}</span>
            <span className="text-2xl font-black text-white leading-none"><AnimatedNumber value={totalStudents || students.length} /></span>
          </div>
        </motion.div>
      </motion.header>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="hive-glow-input flex items-center gap-3 rounded-xl px-4 md:px-5 py-3 md:py-4 flex-1">
          <Search size={20} className="text-[#F5C518] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('dir.searchPlaceholder')}
            className="flex-1 bg-transparent text-white text-base md:text-lg font-medium placeholder-white/20 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-white/30 hover:text-white p-1 bg-white/5 rounded-md transition-colors">&#10005;</button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'recent' | 'checkins')}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#F5C518] outline-none cursor-pointer shrink-0">
            <option value="name">{t('dir.sortName')}</option>
            <option value="recent">{t('dir.sortRecent')}</option>
            <option value="checkins">{t('dir.sortCheckins')}</option>
          </select>
          <select value={filterSub} onChange={e => setFilterSub(e.target.value as 'all' | 'active' | 'expired' | 'none')}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:border-[#F5C518] outline-none cursor-pointer shrink-0">
            <option value="all">{t('dir.filterAll')}</option>
            <option value="active">{t('dir.filterActive')}</option>
            <option value="expired">{t('dir.filterExpired')}</option>
            <option value="none">{t('dir.filterNoSub')}</option>
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-3 bg-[#F5C518] hover:bg-[#D5A711] text-black rounded-xl text-sm font-bold transition-all shrink-0"
          >
            <Download size={16} />
            <span className="hidden sm:inline">{t('dir.exportStudents')}</span>
          </button>
        </div>
      </div>

      <motion.div
        className="flex-1 overflow-auto rounded-2xl hive-card !p-0 relative"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        {loading ? (
          <SkeletonTable rows={6} columns={7} />
        ) : displayStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/25 gap-3">
            <Users size={48} className="opacity-20" />
            <p className="text-sm font-bold tracking-widest uppercase">
              {query ? `${t('dir.noMatching')} "${query}"` : t('dir.emptyDirectory')}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 z-10"
              style={{ background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <tr>
                <th className="px-3 md:px-5 py-4 text-[11px] font-bold text-white/30 uppercase tracking-wider">{t('dash.name')}</th>
                <th className="px-3 md:px-5 py-4 text-[11px] font-bold text-white/30 uppercase tracking-wider hidden sm:table-cell">{t('dir.phone')}</th>
                <th className="px-3 md:px-5 py-4 text-[11px] font-bold text-white/30 uppercase tracking-wider hidden lg:table-cell">{t('dir.major')}</th>
                <th className="px-3 md:px-5 py-4 text-[11px] font-bold text-white/30 uppercase tracking-wider">{t('dir.plan')}</th>
                <th className="px-3 md:px-5 py-4 text-[11px] font-bold text-white/30 uppercase tracking-wider hidden md:table-cell">{t('dir.checkIns')}</th>
                <th className="px-3 md:px-5 py-4 text-[11px] font-bold text-white/30 uppercase tracking-wider hidden lg:table-cell">{t('dir.memberSince')}</th>
                <th className="px-3 md:px-5 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {displayStudents.map((s) => {
                const sub = s.subscriptions[0]
                const active = sub?.isActive && new Date(sub.expiryDate) > new Date()

                let statusText = t('dir.expired')
                let statusColor = 'text-red-400 bg-red-500/10 border-red-500/20'

                if (active) {
                  statusText = sub.planType
                  statusColor = 'text-green-400 bg-green-500/10 border-green-500/20'
                }

                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className="hive-table-row cursor-pointer group"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-3 md:px-5 py-4">
                      <p className="font-bold text-white/90 text-sm md:text-base group-hover:text-[#F5C518] transition-colors truncate max-w-[140px] md:max-w-none">{s.fullName}</p>
                    </td>
                    <td className="px-3 md:px-5 py-4 font-medium text-white/40 hidden sm:table-cell">{s.phone}</td>
                    <td className="px-3 md:px-5 py-4 text-white/40 font-medium hidden lg:table-cell">{s.major ?? '—'}</td>
                    <td className="px-3 md:px-5 py-4">
                      {sub ? (
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${statusColor} uppercase tracking-wider`}>
                          {statusText}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold border border-white/10 text-white/30 bg-white/3 uppercase tracking-wider">
                          {t('dir.none')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 md:px-5 py-4 font-black text-[#F5C518] text-lg hidden md:table-cell">{s.lifetimeCheckIns}</td>
                    <td className="px-3 md:px-5 py-4 text-white/40 font-medium hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="opacity-50" />
                        {new Date(s.createdAt).toLocaleDateString('en-JO', { month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="px-3 md:px-5 py-4 text-right">
                      <ChevronRight size={18} className="text-white/20 group-hover:text-[#F5C518] transition-colors inline-block" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
    </PageTransition>
  )
}

export default function DirectoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-[#F5C518]" /></div>}>
      <DirectoryContent />
    </Suspense>
  )
}
