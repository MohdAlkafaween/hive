'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Phone, Lock, User, Mail, Eye, EyeOff, LogIn } from 'lucide-react'
import { Suspense } from 'react'
import { I18nProvider, useI18n } from '@/lib/i18n'

type Tab = 'login' | 'register'

function CustomerLoginContent() {
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const action = searchParams.get('action')
  const isCheckinFlow = action === 'checkin'
  const [tab, setTab] = useState<Tab>('login')

  // Login state
  const [loginPhone, setLoginPhone] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginShowPw, setLoginShowPw] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Register state
  const [regName, setRegName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [regShowPw, setRegShowPw] = useState(false)
  const [regLoading, setRegLoading] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const res = await fetch('/api/auth/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ phone: loginPhone, password: loginPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLoginError(data.error || t('customerAuth.loginFailed'))
        return
      }
      // Hard navigation — most reliable across all browsers, especially on LAN/mobile.
      // The cookie is already set server-side; a full page load guarantees the browser
      // sends it on the next request. Soft navigation (router.push) can silently fail
      // to include a freshly-set cookie on some mobile browsers over LAN.
      window.location.href = isCheckinFlow ? '/customer?action=checkin' : '/customer'
      return // stop execution — page is navigating away
    } catch {
      setLoginError(t('customerAuth.genericError'))
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegLoading(true)
    setRegError('')
    setRegSuccess('')

    if (regPassword !== regConfirm) {
      setRegError(t('customerAuth.passwordsMismatch'))
      setRegLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          fullName: regName,
          phone: regPhone,
          email: regEmail || undefined,
          password: regPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setRegError(data.error || t('customerAuth.registrationFailed'))
        return
      }
      if (data.linked) {
        setRegSuccess(t('customerAuth.accountLinked'))
      }
      // Hard navigation — same rationale as login handler above.
      window.location.href = isCheckinFlow ? '/customer?action=checkin' : '/customer'
      return
    } catch {
      setRegError(t('customerAuth.genericError'))
    } finally {
      setRegLoading(false)
    }
  }

  const inputClass = "w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none placeholder-white/20 transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(245,197,24,0.15),0_0_20px_rgba(245,197,24,0.08)] focus:bg-white/8"
  const iconClass = "absolute left-3 top-3.5 w-5 h-5 text-white/30 group-focus-within:text-[#F5C518] transition-colors"

  return (
    <div className="min-h-screen flex items-center justify-center text-white font-sans relative overflow-hidden px-4"
      style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 40%, #1E1708 100%)' }}>
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F5C518]/10 rounded-full blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#F5C518]/5 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" style={{ animationDelay: '1.5s' }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-2xl p-6 sm:p-8 mx-4 md:mx-0 z-10"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(245, 197, 24, 0.15)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 60px rgba(245, 197, 24, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/logo.png" alt="HIVE" className="w-16 h-16 object-contain drop-shadow-[0_0_16px_rgba(245,197,24,0.3)]" />
            <span className="text-2xl font-black tracking-tight text-white">HIVE<span className="text-[#F5C518]">.</span></span>
          </div>
          <p className="text-white/40 text-sm">{t('customerAuth.studentPortal')}</p>
        </div>

        {/* Check-in flow banner */}
        {isCheckinFlow && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(245,197,24,0.08)', border: '1px solid rgba(245,197,24,0.2)' }}>
            <LogIn size={16} className="text-[#F5C518] shrink-0" />
            <span className="text-sm text-[#F5C518] font-medium">{t('customer.loginToCheckIn')}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setTab('login'); setRegError(''); setRegSuccess('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === 'login'
                ? 'bg-[#F5C518]/15 text-[#F5C518] border border-[#F5C518]/30'
                : 'bg-white/5 text-white/40 border border-transparent hover:text-white/60'
            }`}
          >
            {t('customerAuth.login')}
          </button>
          <button
            onClick={() => { setTab('register'); setLoginError('') }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === 'register'
                ? 'bg-[#F5C518]/15 text-[#F5C518] border border-[#F5C518]/30'
                : 'bg-white/5 text-white/40 border border-transparent hover:text-white/60'
            }`}
          >
            {t('customerAuth.register')}
          </button>
        </div>

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">{t('customerAuth.phoneNumber')}</label>
              <div className="relative group">
                <Phone className={iconClass} />
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  value={loginPhone}
                  onChange={e => setLoginPhone(e.target.value)}
                  className={inputClass}
                  placeholder={t('customerAuth.phonePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">{t('customerAuth.password')}</label>
              <div className="relative group">
                <Lock className={iconClass} />
                <input
                  type={loginShowPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setLoginShowPw(!loginShowPw)} className="absolute right-3 top-3.5 text-white/30 hover:text-white/50">
                  {loginShowPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {loginError && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="text-sm p-3 rounded-lg border bg-red-500/10 text-red-400 border-red-500/20"
                >{loginError}</motion.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={loginLoading}
              className="w-full py-4 text-base font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #F5C518 0%, #EAB308 100%)',
                boxShadow: '0 8px 32px rgba(245, 197, 24, 0.3)',
                color: '#0A0A0A',
              }}
            >
              {loginLoading ? <Loader2 className="animate-spin" /> : t('customerAuth.signIn')}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-1.5">{t('customerAuth.fullName')}</label>
              <div className="relative group">
                <User className={iconClass} />
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  className={inputClass}
                  placeholder={t('customerAuth.namePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-1.5">{t('customerAuth.phoneNumber')}</label>
              <div className="relative group">
                <Phone className={iconClass} />
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  className={inputClass}
                  placeholder={t('customerAuth.phonePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-1.5">{t('customerAuth.email')} <span className="text-white/20">{t('customerAuth.optional')}</span></label>
              <div className="relative group">
                <Mail className={iconClass} />
                <input
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  className={inputClass}
                  placeholder={t('customerAuth.emailPlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-1.5">{t('customerAuth.password')}</label>
              <div className="relative group">
                <Lock className={iconClass} />
                <input
                  type={regShowPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder={t('customerAuth.passwordPlaceholder')}
                />
                <button type="button" onClick={() => setRegShowPw(!regShowPw)} className="absolute right-3 top-3.5 text-white/30 hover:text-white/50">
                  {regShowPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-1.5">{t('customerAuth.confirmPassword')}</label>
              <div className="relative group">
                <Lock className={iconClass} />
                <input
                  type={regShowPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder={t('customerAuth.confirmPlaceholder')}
                />
              </div>
            </div>

            <AnimatePresence>
              {regError && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="text-sm p-3 rounded-lg border bg-red-500/10 text-red-400 border-red-500/20"
                >{regError}</motion.p>
              )}
              {regSuccess && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="text-sm p-3 rounded-lg border bg-green-500/10 text-green-400 border-green-500/20"
                >{regSuccess}</motion.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={regLoading}
              className="w-full py-4 text-base font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #F5C518 0%, #EAB308 100%)',
                boxShadow: '0 8px 32px rgba(245, 197, 24, 0.3)',
                color: '#0A0A0A',
              }}
            >
              {regLoading ? <Loader2 className="animate-spin" /> : t('customerAuth.createAccount')}
            </button>
          </form>
        )}

        {/* Staff link */}
        <p className="mt-6 text-center text-xs text-white/30">
          {t('customerAuth.staffQuestion')}{' '}
          <a href="/login" className="text-[#F5C518]/70 hover:text-[#F5C518] transition-colors font-medium">
            {t('customerAuth.loginHere')} &rarr;
          </a>
        </p>
      </motion.div>
    </div>
  )
}

export default function CustomerLoginPage() {
  return (
    <I18nProvider>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 40%, #1E1708 100%)' }}><Loader2 className="w-8 h-8 text-[#F5C518] animate-spin" /></div>}>
        <CustomerLoginContent />
      </Suspense>
    </I18nProvider>
  )
}
