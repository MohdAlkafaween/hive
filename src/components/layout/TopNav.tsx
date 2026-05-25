'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Keyboard, LogOut } from 'lucide-react'

export function TopNav() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState(new Date())
  const [user, setUser] = useState<{ email: string; role: string } | null>(null)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => { if (data.user) setUser(data.user) })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
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
        <div className="flex items-center gap-2.5 group cursor-default">
          <img src="/logo.png" alt="HIVE" className="w-11 h-11 object-contain transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_0_8px_rgba(245,197,24,0.3)]" />
          <span className="text-xl font-black tracking-tight text-white transition-colors duration-300">
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
            <span className="hidden sm:inline">SCANNER: ARMED</span>
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            {user ? (
              <div className="flex flex-col items-end animate-fade-in">
                <span className="text-xs font-bold text-white/90">{user.email.split('@')[0]}</span>
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
    </header>
  )
}
