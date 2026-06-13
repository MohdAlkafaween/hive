'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { UserCheck, Users, BarChart3, Coffee, ScanLine, Shield, ScrollText, ClipboardList, MoreHorizontal, X, MessageSquare, Bell } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { bootstrapAudio, playNotificationBeep } from '@/lib/sounds'

interface NavItem {
  href: string
  labelKey: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  roles: string[]
  newTab?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/',          labelKey: 'sidebar.dashboard',  icon: UserCheck,     roles: ['ADMIN', 'STAFF'] },
  { href: '/directory', labelKey: 'sidebar.directory',  icon: Users,         roles: ['ADMIN', 'STAFF'] },
  { href: '/logs',      labelKey: 'sidebar.logs',       icon: ScrollText,    roles: ['ADMIN'] },
  { href: '/stats',     labelKey: 'sidebar.stats',      icon: BarChart3,     roles: ['ADMIN'] },
  { href: '/barista',   labelKey: 'sidebar.barista',    icon: Coffee,        roles: ['ADMIN', 'STAFF', 'BARISTA'] },
  { href: '/orders',    labelKey: 'sidebar.orders',     icon: ClipboardList, roles: ['ADMIN', 'STAFF', 'BARISTA'] },
  { href: '/feedback',  labelKey: 'sidebar.feedback',   icon: MessageSquare, roles: ['ADMIN'] },
  { href: '/admin',     labelKey: 'sidebar.admin',      icon: Shield,        roles: ['ADMIN'] },
  { href: '/checkin',   labelKey: 'sidebar.kiosk',      icon: ScanLine,      roles: ['ADMIN'], newTab: true },
]

// Primary items shown directly in the bottom nav (max 5 + More)
const MOBILE_PRIMARY_KEYS = ['/', '/directory', '/barista', '/orders', '/logs']

