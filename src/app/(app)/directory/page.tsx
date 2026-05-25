'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Users, Loader2, FolderOpen, Calendar, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ProfileView } from '@/components/directory/ProfileView'
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
  subscriptions: { planType: string; isActive: boolean; expiryDate: string }[]
}

function DirectoryContent() {
  const [students, setStudents] = useState<Student[]>([])
  const [filtered, setFiltered]  = useState<Student[]>([])
  const [query, setQuery]        = useState('')
  const [loading, setLoading]    = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/students')
      if (res.ok) {
        const data = await res.json()
        setStudents(data)
        setFiltered(data)
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

  useEffect(() => {
    if (!query.trim()) { setFiltered(students); return }
    const q = query.toLowerCase()
    setFiltered(students.filter(
      (s) => s.fullName.toLowerCase().includes(q) || s.phone.includes(q) || s.major?.toLowerCase().includes(q)
    ))
  }, [query, students])

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
    <div className="flex flex-col h-full p-8 gap-8 relative">
      <motion.header
        className="flex items-center justify-between pt-2"
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
            <h1 className="text-4xl font-black tracking-[0.2em] text-white uppercase">Directory</h1>
          </div>
          <p className="text-xs font-bold text-white/30 tracking-widest uppercase ml-1">Student Management</p>
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
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Total Members</span>
            <span className="text-2xl font-black text-white leading-none"><AnimatedNumber value={students.length} /></span>
          </div>
        </motion.div>
      </motion.header>

      <div className="hive-glow-input flex items-center gap-3 rounded-xl px-5 py-4">
        <Search size={20} className="text-[#F5C518] shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or major..."
          className="flex-1 bg-transparent text-white text-lg font-medium placeholder-white/20 outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-white/30 hover:text-white p-1 bg-white/5 rounded-md transition-colors">&#10005;</button>
        )}
      </div>

      <motion.div
        className="flex-1 overflow-auto rounded-2xl hive-card !p-0 relative"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        {loading ? (
          <SkeletonTable rows={6} columns={7} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/25 gap-3">
            <Users size={48} className="opacity-20" />
            <p className="text-sm font-bold tracking-widest uppercase">
              {query ? `No students matching "${query}"` : 'Directory is empty'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 z-10"
              style={{ background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <tr>
                {['Name', 'Phone', 'Major', 'Plan', 'Check-Ins', 'Member Since', ''].map((h) => (
                  <th key={h} className="px-5 py-4 text-[11px] font-bold text-white/30 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const sub = s.subscriptions[0]
                const active = sub?.isActive && new Date(sub.expiryDate) > new Date()

                let statusText = 'EXPIRED'
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
                    <td className="px-5 py-4">
                      <p className="font-bold text-white/90 text-base group-hover:text-[#F5C518] transition-colors">{s.fullName}</p>
                    </td>
                    <td className="px-5 py-4 font-medium text-white/40">{s.phone}</td>
                    <td className="px-5 py-4 text-white/40 font-medium">{s.major ?? '—'}</td>
                    <td className="px-5 py-4">
                      {sub ? (
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${statusColor} uppercase tracking-wider`}>
                          {statusText}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold border border-white/10 text-white/30 bg-white/3 uppercase tracking-wider">
                          None
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-black text-[#F5C518] text-lg">{s.lifetimeCheckIns}</td>
                    <td className="px-5 py-4 text-white/40 font-medium flex items-center gap-2 mt-1">
                      <Calendar size={14} className="opacity-50" />
                      {new Date(s.createdAt).toLocaleDateString('en-JO', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-right">
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
