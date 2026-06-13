'use client'
import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, LogIn, X, Calendar, Clock, CreditCard, CheckCircle2, AlertTriangle, XCircle, Loader2, Megaphone, Bell, LogOut } from 'lucide-react'
import { SearchBar } from '@/components/dashboard/SearchBar'
import { TodayFeedTable } from '@/components/dashboard/TodayFeedTable'
import { AddStudentModal } from '@/components/dashboard/AddStudentModal'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { ExpiryBanner } from '@/components/dashboard/ExpiryBanner'
import { WaitlistPanel } from '@/components/dashboard/WaitlistPanel'
import { PageTransition } from '@/components/animations/PageTransition'
import { useHiveStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'

interface SelectedStudent {
  id: number
  fullName: string
  phone: string
  major: string | null
}

interface SubInfo {
  planType: string
  expiryDate: string
  visitsUsed: number
  totalVisitsAllowed: number
  isActive: boolean
}

interface Notifications {
  expiringCheckIns: { id: number; studentName: string; studentId: number | null; minutesRemaining: number }[]
  expiredSubscriptions: { studentId: number; studentName: string }[]
  autoCheckedOut: number
}

type CheckInStatus = 'idle' | 'loading' | 'success' | 'warning' | 'error'

export default function DashboardPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [logCount, setLogCount] = useState(0)
  const { setOverlay, setAddStudentOpen } = useHiveStore()
  const [userRole, setUserRole] = useState<string | null>(null)
  const { t } = useI18n()

  const [announcement, setAnnouncement] = useState('')
  const [notifications, setNotifications] = useState<Notifications | null>(null)

  // Stable callbacks to avoid infinite re-render loop in TodayFeedTable
  const handleLogsFetched = useCallback((logs: unknown[]) => setLogCount(logs.length), [])
  const handleNotifications = useCallback((n: Notifications) => setNotifications(n), [])
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUserRole(d.user.role) }).catch(() => {})
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then((s: Record<string, string>) => {
      if (s.announcement) setAnnouncement(s.announcement)
    }).catch(() => {})
  }, [])

  // Selected student for check-in
  const [selected, setSelected] = useState<SelectedStudent | null>(null)
  const [subInfo, setSubInfo] = useState<SubInfo | null>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>('idle')
  const [checkInMsg, setCheckInMsg] = useState('')

  // F2 shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setAddStudentOpen(true)
      }
      if (e.key === 'Escape' && selected) {
        setSelected(null)
        setSubInfo(null)
        setCheckInStatus('idle')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setAddStudentOpen, selected])

  // When a student is selected, fetch their subscription info
  const handleSelect = useCallback(async (student: SelectedStudent) => {
    setSelected(student)
    setCheckInStatus('idle')
    setCheckInMsg('')
    setSubLoading(true)
    setSubInfo(null)

    try {
      const res = await fetch(`/api/students/${student.id}`)
      if (res.ok) {
        const data = await res.json()
        const activeSub = data.subscriptions?.find((s: { isActive: boolean }) => s.isActive)
        if (activeSub) {
          setSubInfo(activeSub)
        } else {
          setSubInfo(null)
        }
      }
    } catch {
      // fail silently
    } finally {
      setSubLoading(false)
    }
  }, [])

  // Check-in handler
  const handleCheckIn = useCallback(async () => {
    if (!selected) return
    setCheckInStatus('loading')

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selected.id }),
      })
      const data = await res.json()
      setOverlay(data)

      if (res.ok && (data.status === 'OK' || data.status === 'ALREADY_IN')) {
        if (data.status === 'ALREADY_IN') {
          setCheckInStatus('warning')
          setCheckInMsg(t('dash.alreadyCheckedIn'))
        } else {
          let visitsLeft = data.remainingVisits
          let daysLeft = 999
          if (data.subscription?.expiryDate) {
            daysLeft = Math.ceil((new Date(data.subscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          }

          if ((visitsLeft !== null && visitsLeft !== undefined && visitsLeft <= 2) || daysLeft <= 2) {
            setCheckInStatus('warning')
            setCheckInMsg(`${t('dash.checkedInSuccess')} (${visitsLeft !== null ? visitsLeft + ' ' + t('dash.visitsLeft') : daysLeft + ' ' + t('dash.daysLeft')})`)
          } else {
            setCheckInStatus('success')
            setCheckInMsg(t('dash.checkedInSuccess'))
          }
        }
        setRefreshTrigger((n) => n + 1)

        // Update sub info
        if (data.subscription) {
          setSubInfo(data.subscription)
        }
      } else {
        setCheckInStatus('error')
        setCheckInMsg(data.reason || t('dash.checkInFailed'))
      }
    } catch {
      setCheckInStatus('error')
      setCheckInMsg(t('dash.connectionError'))
    }
  }, [selected, setOverlay, t])

  // Quick checkout from notification
  const handleQuickCheckout = async (logId: number) => {
    try {
      await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      })
      setRefreshTrigger(n => n + 1)
    } catch {}
  }

  // Subscription status helpers
  function getSubStatus(sub: SubInfo | null): { label: string; color: string; daysLeft: number | null; visitsLeft: number | null } {
    if (!sub) return { label: t('dash.noSubscription'), color: 'red', daysLeft: null, visitsLeft: null }
    const now = new Date()
    const expiry = new Date(sub.expiryDate)
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const visitsLeft = sub.totalVisitsAllowed === -1 ? null : sub.totalVisitsAllowed - sub.visitsUsed

    if (!sub.isActive) return { label: t('dash.inactive'), color: 'red', daysLeft, visitsLeft }
    if (daysLeft <= 0) return { label: t('dash.expired'), color: 'red', daysLeft: 0, visitsLeft }
    if (visitsLeft !== null && visitsLeft <= 0) return { label: t('dash.visitsUsedUp'), color: 'red', daysLeft, visitsLeft: 0 }
    if (daysLeft <= 2 || (visitsLeft !== null && visitsLeft <= 2)) return { label: t('dash.expiringSoon'), color: 'yellow', daysLeft, visitsLeft }
    return { label: t('dash.active'), color: 'green', daysLeft, visitsLeft }
  }

  const subStatus = getSubStatus(subInfo)

  // Filter undismissed notifications
  const expiringAlerts = notifications?.expiringCheckIns?.filter(n => !dismissedNotifications.has(`expiring-${n.id}`)) || []
  const subEndedAlerts = notifications?.expiredSubscriptions?.filter(n => !dismissedNotifications.has(`subended-${n.studentId}`)) || []

  return (
    <PageTransition>
    <div className="flex flex-col gap-6 flex-grow" id="hive-checkin-dashboard">

      {/* 1. Brand Header */}
      <motion.section
        className="flex flex-col items-center justify-center text-center py-3 md:py-5 select-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.svg
            viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
            className="w-10 h-10 text-[#F5C518]"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </motion.svg>
        </div>
        <p className="text-white/30 text-xs font-mono max-w-sm leading-relaxed mt-2 text-center">
          {t('dash.gateAccess')}
        </p>
      </motion.section>

      {/* Analytics Cards */}
      <DashboardStats checkInCount={logCount} />

      {/* Announcement Banner */}
      {announcement && (
        <motion.div
          className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl"
          style={{ background: 'rgba(245, 197, 24, 0.08)', border: '1px solid rgba(245, 197, 24, 0.15)' }}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Megaphone size={18} className="text-[#F5C518] shrink-0" />
          <p className="text-sm font-medium text-[#F5C518]/80 flex-1">{announcement}</p>
          <button onClick={() => setAnnouncement('')} className="text-white/20 hover:text-white/40 p-1">
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* 24h Window Notifications (Rule 5 & 6) */}
      <AnimatePresence>
        {expiringAlerts.length > 0 && (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {expiringAlerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-3 px-5 py-3 rounded-xl"
                style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
              >
                <Bell size={16} className="text-amber-400 shrink-0 animate-pulse" />
                <p className="text-sm font-medium text-amber-300 flex-1">
                  <span className="font-bold">{alert.studentName}</span> — {t('dash.windowEndsIn').replace('{min}', String(alert.minutesRemaining))}
                </p>
                <button
                  onClick={() => handleQuickCheckout(alert.id)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-all flex items-center gap-1"
                >
                  <LogOut size={12} /> {t('dash.checkOut')}
                </button>
                <button
                  onClick={() => setDismissedNotifications(prev => new Set([...prev, `expiring-${alert.id}`]))}
                  className="text-white/20 hover:text-white/40 p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {subEndedAlerts.length > 0 && (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {subEndedAlerts.map(alert => (
              <div key={alert.studentId} className="flex items-center gap-3 px-5 py-3 rounded-xl"
                style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                <XCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm font-medium text-red-300 flex-1">
                  <span className="font-bold">{alert.studentName}</span> — {t('dash.subEnded')}
                </p>
                <button
                  onClick={() => setDismissedNotifications(prev => new Set([...prev, `subended-${alert.studentId}`]))}
                  className="text-white/20 hover:text-white/40 p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expiry Notifications */}
      <ExpiryBanner />

      {/* 2. Search & Add Student Rail */}
      <motion.section
        className="flex flex-col md:flex-row gap-3 items-stretch relative max-w-4xl w-full mx-auto"
        id="desk-access-controls"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative flex-grow">
          <SearchBar onSelect={handleSelect} />
        </div>

        <motion.button
          onClick={() => setAddStudentOpen(true)}
          className="hive-btn text-[#121212] font-black tracking-tight rounded-xl px-6 py-3.5 text-xs font-mono uppercase flex items-center justify-center gap-2 select-none"
          title="F2: Register a new student on the system"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <UserPlus className="w-4 h-4 text-black shrink-0" />
          <span>{t('dash.addStudent')}</span>
          <span className="bg-black/10 text-[10px] px-1 rounded border border-black/5 leading-none">F2</span>
        </motion.button>
      </motion.section>

      {/* 3. Selected Student Check-In Card */}
      <AnimatePresence>
      {selected && (
        <motion.section
          className="max-w-4xl w-full mx-auto"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="bg-[#1A1A1A] border-2 border-[#2C2C2C] rounded-2xl p-5 relative shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_60px_rgba(245,197,24,0.05)] hover:border-[#F5C518]/30 transition-all duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Student avatar + info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F5C518] to-[#D4A516] flex items-center justify-center flex-shrink-0">
                  <span className="text-black font-bold text-base">
                    {selected.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-lg truncate">{selected.fullName}</h3>
                  <p className="text-xs text-white/30 font-mono">
                    {selected.phone}{selected.major ? ` · ${selected.major}` : ''}
                  </p>
                </div>
              </div>

              {/* Subscription badges */}
              <div className="flex flex-wrap items-center gap-2">
                {subLoading ? (
                  <span className="text-xs text-white/30 flex items-center gap-1">
                    <Loader2 size={14} className="animate-spin" /> {t('common.loading')}
                  </span>
                ) : (
                  <>
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      subStatus.color === 'green' ? 'bg-green-500/20 text-green-400' :
                      subStatus.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        subStatus.color === 'green' ? 'bg-green-400' :
                        subStatus.color === 'yellow' ? 'bg-yellow-400' :
                        'bg-red-400'
                      }`} />
                      {subStatus.label}
                    </span>

                    {/* Plan type */}
                    {subInfo && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/25">
                        <CreditCard size={12} />
                        {subInfo.planType}
                      </span>
                    )}

                    {/* Days left */}
                    {subStatus.daysLeft !== null && subStatus.daysLeft > 0 && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        subStatus.daysLeft <= 2 ? 'bg-red-500/10 text-red-400' :
                        subStatus.daysLeft <= 5 ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-blue-500/10 text-blue-400'
                      }`}>
                        <Calendar size={12} />
                        {subStatus.daysLeft} {subStatus.daysLeft === 1 ? t('dash.dayLeft') : t('dash.daysLeft')}
                      </span>
                    )}

                    {/* Visits left */}
                    {subStatus.visitsLeft !== null && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        subStatus.visitsLeft <= 2 ? 'bg-red-500/10 text-red-400' :
                        subStatus.visitsLeft <= 4 ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        <Clock size={12} />
                        {subStatus.visitsLeft} {subStatus.visitsLeft === 1 ? t('dash.visitLeft') : t('dash.visitsLeft')}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Check-In button */}
              <button
                onClick={handleCheckIn}
                disabled={checkInStatus === 'loading' || subStatus.color === 'red'}
                className={`flex-shrink-0 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
                  checkInStatus === 'loading'
                    ? 'bg-white/10 text-white/25 cursor-wait'
                    : subStatus.color === 'red'
                    ? 'bg-red-500/10 text-red-400 cursor-not-allowed border border-red-500/20'
                    : 'bg-[#F5C518] text-black hover:bg-[#D5A711] hover:shadow-lg active:scale-95'
                }`}
              >
                {checkInStatus === 'loading' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : subStatus.color === 'red' ? (
                  <>
                    <XCircle size={16} />
                    {t('dash.expired')}
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    {t('dash.checkIn')}
                  </>
                )}
              </button>

              {/* Close button */}
              <button
                onClick={() => { setSelected(null); setSubInfo(null); setCheckInStatus('idle') }}
                className="flex-shrink-0 p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Check-in result message */}
            <AnimatePresence>
            {checkInStatus !== 'idle' && checkInStatus !== 'loading' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={`mt-4 flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg ${
                  checkInStatus === 'success' ? 'bg-green-500/10 text-green-400' :
                  checkInStatus === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-red-500/10 text-red-400'
                }`}
              >
                {checkInStatus === 'success' && <CheckCircle2 size={16} />}
                {checkInStatus === 'warning' && <AlertTriangle size={16} />}
                {checkInStatus === 'error' && <XCircle size={16} />}
                <span>{checkInMsg}</span>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </motion.section>
      )}
      </AnimatePresence>

      {/* 4. Today's Feed Log Table */}
      <motion.section
        className="flex-grow flex flex-col pt-3 rounded-xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <TodayFeedTable
          refreshTrigger={refreshTrigger}
          onLogsFetched={handleLogsFetched}
          onNotifications={handleNotifications}
          userRole={userRole}
        />
      </motion.section>

      {/* Waitlist Panel — shows when capacity is full */}
      <WaitlistPanel refreshTrigger={refreshTrigger} />

      <AddStudentModal onCreated={() => setRefreshTrigger((n) => n + 1)} />

    </div>
    </PageTransition>
  )
}
