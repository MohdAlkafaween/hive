'use client'
import { type ReactNode } from 'react'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { AuthProvider } from '@/hooks/useAuth'

function LayoutShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 40%, #1E1708 100%)' }}
    >
      {/* Ambient glow orbs */}
      <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-[#F5C518]/5 rounded-full blur-[150px] animate-pulse-slow pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#F5C518]/3 rounded-full blur-[120px] animate-pulse-slow pointer-events-none" style={{ animationDelay: '1.5s' }} />
      <div className="fixed top-3/4 left-1/2 w-[300px] h-[300px] bg-[#F5C518]/4 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" style={{ animationDelay: '3s' }} />

      {children}

      <footer className="relative z-10 py-3 px-4 text-xs font-mono"
        style={{
          borderTop: '1px solid rgba(245, 197, 24, 0.06)',
          background: 'rgba(0,0,0,0.3)',
          color: 'rgba(255,255,255,0.25)',
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{t('footer.rights')}</span>
          <span className="hover:text-white/50 cursor-help font-medium transition-colors" title="F1: Search | F2: New Student | Esc: Dismiss">
            {t('footer.hotkeys')}
          </span>
        </div>
      </footer>
    </div>
  )
}

export function AppLayoutInner({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <LayoutShell>{children}</LayoutShell>
      </AuthProvider>
    </I18nProvider>
  )
}
