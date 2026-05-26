'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Loader2, TrendingUp } from 'lucide-react'

interface DayData {
  date: string
  label: string
  revenue: number
  checkIns: number
}

export function RevenueChart() {
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'7d' | '30d'>('7d')

  useEffect(() => {
    setLoading(true)
    const days = range === '7d' ? 7 : 30
    const promises: Promise<DayData>[] = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-JO', { month: 'short', day: 'numeric' })

      promises.push(
        fetch(`/api/stats/daily?date=${dateStr}`)
          .then(r => r.ok ? r.json() : { totalRevenue: 0, totalCheckIns: 0 })
          .then(s => ({ date: dateStr, label, revenue: s.totalRevenue || 0, checkIns: s.totalCheckIns || 0 }))
          .catch(() => ({ date: dateStr, label, revenue: 0, checkIns: 0 }))
      )
    }

    Promise.all(promises).then(setData).finally(() => setLoading(false))
  }, [range])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[250px]">
        <Loader2 size={20} className="animate-spin text-white/20" />
      </div>
    )
  }

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalCheckIns = data.reduce((s, d) => s + d.checkIns, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-black text-[#F5C518]">{totalRevenue.toFixed(1)} JD</p>
            <p className="text-[10px] text-white/25 font-bold uppercase tracking-wider">Total Revenue</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div>
            <p className="text-2xl font-black text-blue-400">{totalCheckIns}</p>
            <p className="text-[10px] text-white/25 font-bold uppercase tracking-wider">Check-Ins</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          <button onClick={() => setRange('7d')}
            className={`px-3 py-1.5 text-xs font-bold transition-all ${range === '7d' ? 'bg-[#F5C518] text-black' : 'bg-white/5 text-white/40 hover:bg-white/8'}`}>
            7 Days
          </button>
          <button onClick={() => setRange('30d')}
            className={`px-3 py-1.5 text-xs font-bold transition-all ${range === '30d' ? 'bg-[#F5C518] text-black' : 'bg-white/5 text-white/40 hover:bg-white/8'}`}>
            30 Days
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#fff' }}
            cursor={{ fill: 'rgba(245, 197, 24, 0.05)' }}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value)
              const n = String(name)
              return [
                n === 'revenue' ? `${v.toFixed(1)} JD` : v,
                n === 'revenue' ? 'Revenue' : 'Check-Ins'
              ]
            }}
          />
          <Bar dataKey="revenue" fill="#F5C518" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="checkIns" fill="rgba(59, 130, 246, 0.6)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
