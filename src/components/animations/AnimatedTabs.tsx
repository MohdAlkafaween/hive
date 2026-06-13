'use client'
import { motion } from 'framer-motion'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface AnimatedTabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
}

export function AnimatedTabs({ tabs, activeTab, onChange, className = '' }: AnimatedTabsProps) {
  return (
    <div className={`flex gap-1 p-1 rounded-xl w-fit max-w-full overflow-x-auto ${className}`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="relative flex items-center gap-2 px-3 md:px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 shrink-0"
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 rounded-lg"
              style={{
                background: 'rgba(245, 197, 24, 0.1)',
                border: '1px solid rgba(245, 197, 24, 0.2)',
                boxShadow: '0 0 20px rgba(245, 197, 24, 0.05)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className={`relative z-10 flex items-center gap-2 ${
            activeTab === tab.id ? 'text-[#F5C518]' : 'text-white/40 hover:text-white/70'
          }`}>
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  )
}
