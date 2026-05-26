'use client'
import { useState, useEffect, useCallback } from 'react'

interface DisplayData {
  enabled: boolean
  currentOccupancy: number
  maxCapacity: number
  connectionType: string
  recentActivity: { name: string; time: string; type: 'in' | 'out' }[]
  timestamp: string
}

export default function PublicDisplayPage() {
  const [data, setData] = useState<DisplayData | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [clock, setClock] = useState(new Date())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/display')
      if (res.status === 403) {
        setDisabled(true)
        return
      }
      const json = await res.json()
      setData(json)
      setDisabled(false)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000) // refresh every 10s
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (disabled) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-white/40">Display Disabled</h1>
          <p className="text-sm text-white/20 mt-2">The occupancy display has been turned off by the administrator.</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5C518] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const occupancyPercent = Math.min((data.currentOccupancy / data.maxCapacity) * 100, 100)
  const isFull = data.currentOccupancy >= data.maxCapacity
  const isNearFull = occupancyPercent >= 80

  const statusColor = isFull ? '#EF4444' : isNearFull ? '#F59E0B' : '#22C55E'
  const statusText = isFull ? 'FULL' : isNearFull ? 'ALMOST FULL' : 'AVAILABLE'

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-8 overflow-hidden select-none" style={{ cursor: 'none' }}>
      {/* Top bar with clock */}
      <div className="absolute top-6 left-8 right-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F5C518] rounded-xl flex items-center justify-center">
            <span className="text-black font-black text-lg">H</span>
          </div>
          <span className="text-white/60 font-bold text-lg tracking-wider">HIVE</span>
        </div>
        <div className="text-white/30 text-xl font-mono">
          {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </div>
      </div>

      {/* Main occupancy display */}
      <div className="flex flex-col items-center gap-8">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
          <span className="text-2xl font-black tracking-[0.3em] uppercase" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>

        {/* Big number */}
        <div className="relative">
          <div className="text-[12rem] font-black leading-none text-white tabular-nums" style={{ fontFeatureSettings: '"tnum"' }}>
            {data.currentOccupancy}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-white/20 text-xl font-bold tracking-widest">
            / {data.maxCapacity}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-96 max-w-[80vw] mt-8">
          <div className="h-3 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${occupancyPercent}%`,
                backgroundColor: statusColor,
                boxShadow: `0 0 20px ${statusColor}40`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/15 font-bold">
            <span>0</span>
            <span>{Math.round(occupancyPercent)}% occupied</span>
            <span>{data.maxCapacity}</span>
          </div>
        </div>

        {/* Available seats */}
        {!isFull && (
          <div className="mt-4 text-center">
            <div className="text-5xl font-black text-[#22C55E]">
              {data.maxCapacity - data.currentOccupancy}
            </div>
            <div className="text-sm font-bold text-white/20 tracking-widest uppercase mt-1">
              seats available
            </div>
          </div>
        )}
      </div>

      {/* Recent activity */}
      {data.recentActivity.length > 0 && (
        <div className="absolute bottom-8 left-8 right-8">
          <div className="flex items-center justify-center gap-6 text-xs text-white/15">
            {data.recentActivity.slice(0, 3).map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${a.type === 'in' ? 'bg-green-500' : 'bg-red-400'}`} />
                <span>{a.name}</span>
                <span className="text-white/10">
                  {new Date(a.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
