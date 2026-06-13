'use client'
import { type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { CustomerProvider, useCustomer } from '@/lib/customerContext'
import { OrderNotificationProvider } from '@/components/customer/OrderNotificationProvider'
import { Home, Coffee, ClipboardList, User, LogOut, Globe, Loader2 } from 'lucide-react'

function CustomerTopBar() {
  const { customer } = useCustomer()
  const { lang, setLang, t } = useI18n()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/customer-login')
  }

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-4 py-3"
      style={{
        background: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(245, 197, 24, 0.1)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <img src="/logo.png" alt="HIVE" className="w-8 h-8 object-contain" />
        <span className="text-lg font-black text-white tracking-tight">HIVE</span>
      </div>

      <div className="flex items-center gap-3">
        {customer && (
          <span className="text-sm text-white/60 hidden sm:block max-w-[150px] truncate">
            {customer.fullName}
          </span>
        )}
        <button
          onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
          className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          title={lang === 'en' ? 'العربية' : 'English'}
        >
          <Globe size={18} />
        </button>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
          title={t('nav.logout')}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}

function CustomerBottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  const tabs = [
    { href: '/customer', icon: Home, label: t('customer.home') },
    { href: '/customer/menu', icon: Coffee, label: t('customer.menu') },
    { href: '/customer/orders', icon: ClipboardList, label: t('customer.orders') },
    { href: '/customer/profile', icon: User, label: t('customer.profile') },
  ]

  const isActive = (href: string) => {
    if (href === '/customer') return pathname === '/customer'
    return pathname.startsWith(href)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(245, 197, 24, 0.1)',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        height: '68px',
      }}
    >
      {tabs.map(({ href, icon: Icon, label }) => (
        <a
          key={href}
          href={href}
          className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[64px] ${
            isActive(href)
              ? 'text-[#F5C518]'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          <Icon size={22} strokeWidth={isActive(href) ? 2.5 : 1.5} />
          <span className="text-[10px] font-semibold">{label}</span>
        </a>
      ))}
    </nav>
  )
}

function CustomerShell({ children }: { children: ReactNode }) {
  const { loading } = useCustomer()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 40%, #1E1708 100%)' }}
      >
        <Loader2 className="w-8 h-8 text-[#F5C518] animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 40%, #1E1708 100%)' }}
    >
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/4 w-[400px] h-[400px] bg-[#F5C518]/5 rounded-full blur-[150px] pointer-events-none" />

      <CustomerTopBar />
      <OrderNotificationProvider />

      <main className="flex-1 overflow-auto py-4 pb-24">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
          {children}
        </div>
      </main>

      <CustomerBottomNav />
    </div>
  )
}

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <CustomerProvider>
        <CustomerShell>{children}</CustomerShell>
      </CustomerProvider>
    </I18nProvider>
  )
}
