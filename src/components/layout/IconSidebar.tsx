'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { UserCheck, Users, BarChart3, Coffee, ScanLine, Shield, ScrollText } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  roles: string[]
  newTab?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/',          label: 'Dashboard',  icon: UserCheck,  roles: ['ADMIN', 'REGISTERATION_COUNTER'] },
  { href: '/directory', label: 'Directory',  icon: Users,      roles: ['ADMIN', 'REGISTERATION_COUNTER'] },
  { href: '/logs',      label: 'Logs',       icon: ScrollText, roles: ['ADMIN', 'REGISTERATION_COUNTER'] },
  { href: '/stats',     label: 'Statistics', icon: BarChart3,  roles: ['ADMIN'] },
  { href: '/barista',   label: 'Barista POS',icon: Coffee,     roles: ['ADMIN', 'BARISTA'] },
  { href: '/admin',     label: 'Admin Panel',icon: Shield,     roles: ['ADMIN'] },
  { href: '/checkin',   label: 'Kiosk Mode', icon: ScanLine,   roles: ['ADMIN', 'REGISTERATION_COUNTER'], newTab: true },
]

export function IconSidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setRole(data.user.role)
          if (data.user.permissions) {
            try { setPermissions(JSON.parse(data.user.permissions)) } catch {}
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const visibleItems = role
    ? NAV_ITEMS.filter(item => {
        if (item.roles.includes(role)) return true
        // MANAGER: show pages they have permission for
        if (role === 'MANAGER' && permissions.includes(item.href)) return true
        return false
      })
    : []

  return (
    <aside className="w-[60px] min-h-0 flex flex-col bg-[#0A0A0A] border-r border-[#1F1F1F] shrink-0 z-30">
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
          // Skeleton loaders while role is loading
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
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#F5C518] rounded-r-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              </div>

              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#171717] text-white text-xs font-bold rounded-lg
                opacity-0 invisible group-hover:opacity-100 group-hover:visible
                transition-all duration-200 translate-x-1 group-hover:translate-x-0
                whitespace-nowrap z-50
                shadow-lg border border-[#2C2C2C]
                pointer-events-none">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#171717]" />
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
        <ShortcutBadge label="Search" keys="F1" />
        <ShortcutBadge label="New Student" keys="F2" />
        <ShortcutBadge label="Close" keys="Esc" />
      </div>
    </aside>
  )
}

function ShortcutBadge({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="group relative flex items-center justify-center">
      <kbd className="px-1.5 py-1 text-[9px] bg-[#171717] border border-[#2C2C2C] rounded text-[#F5C518] font-mono font-bold shadow-[0_1px_2px_rgba(0,0,0,0.5)] min-w-[28px] text-center
        transition-all duration-200 group-hover:border-[#F5C518]/30 group-hover:shadow-[0_0_6px_rgba(245,197,24,0.15)]">
        {keys}
      </kbd>
      {/* Tooltip */}
      <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#171717] text-white text-[10px] font-bold rounded-md
        opacity-0 invisible group-hover:opacity-100 group-hover:visible
        transition-all duration-200 translate-x-1 group-hover:translate-x-0
        whitespace-nowrap z-50
        shadow-lg border border-[#2C2C2C] pointer-events-none">
        {label}
      </div>
    </div>
  )
}