export function IconSidebar() {
  const pathname = usePathname()
  const { t, dir } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const [kioskEnabled, setKioskEnabled] = useState(false)
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const [pendingOrderCount, setPendingOrderCount] = useState(0)
  const [showNewOrderBanner, setShowNewOrderBanner] = useState(false)
  const prevPendingCountRef = useRef(-1)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const role = user?.role ?? null
  const loaded = !authLoading
  const permissions = useMemo<string[]>(() => {
    if (!user?.permissions) return []
    try { return JSON.parse(user.permissions) } catch { return [] }
  }, [user?.permissions])

  // Fetch kiosk enabled state
  useEffect(() => {
    fetch('/api/settings/public')
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, string>) => {
        if (s.kioskEnabled === 'true') setKioskEnabled(true)
        if (s.feedbackEnabled === 'true') setFeedbackEnabled(true)
      })
      .catch(() => {})
  }, [])

  // Bootstrap audio on mount
  useEffect(() => { bootstrapAudio() }, [])

  // Poll pending order count every 15 seconds (for sidebar badge + global sound)
  useEffect(() => {
    if (!role) return
    const fetchCount = () => {
      fetch('/api/orders/queue?count=true')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.pendingCount != null) {
            const newCount = data.pendingCount
            if (prevPendingCountRef.current >= 0 && newCount > prevPendingCountRef.current) {
              // New order(s) arrived — play sound + show banner
              playNotificationBeep()
              setShowNewOrderBanner(true)
              if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
              bannerTimerRef.current = setTimeout(() => setShowNewOrderBanner(false), 8000)
            }
            prevPendingCountRef.current = newCount
            setPendingOrderCount(newCount)
          }
        })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 15000)
    return () => {
      clearInterval(interval)
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    }
  }, [role])

  const visibleItems = role
    ? NAV_ITEMS.filter(item => {
        // Hide kiosk link when kiosk is disabled
        if (item.href === '/checkin' && !kioskEnabled) return false
        // Hide feedback link when feedback is disabled
        if (item.href === '/feedback' && !feedbackEnabled) return false
        if (item.roles.includes(role)) return true
        if (role === 'MANAGER' && permissions.includes(item.href)) return true
        return false
      })
    : []

  const isRtl = dir === 'rtl'

  // Split items for mobile: primary (shown as tabs) vs overflow (in More menu)
  const mobilePrimary = visibleItems.filter(i => MOBILE_PRIMARY_KEYS.includes(i.href))
  const mobileOverflow = visibleItems.filter(i => !MOBILE_PRIMARY_KEYS.includes(i.href))

  return (
    <>
      {/* ═══ GLOBAL NEW ORDER BANNER ═══ */}
      <AnimatePresence>
        {showNewOrderBanner && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-auto max-w-md"
          >
            <Link
              href="/orders"
              onClick={() => setShowNewOrderBanner(false)}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#F5C518]/15 border border-[#F5C518]/30 backdrop-blur-md shadow-[0_4px_24px_rgba(245,197,24,0.25)] animate-pulse cursor-pointer"
            >
              <Bell className="text-[#F5C518] shrink-0" size={20} />
              <div>
                <span className="text-[#F5C518] text-sm font-black block">{t('queue.newOrderBanner')}</span>
                <span className="text-[#F5C518]/50 text-xs font-semibold">{t('queue.viewOrders')}</span>
              </div>
              <X className="text-[#F5C518]/40 hover:text-[#F5C518] shrink-0 ms-2" size={16}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowNewOrderBanner(false) }} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ DESKTOP SIDEBAR (>= 768px) ═══ */}
      <aside className="hidden md:flex w-[60px] min-h-0 flex-col bg-[#0A0A0A] border-e border-[#1F1F1F] shrink-0 z-30">
        {/* Logo */}
        <div className="flex items-center justify-center py-4">
          <motion.div
            whileHover={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <img src="/logo.png" alt="HIVE" className="w-11 h-11 object-contain drop-shadow-[0_0_8px_rgba(245,197,24,0.4)]" />
          </motion.div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col items-center gap-1 px-1.5 pt-2">
          {!loaded && (
            <>
              {[1,2,3,4].map(i => (
                <div key={i} className="w-full flex justify-center py-3">
                  <div className="w-5 h-5 rounded bg-[#1F1F1F] animate-pulse" />
                </div>
              ))}
            </>
          )}
          {visibleItems.map((item, index) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            const Icon = item.icon

            const content = (
              <div
                className={`group relative w-full flex items-center justify-center py-3 rounded-lg transition-all duration-200
                  ${active
                    ? 'bg-yellow-500/10 text-[#F5C518]'
                    : 'text-[#71717A] hover:text-white hover:bg-[#171717]'
                  }`}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {active && (
                  <motion.div
                    layoutId="sidebarActiveIndicator"
                    className={`absolute top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#F5C518] ${isRtl ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'}`}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <div className={`relative transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                  {item.href === '/orders' && pendingOrderCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-yellow-500 text-black text-[9px] font-black flex items-center justify-center leading-none">
                      {pendingOrderCount > 99 ? '99+' : pendingOrderCount}
                    </span>
                  )}
                </div>

                {/* Tooltip */}
                <div className={`absolute px-3 py-1.5 bg-[#171717] text-white text-xs font-bold rounded-lg
                  opacity-0 invisible group-hover:opacity-100 group-hover:visible
                  transition-all duration-200 whitespace-nowrap z-50
                  shadow-lg border border-[#2C2C2C] pointer-events-none
                  ${isRtl
                    ? 'right-full me-3 -translate-x-1 group-hover:translate-x-0'
                    : 'left-full ms-3 translate-x-1 group-hover:translate-x-0'
                  }`}>
                  {t(item.labelKey)}
                  <div className={`absolute top-1/2 -translate-y-1/2 border-4 border-transparent ${isRtl ? 'left-full border-l-[#171717]' : 'right-full border-r-[#171717]'}`} />
                </div>
              </div>
            )

            if (item.newTab) {
              return (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                  className="w-full animate-fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
                  {content}
                </a>
              )
            }

            return (
              <Link key={item.href} href={item.href}
                className="w-full animate-fade-in-up" style={{ animationDelay: `${index * 60}ms` }}>
                {content}
              </Link>
            )
          })}
        </nav>

        {/* Shortcuts hint */}
        <div className="flex flex-col items-center gap-2 pb-4 pt-2 border-t border-[#1F1F1F] mx-2">
          <ShortcutBadge label={t('sidebar.search')} keys="F1" isRtl={isRtl} />
          <ShortcutBadge label={t('sidebar.newStudent')} keys="F2" isRtl={isRtl} />
          <ShortcutBadge label={t('sidebar.close')} keys="Esc" isRtl={isRtl} />
        </div>
      </aside>

      {/* ═══ MOBILE BOTTOM NAV (< 768px) ═══ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A] border-t border-[#1F1F1F]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-14">
          {!loaded ? (
            <>
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex flex-col items-center justify-center gap-0.5 flex-1">
                  <div className="w-5 h-5 rounded bg-[#1F1F1F] animate-pulse" />
                  <div className="w-8 h-2 rounded bg-[#1F1F1F] animate-pulse" />
                </div>
              ))}
            </>
          ) : (
            <>
              {mobilePrimary.map(item => {
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                const Icon = item.icon

                if (item.newTab) {
                  return (
                    <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px]">
                      <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className={active ? 'text-[#F5C518]' : 'text-[#71717A]'} />
                      <span className={`text-[10px] font-bold ${active ? 'text-[#F5C518]' : 'text-[#71717A]'}`}>
                        {t(item.labelKey)}
                      </span>
                    </a>
                  )
                }

                return (
                  <Link key={item.href} href={item.href}
                    className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px]">
                    <div className="relative">
                      <Icon size={20} strokeWidth={active ? 2.5 : 1.5} className={active ? 'text-[#F5C518]' : 'text-[#71717A]'} />
                      {active && (
                        <motion.div layoutId="mobileActiveIndicator"
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#F5C518] rounded-full"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                      )}
                      {item.href === '/orders' && pendingOrderCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-yellow-500 text-black text-[9px] font-black flex items-center justify-center leading-none">
                          {pendingOrderCount > 99 ? '99+' : pendingOrderCount}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold ${active ? 'text-[#F5C518]' : 'text-[#71717A]'}`}>
                      {t(item.labelKey)}
                    </span>
                  </Link>
                )
              })}

              {/* More button (only if there are overflow items) */}
              {mobileOverflow.length > 0 && (
                <button onClick={() => setMoreOpen(!moreOpen)}
                  className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px]">
                  <MoreHorizontal size={20} className={moreOpen ? 'text-[#F5C518]' : 'text-[#71717A]'} />
                  <span className={`text-[10px] font-bold ${moreOpen ? 'text-[#F5C518]' : 'text-[#71717A]'}`}>
                    More
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {/* More popup menu */}
        <AnimatePresence>
          {moreOpen && mobileOverflow.length > 0 && (
            <motion.div
              className="absolute bottom-full left-0 right-0 bg-[#0A0A0A] border-t border-[#1F1F1F] shadow-[0_-8px_24px_rgba(0,0,0,0.5)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-3 space-y-1">
                {mobileOverflow.map(item => {
                  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                  const Icon = item.icon

                  if (item.newTab) {
                    return (
                      <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                          active ? 'bg-yellow-500/10 text-[#F5C518]' : 'text-[#71717A] hover:text-white hover:bg-[#171717]'
                        }`}>
                        <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                        <span className="text-sm font-bold">{t(item.labelKey)}</span>
                      </a>
                    )
                  }

                  return (
                    <Link key={item.href} href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        active ? 'bg-yellow-500/10 text-[#F5C518]' : 'text-[#71717A] hover:text-white hover:bg-[#171717]'
                      }`}>
                      <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
                      <span className="text-sm font-bold">{t(item.labelKey)}</span>
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  )
}

function ShortcutBadge({ label, keys, isRtl }: { label: string; keys: string; isRtl: boolean }) {
  return (
    <div className="group relative flex items-center justify-center">
      <kbd className="px-1.5 py-1 text-[9px] bg-[#171717] border border-[#2C2C2C] rounded text-[#F5C518] font-mono font-bold shadow-[0_1px_2px_rgba(0,0,0,0.5)] min-w-[28px] text-center
        transition-all duration-200 group-hover:border-[#F5C518]/30 group-hover:shadow-[0_0_6px_rgba(245,197,24,0.15)]">
        {keys}
      </kbd>
      {/* Tooltip */}
      <div className={`absolute px-2.5 py-1 bg-[#171717] text-white text-[10px] font-bold rounded-md
        opacity-0 invisible group-hover:opacity-100 group-hover:visible
        transition-all duration-200 whitespace-nowrap z-50
        shadow-lg border border-[#2C2C2C] pointer-events-none
        ${isRtl
          ? 'right-full me-3 -translate-x-1 group-hover:translate-x-0'
          : 'left-full ms-3 translate-x-1 group-hover:translate-x-0'
        }`}>
        {label}
      </div>
    </div>
  )
}
