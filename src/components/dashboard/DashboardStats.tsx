'use client'
import { useState, useEffect } from 'react'
import { DollarSign, Users, CreditCard, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

interface DashboardStatsProps {
  checkInCount: number
}

export function DashboardStats({ checkInCount }: DashboardStatsProps) {
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [activeSubs, setActiveSubs] = useState(0)
  const [occupancy, setOccupancy] = useState({ current: 0, max: 0 })

  useEffect(() => {
    // Today's revenue
    const today = new Date().toISOString().slice(0, 10)
    fetch(`/api/stats/daily?date=${today}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTodayRevenue(d.totalRevenue) })
      .catch(() => {})

    // Active subscriptions count
    fetch('/api/students')
      .then(r => r.ok ? r.json() : [])
      .then((students: any[]) => {
        const active = students.filter((s: any) => s.subscriptions?.length > 0).length
        setActiveSubs(active)
      })
      .catch(() => {})

    // Capacity
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then((settings: Record<string, unknown>) => {
        const max = Number(settings.maxCapacity) || 0
        setOccupancy(prev => ({ ...prev, max }))
      })
      .catch(() => {})
  }, [])

  // Update current occupancy from check-in count (logs with no checkout)
  useEffect(() => {
    fetch('/api/logs/today')
      .then(r => r.ok ? r.json() : [])
      .then((logs: any[]) => {
        const inside = logs.filter((l: any) => !l.checkOutTime).length
        setOccupancy(prev => ({ ...prev, current: inside }))
      })
      .catch(() => {})
  }, [checkInCount])

  const cards = [
    {
      icon: <DollarSign size={18} className="text-green-400" />,
      label: "Today's Revenue",
      value: `${todayRevenue.toFixed(1)} JD`,
      color: 'green',
    },
    {
      icon: <Users size={18} className="text-[#F5C518]" />,
      label: 'Check-Ins Today',
      value: checkInCount.toString(),
      color: 'yellow',
    },
    {
      icon: <CreditCard size={18} className="text-blue-400" />,
      label: 'Active Subs',
      value: activeSubs.toString(),
      color: 'blue',
    },
    {
      icon: <TrendingUp size={18} className={occupancy.max > 0 && occupancy.current >= occupancy.max ? 'text-red-400' : 'text-purple-400'} />,
      label: 'Occupancy',
      value: occupancy.max > 0 ? `${occupancy.current}/${occupancy.max}` : `${occupancy.current}`,
      color: occupancy.max > 0 && occupancy.current >= occupancy.max ? 'red' : 'purple',
    },
  ]

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl w-full mx-auto"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {card.icon}
          </div>
          <div>
            <p className="text-lg font-black text-white leading-tight">{card.value}</p>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider">{card.label}</p>
          </div>
        </div>
      ))}
    </motion.div>
  )
}
