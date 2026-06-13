'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScanLine, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Search, User, CreditCard, Loader2, Globe, QrCode, Camera } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

type ScanStatus = 'idle' | 'scanning' | 'success' | 'warning' | 'error'
type TabMode = 'rfid' | 'search' | 'qr'

// Shape returned by the public /api/checkin/search endpoint (minimal by design —
// the kiosk is unauthenticated, so no phone/PII/subscription internals are exposed)
interface StudentResult {
  id: number
  fullName: string
  photoUrl: string | null
  hasActiveSubscription: boolean
  planType: string | null
}

export default function CheckInPage() {
  const { t, lang, setLang, dir } = useI18n()

  // --- Kiosk enabled check ---
  const [kioskDisabled, setKioskDisabled] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/settings/public')
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, string>) => {
        setKioskDisabled(s.kioskEnabled !== 'true')
      })
      .catch(() => setKioskDisabled(false)) // default allow on error
  }, [])

  // --- RFID state ---
  const [rfid, setRfid] = useState('')
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [message, setMessage] = useState('')
  const [subMessage, setSubMessage] = useState('')
  const [studentName, setStudentName] = useState('')

  // Initialize messages after i18n is ready
  useEffect(() => {
    if (status === 'idle' && !message) {
      setMessage(t('kiosk.readyToScan'))
      setSubMessage(t('kiosk.tapCard'))
    }
  }, [t, status, message])

  // --- Tab state ---
  const [tab, setTab] = useState<TabMode>('search')

  // Show disabled message if kiosk is off
  if (kioskDisabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0A' }}>
        <Loader2 className="w-8 h-8 text-[#F5C518] animate-spin" />
      </div>
    )
  }

  if (kioskDisabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6" style={{ background: '#0A0A0A' }}>
        <ScanLine className="w-16 h-16 text-white/20" />
        <h1 className="text-xl font-bold text-white/60">{t('admin.kioskDisabledTitle')}</h1>
        <p className="text-white/30 text-sm max-w-md">{t('admin.kioskDisabledMsg')}</p>
      </div>
    )
  }

  // --- Search state ---
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentResult[]>([])
  const [searching, setSearching] = useState(false)
  const [checkinLoading, setCheckinLoading] = useState<number | null>(null)
  const [checkinResult, setCheckinResult] = useState<{ studentId: number; status: ScanStatus; msg: string; sub: string } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-reset kiosk after 60 seconds of inactivity in search tab
  useEffect(() => {
    if (tab !== 'search' || !query) return
    const timer = setTimeout(() => {
      setQuery('')
      setResults([])
      setCheckinResult(null)
    }, 60_000)
    return () => clearTimeout(timer)
  }, [tab, query, checkinResult])

  // Keep RFID input focused in RFID mode
  useEffect(() => {
    if (tab !== 'rfid') return
    const focusInput = () => inputRef.current?.focus()
    focusInput()
    document.addEventListener('click', focusInput)
    return () => document.removeEventListener('click', focusInput)
  }, [tab])

  // Focus search input when switching to search tab
  useEffect(() => {
    if (tab === 'search') {
      setTimeout(() => searchRef.current?.focus(), 100)
    }
  }, [tab])

  // --- Search logic with debounce ---
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/checkin/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchChange = (val: string) => {
    setQuery(val)
    setCheckinResult(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => doSearch(val), 300)
  }

  // --- Manual check-in ---
  const handleManualCheckin = async (student: StudentResult) => {
    setCheckinLoading(student.id)
    setCheckinResult(null)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      })
      const data = await res.json()

      if (res.ok && data.status === 'OK') {
        let visitsLeft = data.remainingVisits
        let daysLeft = 999
        if (data.subscription?.expiryDate) {
          daysLeft = Math.ceil((new Date(data.subscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }

        if ((visitsLeft !== null && visitsLeft !== undefined && visitsLeft <= 2) || daysLeft <= 2) {
          const leftStr = visitsLeft !== null
            ? `${visitsLeft} ${t('kiosk.visits')}`
            : `${daysLeft} ${t('kiosk.days')}`
          setCheckinResult({
            studentId: student.id,
            status: 'warning',
            msg: t('kiosk.checkedIn'),
            sub: `⚠ ${t('kiosk.expiringSoon')} (${leftStr})`,
          })
        } else {
          setCheckinResult({
            studentId: student.id,
            status: 'success',
            msg: data.alreadyCheckedInToday ? t('kiosk.alreadyCheckedIn') : t('kiosk.checkedInSuccess'),
            sub: data.alreadyCheckedInToday ? t('kiosk.welcomeBack') : t('kiosk.welcomeToHive'),
          })
        }
      } else {
        setCheckinResult({
          studentId: student.id,
          status: 'error',
          msg: t('kiosk.checkInFailed'),
          sub: data.reason || t('kiosk.subExpiredInactive'),
        })
      }
    } catch {
      setCheckinResult({
        studentId: student.id,
        status: 'error',
        msg: t('kiosk.error'),
        sub: t('kiosk.connectionErrorShort'),
      })
    } finally {
      setCheckinLoading(null)
      // re-fetch results to update subscription info
      if (query.length >= 2) {
        setTimeout(() => doSearch(query), 500)
      }
    }
  }

  // --- RFID scan handler ---
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rfid.trim() || status === 'scanning') return
    const scannedUuid = rfid.trim()
    setRfid('')
    setStatus('scanning')
    setMessage(t('kiosk.verifying'))
    setSubMessage(t('kiosk.connecting'))

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfidUuid: scannedUuid }),
      })
      const data = await res.json()

      if (res.ok && data.status === 'OK') {
        setStudentName(data.student.fullName)
        let visitsLeft = data.remainingVisits
        let daysLeft = 999
        if (data.subscription?.expiryDate) {
          daysLeft = Math.ceil((new Date(data.subscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }
        if ((visitsLeft !== null && visitsLeft !== undefined && visitsLeft <= 2) || daysLeft <= 2) {
          const leftStr = visitsLeft !== null
            ? `${visitsLeft} ${t('kiosk.visits')}`
            : `${daysLeft} ${t('kiosk.days')}`
          setStatus('warning')
          setMessage(t('kiosk.checkInSuccessful'))
          setSubMessage(`${t('kiosk.warningExpiring')} (${leftStr})`)
        } else {
          setStatus('success')
          setMessage(t('kiosk.checkInSuccessful'))
          setSubMessage(data.alreadyCheckedInToday ? t('kiosk.welcomeBackAlready') : t('kiosk.welcomeToHive'))
        }
      } else {
        setStatus('error')
        setStudentName('')
        setMessage(t('kiosk.accessDenied'))
        setSubMessage(data.reason || t('kiosk.cardNotRecognized'))
      }
    } catch {
      setStatus('error')
      setStudentName('')
      setMessage(t('kiosk.systemError'))
      setSubMessage(t('kiosk.connectionError'))
    }

    setTimeout(() => {
      setStatus('idle')
      setMessage(t('kiosk.readyToScan'))
      setSubMessage(t('kiosk.tapCard'))
      setStudentName('')
    }, 4000)
  }

  // --- QR state ---
  const [qrStatus, setQrStatus] = useState<'idle' | 'scanning' | 'success' | 'warning' | 'error'>('idle')
  const [qrMessage, setQrMessage] = useState('')
  const [qrSubMessage, setQrSubMessage] = useState('')
  const [qrStudentName, setQrStudentName] = useState('')
  const [qrCameraError, setQrCameraError] = useState(false)
  const qrScannerRef = useRef<any>(null)
  const qrContainerRef = useRef<HTMLDivElement>(null)
  const qrProcessingRef = useRef(false)

  useEffect(() => {
    if (tab !== 'qr') {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {})
        qrScannerRef.current = null
      }
      return
    }

    let cancelled = false

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return

        const scanner = new Html5Qrcode('qr-reader')
        qrScannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText: string) => {
            if (qrProcessingRef.current) return
            qrProcessingRef.current = true

            setQrStatus('scanning')
            setQrMessage(t('kiosk.verifying'))
            setQrSubMessage(t('kiosk.connecting'))

            try {
              const res = await fetch('/api/checkin/qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: decodedText }),
              })
              const data = await res.json()

              if (res.ok && (data.status === 'OK' || data.status === 'ALREADY_IN')) {
                setQrStudentName(data.student?.fullName || '')
                let visitsLeft = data.remainingVisits
                let daysLeft = 999
                if (data.subscription?.expiryDate) {
                  daysLeft = Math.ceil((new Date(data.subscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                }
                if ((visitsLeft !== null && visitsLeft !== undefined && visitsLeft <= 2) || daysLeft <= 2) {
                  const leftStr = visitsLeft !== null
                    ? `${visitsLeft} ${t('kiosk.visits')}`
                    : `${daysLeft} ${t('kiosk.days')}`
                  setQrStatus('warning')
                  setQrMessage(t('kiosk.checkInSuccessful'))
                  setQrSubMessage(`${t('kiosk.warningExpiring')} (${leftStr})`)
                } else {
                  setQrStatus('success')
                  setQrMessage(t('kiosk.checkInSuccessful'))
                  setQrSubMessage(data.alreadyCheckedInToday ? t('kiosk.welcomeBackAlready') : t('kiosk.welcomeToHive'))
                }
              } else {
                setQrStatus('error')
                setQrStudentName('')
                setQrMessage(t('kiosk.accessDenied'))
                setQrSubMessage(data.reason || t('kiosk.cardNotRecognized'))
              }
            } catch {
              setQrStatus('error')
              setQrStudentName('')
              setQrMessage(t('kiosk.systemError'))
              setQrSubMessage(t('kiosk.connectionError'))
            }

            setTimeout(() => {
              setQrStatus('idle')
              setQrMessage('')
              setQrSubMessage('')
              setQrStudentName('')
              qrProcessingRef.current = false
            }, 4000)
          },
          () => {},
        )

        setQrCameraError(false)
      } catch {
        if (!cancelled) setQrCameraError(true)
      }
    }

    startScanner()

    return () => {
      cancelled = true
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {})
        qrScannerRef.current = null
      }
    }
  }, [tab, t])

  // --- Helpers ---
  function getSubStatus(student: StudentResult): { label: string; color: string; planType: string | null } {
    if (!student.hasActiveSubscription) return { label: t('kiosk.noSubscription'), color: 'red', planType: null }
    return { label: t('kiosk.active'), color: 'green', planType: student.planType }
  }

  return (
    <div dir={dir} className="flex flex-col items-center justify-center min-h-screen bg-[#FDFCF8] text-[#171717] relative overflow-hidden honeycomb-bg">
      {/* Hidden RFID Input (always present) */}
      {tab === 'rfid' && (
        <form onSubmit={handleScan} className="opacity-0 absolute top-0 left-0 w-1 h-1 overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={rfid}
            onChange={(e) => setRfid(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </form>
      )}

      {/* Back to Dashboard */}
      <Link href="/" className={`absolute top-6 ${dir === 'rtl' ? 'right-6' : 'left-6'} p-3 text-[#A1A1AA] hover:text-[#171717] transition-colors rounded-full hover:bg-white/50 backdrop-blur-sm z-50`}>
        <ArrowLeft size={24} className={dir === 'rtl' ? 'rotate-180' : ''} />
      </Link>

      {/* HIVE branding */}
      <div className={`absolute top-6 ${dir === 'rtl' ? 'left-8' : 'right-8'} flex items-center gap-2.5 text-[#A1A1AA]`}>
        <img src="/logo.png" alt="HIVE" className="w-12 h-12 object-contain" />
        <span className="text-sm font-semibold tracking-wider">{t('kiosk.hiveCheckIn')}</span>
      </div>

      {/* Language Toggle */}
      <button
        onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
        className={`absolute top-6 ${dir === 'rtl' ? 'right-56' : 'left-20'} p-2.5 text-[#A1A1AA] hover:text-[#171717] transition-colors rounded-full hover:bg-white/50 backdrop-blur-sm z-50 flex items-center gap-1.5`}
        title={lang === 'en' ? 'العربية' : 'English'}
      >
        <Globe size={18} />
        <span className="text-xs font-semibold">{lang === 'en' ? 'عربي' : 'EN'}</span>
      </button>

      {/* Tab Switcher */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex bg-white/70 backdrop-blur-md rounded-2xl p-1.5 shadow-lg border border-white/40 z-50">
        <button
          onClick={() => setTab('search')}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
            tab === 'search'
              ? 'bg-[#F5C518] text-black shadow-md'
              : 'text-[#737373] hover:text-[#171717] hover:bg-white/50'
          }`}
        >
          <Search size={16} />
          {t('kiosk.search')}
        </button>
        <button
          onClick={() => setTab('qr')}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
            tab === 'qr'
              ? 'bg-[#F5C518] text-black shadow-md'
              : 'text-[#737373] hover:text-[#171717] hover:bg-white/50'
          }`}
        >
          <QrCode size={16} />
          {t('kiosk.qrScan')}
        </button>
        <button
          onClick={() => setTab('rfid')}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
            tab === 'rfid'
              ? 'bg-[#F5C518] text-black shadow-md'
              : 'text-[#737373] hover:text-[#171717] hover:bg-white/50'
          }`}
        >
          <ScanLine size={16} />
          {t('kiosk.rfidScan')}
        </button>
      </div>

      {/* ============== SEARCH TAB ============== */}
      {tab === 'search' && (
        <div className="w-full max-w-2xl px-6 flex flex-col items-center mt-20" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {/* Search Bar */}
          <div className="w-full relative mb-6">
            <div className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-[#A1A1AA]`}>
              <Search size={22} />
            </div>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('kiosk.searchPlaceholder')}
              autoComplete="off"
              className={`w-full ${dir === 'rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 text-lg rounded-2xl bg-white/80 backdrop-blur-md border-2 border-white/40 shadow-lg focus:outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_4px_rgba(245,197,24,0.15)] transition-all duration-300 placeholder:text-[#A1A1AA]`}
            />
            {searching && (
              <div className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2`}>
                <Loader2 size={20} className="text-[#F5C518] animate-spin" />
              </div>
            )}
          </div>

          {/* Results */}
          <div className="w-full space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 pb-8" style={{ scrollbarWidth: 'thin' }}>
            {query.length >= 2 && !searching && results.length === 0 && (
              <div className="text-center py-12 text-[#A1A1AA]">
                <User size={48} className="mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium">{t('kiosk.noStudentsFound')}</p>
                <p className="text-sm">{t('kiosk.tryDifferent')}</p>
              </div>
            )}

            {results.map((student, index) => {
              const sub = getSubStatus(student)
              const result = checkinResult?.studentId === student.id ? checkinResult : null
              const isLoading = checkinLoading === student.id

              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.3 }}
                  className={`glass-panel rounded-2xl p-5 transition-all duration-300 hover:shadow-lg ${
                    result?.status === 'success' ? 'ring-2 ring-green-400/50 bg-green-50/30' :
                    result?.status === 'warning' ? 'ring-2 ring-yellow-400/50 bg-yellow-50/30' :
                    result?.status === 'error' ? 'ring-2 ring-red-400/50 bg-red-50/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Student Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {student.photoUrl ? (
                          <img src={student.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F5C518] to-[#D4A516] flex items-center justify-center flex-shrink-0">
                            <span className="text-black font-bold text-sm">
                              {student.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-bold text-[#171717] text-lg truncate">{student.fullName}</h3>
                        </div>
                      </div>

                      {/* Subscription Status Bar */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {/* Status Badge */}
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          sub.color === 'green' ? 'bg-green-100 text-green-700' :
                          sub.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            sub.color === 'green' ? 'bg-green-500' :
                            sub.color === 'yellow' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`} />
                          {sub.label}
                        </span>

                        {/* Plan Type */}
                        {sub.planType && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F5F5F5] text-[#525252]">
                            <CreditCard size={12} />
                            {sub.planType}
                          </span>
                        )}

                      </div>

                      {/* Check-in result message */}
                      <AnimatePresence>
                      {result && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`mt-3 flex items-center gap-2 text-sm font-semibold ${
                            result.status === 'success' ? 'text-green-600' :
                            result.status === 'warning' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                          {result.status === 'success' && <CheckCircle2 size={16} />}
                          {result.status === 'warning' && <AlertTriangle size={16} />}
                          {result.status === 'error' && <XCircle size={16} />}
                          <span>{result.msg} — {result.sub}</span>
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </div>

                    {/* Check-In Button */}
                    <button
                      onClick={() => handleManualCheckin(student)}
                      disabled={isLoading || sub.color === 'red'}
                      className={`flex-shrink-0 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${
                        isLoading
                          ? 'bg-gray-100 text-gray-400 cursor-wait'
                          : sub.color === 'red'
                          ? 'bg-red-50 text-red-300 cursor-not-allowed'
                          : 'bg-[#F5C518] text-black hover:bg-[#D4A516] hover:shadow-md active:scale-95'
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : sub.color === 'red' ? (
                        t('kiosk.expired')
                      ) : (
                        t('kiosk.checkIn')
                      )}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Empty state when no query */}
          {query.length < 2 && (
            <div className="text-center py-16 text-[#A1A1AA]" style={{ animation: 'fadeIn 0.5s ease-out' }}>
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-yellow-50 flex items-center justify-center border-2 border-yellow-100">
                <Search size={40} className="text-[#F5C518]" />
              </div>
              <p className="text-2xl font-bold text-[#525252] mb-2">{t('kiosk.manualCheckIn')}</p>
              <p className="text-base">{t('kiosk.typeToFind')}</p>
            </div>
          )}
        </div>
      )}

      {/* ============== QR TAB ============== */}
      {tab === 'qr' && (
        <div className="w-full max-w-xl flex flex-col items-center mt-20 px-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {qrCameraError ? (
            <div className="glass-panel rounded-[32px] p-16 flex flex-col items-center text-center">
              <div className="w-32 h-32 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-200 mb-8">
                <Camera size={60} className="text-red-400" />
              </div>
              <h2 className="text-3xl font-black text-[#171717] mb-3">{t('kiosk.cameraError')}</h2>
              <p className="text-lg text-[#737373]">{t('kiosk.cameraPermission')}</p>
            </div>
          ) : qrStatus !== 'idle' ? (
            <motion.div
              className="glass-panel w-full p-16 rounded-[32px] flex flex-col items-center text-center shadow-xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1.03 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={qrStatus}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {qrStatus === 'scanning' && (
                      <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center border-4 border-gray-200">
                        <div className="w-14 h-14 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {qrStatus === 'success' && (
                      <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-200">
                        <CheckCircle2 size={64} className="text-[#16A34A]" />
                      </div>
                    )}
                    {qrStatus === 'warning' && (
                      <div className="w-32 h-32 bg-yellow-50 rounded-full flex items-center justify-center border-4 border-yellow-200 shadow-[0_0_40px_rgba(245,197,24,0.4)]">
                        <AlertTriangle size={64} className="text-[#F5C518]" />
                      </div>
                    )}
                    {qrStatus === 'error' && (
                      <div className="w-32 h-32 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-200 shadow-[0_0_40px_rgba(220,38,38,0.4)]">
                        <XCircle size={64} className="text-[#DC2626]" />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
              <motion.h1
                key={qrMessage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-4xl font-black tracking-tight mb-4
                  ${qrStatus === 'error' ? 'text-[#DC2626]' : ''}
                  ${qrStatus === 'warning' ? 'text-[#F5C518]' : ''}
                  ${qrStatus === 'success' ? 'text-[#16A34A]' : ''}
                  ${qrStatus === 'scanning' ? 'text-[#171717]' : ''}
                `}
              >
                {qrMessage}
              </motion.h1>
              {qrStudentName && (
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold text-[#171717] mb-2"
                >
                  {qrStudentName}
                </motion.h2>
              )}
              <p className="text-lg font-medium text-[#737373]">{qrSubMessage}</p>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="glass-panel rounded-[32px] p-8 shadow-xl mb-8">
                <div id="qr-reader" ref={qrContainerRef} className="w-[320px] h-[320px] rounded-2xl overflow-hidden" />
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-yellow-50 flex items-center justify-center border-2 border-yellow-100">
                  <QrCode size={36} className="text-[#F5C518]" />
                </div>
                <h2 className="text-2xl font-black text-[#525252] mb-2">{t('kiosk.qrCheckInTitle')}</h2>
                <p className="text-base text-[#A1A1AA]">{t('kiosk.qrCheckInDesc')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============== RFID TAB ============== */}
      {tab === 'rfid' && (
        <motion.div
          className={`glass-panel w-full max-w-3xl p-16 rounded-[32px] flex flex-col items-center text-center shadow-xl`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: status !== 'idle' ? 1.03 : 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >

          {/* Status Icon */}
          <div className="mb-10 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={status}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {status === 'idle' && (
                  <div className="w-40 h-40 bg-yellow-50 rounded-full flex items-center justify-center border-4 border-yellow-100">
                    <ScanLine size={80} className="text-[#F5C518] animate-pulse" />
                  </div>
                )}
                {status === 'scanning' && (
                  <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center border-4 border-gray-200">
                    <div className="w-16 h-16 border-4 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {status === 'success' && (
                  <div className="w-40 h-40 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-200">
                    <CheckCircle2 size={80} className="text-[#16A34A]" />
                  </div>
                )}
                {status === 'warning' && (
                  <div className="w-40 h-40 bg-yellow-50 rounded-full flex items-center justify-center border-4 border-yellow-200 shadow-[0_0_40px_rgba(245,197,24,0.4)]">
                    <AlertTriangle size={80} className="text-[#F5C518]" />
                  </div>
                )}
                {status === 'error' && (
                  <div className="w-40 h-40 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-200 shadow-[0_0_40px_rgba(220,38,38,0.4)]">
                    <XCircle size={80} className="text-[#DC2626]" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Text Content */}
          <motion.h1
            key={message}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`text-6xl font-black tracking-tight mb-4
              ${status === 'error' ? 'text-[#DC2626]' : ''}
              ${status === 'warning' ? 'text-[#F5C518]' : ''}
              ${status === 'success' ? 'text-[#16A34A]' : ''}
              ${status === 'idle' ? 'text-[#171717]' : ''}
            `}
          >
            {message}
          </motion.h1>

          <AnimatePresence>
            {studentName && (
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-3xl font-bold text-[#171717] mb-2"
              >
                {studentName}
              </motion.h2>
            )}
          </AnimatePresence>

          <motion.p
            key={subMessage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xl font-medium text-[#737373] max-w-xl leading-relaxed"
          >
            {subMessage}
          </motion.p>
        </motion.div>
      )}
    </div>
  )
}
