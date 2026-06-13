'use client'
import { useState, useEffect, useRef } from 'react'
import { useCustomer } from '@/lib/customerContext'
import { useI18n } from '@/lib/i18n'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, LogIn, Clock, Calendar, Coffee, ClipboardList, History, Snowflake, AlertTriangle, Loader2 } from 'lucide-react'

interface SubData {
  planType: string
  expiryDate: string
  totalVisitsAllowed: number
  visitsUsed: number
  isActive: boolean
  isFrozen: boolean
}

export default function CustomerHomePage() {
  const { customer } = useCustomer()
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const [subscription, setSubscription] = useState<SubData | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [checkedIn, setCheckedIn] = useState(false)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [checkInMsg, setCheckInMsg] = useState('')
  const [checkInError, setCheckInError] = useState('')
  const [isInside, setIsInside] = useState(false)
  const autoCheckinTriggered = useRef(false)

  useEffect(() => {
    fetch('/api/customer/subscription')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.subscription) setSubscription(data.subscription) })
      .catch(() => {})
      .finally(() => setSubLoading(false))

    fetch('/api/customer/history')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.logs?.length > 0 && !data.logs[0].checkOutTime) {
          setIsInside(true)
        }
      })
      .catch(() => {})
  }, [])

  // Auto check-in from QR flow (?action=checkin)
  useEffect(() => {
    if (searchParams.get('action') !== 'checkin') return
    if (autoCheckinTriggered.current) return
    if (isInside || checkedIn) {
      // Already inside — just clean the URL
      window.history.replaceState({}, '', '/customer')
      return
    }
    autoCheckinTriggered.current = true
    // Trigger auto check-in
    setCheckInLoading(true)
    fetch('/api/checkin/self', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'OK') {
          setCheckedIn(true)
          setIsInside(true)
          setCheckInMsg(data.windowReuse ? t('customer.welcomeBackNoDeduct') : t('customer.checkedInSuccess'))
        } else if (data.status === 'ALREADY_IN') {
          setIsInside(true)
          setCheckInMsg(t('customer.alreadyInside'))
        } else {
          setCheckInError(data.reason || t('customer.checkInFailed'))
        }
      })
      .catch(() => setCheckInError(t('common.error')))
      .finally(() => {
        setCheckInLoading(false)
        window.history.replaceState({}, '', '/customer')
      })
  }, [searchParams, isInside, checkedIn, t])

  const handleCheckIn = async () => {
    setCheckInLoading(true)
    setCheckInError('')
    setCheckInMsg('')
    try {
      const res = await fetch('/api/checkin/self', { method: 'POST' })
      const data = await res.json()
      if (data.status === 'OK') {
        setCheckedIn(true)
        setIsInside(true)
        setCheckInMsg(data.windowReuse ? t('customer.welcomeBackNoDeduct') : t('customer.checkedInSuccess'))
      } else if (data.status === 'ALREADY_IN') {
        setIsInside(true)
        setCheckInMsg(t('customer.alreadyInside'))
      } else {
        setCheckInError(data.reason || t('customer.checkInFailed'))
      }
    } catch {
      setCheckInError(t('common.error'))
    } finally {
      setCheckInLoading(false)
    }
  }

  const daysRemaining = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0
  const entriesRemaining = subscription
    ? subscription.totalVisitsAllowed === -1 ? -1 : subscription.totalVisitsAllowed - subscription.visitsUsed
    : 0

  return (
    <div className="space-y-4">
      <div className="pt-2 pb-1">
        <h1 className="text-2xl font-black text-white">
          {t('customer.welcome')}{customer ? `, ${customer.fullName.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-sm text-white/40 mt-1">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Check-In Card */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: isInside || checkedIn
            ? 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.04) 100%)'
            : 'rgba(255,255,255,0.04)',
          border: isInside || checkedIn
            ? '1px solid rgba(34,197,94,0.2)'
            : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {isInside || checkedIn ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="text-green-400" size={24} />
            </div>
            <div>
              <p className="text-green-400 font-bold text-lg">{t('customer.youreCheckedIn')}</p>
              {checkInMsg && <p className="text-green-400/60 text-sm mt-0.5">{checkInMsg}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                <LogIn className="text-white/40" size={24} />
              </div>
              <div>
                <p className="text-white font-semibold">{t('customer.notCheckedIn')}</p>
                <p className="text-white/40 text-sm">{t('customer.tapToCheckIn')}</p>
              </div>
            </div>
            <button
              onClick={handleCheckIn}
              disabled={checkInLoading}
              className="w-full py-3.5 rounded-xl font-bold text-base transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #F5C518 0%, #EAB308 100%)',
                color: '#0A0A0A',
                boxShadow: '0 4px 20px rgba(245, 197, 24, 0.25)',
              }}
            >
              {checkInLoading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              {t('customer.checkIn')}
            </button>
            {checkInError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                <AlertTriangle size={16} />
                {checkInError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subscription Card */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-3">{t('customer.subscription')}</h2>
        {subLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
          </div>
        ) : !subscription ? (
          <div className="text-center py-4">
            <p className="text-white/50 text-sm">{t('customer.noSubscription')}</p>
            <p className="text-white/30 text-xs mt-1">{t('customer.visitCounter')}</p>
          </div>
        ) : subscription.isFrozen ? (
          <div className="flex items-center gap-3 py-2">
            <Snowflake className="text-blue-400" size={20} />
            <p className="text-blue-400 text-sm font-medium">{t('customer.subFrozen')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">{t('customer.plan')}</span>
              <span className="text-[#F5C518] font-bold text-sm">{subscription.planType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm flex items-center gap-1.5"><Calendar size={14} /> {t('customer.daysLeft')}</span>
              <span className="text-white font-semibold text-sm">{daysRemaining} {t('customer.days')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm flex items-center gap-1.5"><Clock size={14} /> {t('customer.entriesLeft')}</span>
              <span className="text-white font-semibold text-sm">{entriesRemaining === -1 ? t('customer.unlimited') : entriesRemaining}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">{t('customer.expires')}</span>
              <span className="text-white/60 text-sm">{new Date(subscription.expiryDate).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-3">
        {[
          { href: '/customer/menu', icon: Coffee, label: t('customer.browseMenu'), desc: t('customer.browseMenuDesc') },
          { href: '/customer/orders', icon: ClipboardList, label: t('customer.myOrders'), desc: t('customer.myOrdersDesc') },
          { href: '/customer/history', icon: History, label: t('customer.myHistory'), desc: t('customer.myHistoryDesc') },
        ].map(({ href, icon: Icon, label, desc }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-xl p-4 transition-all hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="w-10 h-10 rounded-lg bg-[#F5C518]/10 flex items-center justify-center shrink-0">
              <Icon className="text-[#F5C518]" size={20} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-white/30 text-xs">{desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
