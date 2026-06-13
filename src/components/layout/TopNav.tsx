'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Keyboard, LogOut, Globe, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { AnimatePresence, motion } from 'framer-motion'

export function TopNav() {
  const router = useRouter()
  const { lang, setLang, t } = useI18n()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState(new Date())
  const [showRegisterWarning, setShowRegisterWarning] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/cash-register/summary')
      if (res.ok) {
        const data = await res.json()
        if (data.openRegister) {
          setShowRegisterWarning(true)
          return
        }
      }
    } catch { /* proceed with logout */ }
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const forceLogout = async () => {
    setShowRegisterWarning(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })

  return (
    <header className="sticky top-0 z-40 px-4 py-3 md:px-6 transition-all duration-300"
      style={{
        background: 'rgba(10, 10, 10, 0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(245, 197, 24, 0.08)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3), 0 0 40px rgba(245, 197, 24, 0.03)',
      }}
    >
      <div className="max-w-full flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 md:gap-2.5 group cursor-default">
          <img src="/logo.png" alt="HIVE" className="w-8 h-8 md:w-11 md:h-11 object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_0_8px_rgba(245,197,24,0.3)]" />
          <span className="text-lg md:text-xl font-black tracking-tight text-white transition-colors duration-300">
            HIVE<span className="hive-gradient-text">.</span>
          </span>
        </div>

        {/* Right: Clock + Scanner + User */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Clock */}
          <div className="hidden lg:flex flex-col items-end font-mono leading-tight">
            {mounted ? (
              <>
                <span className="text-white/80 text-sm font-bold tracking-tight animate-fade-in">{formattedTime}</span>
                <span className="text-white/30 text-[10px] animate-fade-in">{formattedDate}</span>
              </>
            ) : (
              <>
                <span className="text-white/80 text-sm font-bold tracking-tight opacity-0">00:00:00</span>
                <span className="text-white/30 text-[10px] opacity-0">---</span>
              </>
            )}
          </div>

          {/* Scanner status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold tracking-wide
            transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'rgba(245, 197, 24, 0.1)',
              border: '1px solid rgba(245, 197, 24, 0.2)',
              color: '#F5C518',
              boxShadow: '0 0 20px rgba(245, 197, 24, 0.05)',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F5C518] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F5C518]"></span>
            </span>
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('nav.scanner')}</span>
          </div>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
            }}
            title={lang === 'en' ? 'التبديل للعربية' : 'Switch to English'}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === 'en' ? 'AR' : 'EN'}</span>
          </button>

          {/* User info + logout */}
          <div className="flex items-center gap-2 ps-2 border-s border-white/10">
            {user ? (
              <div className="flex flex-col items-end animate-fade-in">
                <span className="text-xs font-bold text-white/90 max-w-[80px] md:max-w-none truncate">{user.email.split('@')[0]}</span>
                <span className="text-[10px] font-bold text-[#F5C518] uppercase tracking-wider">{user.role.replace('_', ' ')}</span>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
                <div className="h-2.5 w-12 bg-white/5 rounded animate-pulse" />
              </div>
            )}
            <button onClick={handleLogout}
              className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 hover:rotate-6 active:scale-90">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Register open warning on logout */}
      <AnimatePresence>
        {showRegisterWarning && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegisterWarning(false)} />
            <motion.div className="relative w-full max-w-sm rounded-2xl border border-orange-500/20 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="text-center mb-4">
                <AlertTriangle size={36} className="text-orange-400 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-white">{t('register.logoutWarning')}</h3>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setShowRegisterWarning(false); router.push('/barista') }} className="w-full py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all">{t('register.goBack')}</button>
                <button onClick={forceLogout} className="w-full py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all">{t('register.logoutAnyway')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
