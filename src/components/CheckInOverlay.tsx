'use client'
import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, User, Calendar, Hash } from 'lucide-react'
import { useHiveStore, CheckInResult } from '@/lib/store'
import { useAudio } from '@/hooks/useAudio'

const DISMISS_AFTER = 4000

export function CheckInOverlay() {
  const { overlay, setOverlay } = useHiveStore()
  const { playSuccess, playError } = useAudio()
  const [progress, setProgress] = useState(100)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!overlay) { setProgress(100); return }

    if (overlay.status === 'OK' || overlay.status === 'ALREADY_IN') playSuccess()
    else                          playError()

    setProgress(100)
    const started = Date.now()

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - started
      setProgress(Math.max(0, 100 - (elapsed / DISMISS_AFTER) * 100))
    }, 50)

    timerRef.current = setTimeout(() => setOverlay(null), DISMISS_AFTER)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current)   clearTimeout(timerRef.current)
    }
  }, [overlay, playSuccess, playError, setOverlay])

  if (!overlay) return null

  const ok = overlay.status === 'OK' || overlay.status === 'ALREADY_IN'

  let expiringSoon = false
  if (ok && overlay.subscription) {
    const visitsLeft = overlay.remainingVisits;
    const daysLeft = Math.ceil((new Date(overlay.subscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if ((visitsLeft !== null && visitsLeft !== undefined && visitsLeft <= 2) || daysLeft <= 2) {
      expiringSoon = true;
    }
  }

  let bg = 'bg-black/70'
  let border = 'border-red-500/30'
  let accent = '#DC2626'
  let Icon = XCircle

  if (ok) {
    if (expiringSoon) {
      bg = 'bg-black/70'
      border = 'border-yellow-500/30'
      accent = '#F5C518'
      Icon = AlertTriangle
    } else {
      bg = 'bg-black/70'
      border = 'border-green-500/30'
      accent = '#16A34A'
      Icon = CheckCircle
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${bg} backdrop-blur-md overlay-enter`}
      onClick={() => setOverlay(null)}
    >
      <div className={`flex flex-col items-center gap-6 p-10 rounded-3xl border-2 ${border} max-w-lg w-full mx-4`}
        style={{ background: 'rgba(15, 15, 15, 0.95)', backdropFilter: 'blur(24px)', boxShadow: '0 20px 80px rgba(0,0,0,0.5)' }}
      >
        <Icon size={96} color={accent} strokeWidth={1.5} className="drop-shadow-lg" />

        <div className="text-center space-y-2">
          <p className="text-4xl font-black text-white tracking-tight">{overlay.student?.fullName ?? 'Unknown'}</p>
          {overlay.student?.phone && (
            <p className="text-lg font-bold" style={{ color: accent }}>{overlay.student.phone}</p>
          )}
        </div>

        {ok ? (
          <div className="flex flex-col items-center w-full gap-5">
            <div className="flex flex-col items-center justify-center w-full rounded-xl py-6"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1">Visits Remaining</span>
              <span className="text-[5rem] leading-none font-black tracking-tighter" style={{ color: accent }}>
                {overlay.remainingVisits === null ? '∞' : overlay.remainingVisits}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full text-sm">
              <Stat icon={<Calendar size={16} />} label="Plan Type" value={overlay.subscription?.planType ?? '—'} accent={accent} />
              <Stat icon={<User size={16} />} label="Status" value={expiringSoon ? 'Expiring Soon' : 'Active'} accent={accent} />
            </div>

            {overlay.status === 'ALREADY_IN' ? (
              <p className="text-sm font-bold text-[#F5C518] mt-2 px-4 py-2 rounded-lg"
                style={{ background: 'rgba(245, 197, 24, 0.1)', border: '1px solid rgba(245, 197, 24, 0.2)' }}
              >
                Already inside — no new entry created
              </p>
            ) : overlay.alreadyCheckedInToday && (
              <p className="text-xs font-bold text-[#F5C518] mt-2 px-3 py-1.5 rounded-md"
                style={{ background: 'rgba(245, 197, 24, 0.1)', border: '1px solid rgba(245, 197, 24, 0.2)' }}
              >
                Re-entry today — No visit deducted
              </p>
            )}
          </div>
        ) : (
          <div className="text-center w-full p-6 rounded-xl mt-4"
            style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
          >
            <p className="text-red-400 font-bold text-lg mb-2">{overlay.reason}</p>
            {overlay.student && (
              <a
                href={`/directory?student=${overlay.student.id}`}
                className="inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg text-sm mt-4 transition-colors shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                Open profile to renew
              </a>
            )}
          </div>
        )}

        <p className="text-[10px] font-bold tracking-widest uppercase text-white/25 mt-4">Click anywhere to dismiss</p>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-1.5 transition-none" style={{ width: `${progress}%`, backgroundColor: accent }} />
    </div>
  )
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-4 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-white/30">{icon}{label}</span>
      <span className="font-black text-lg" style={{ color: accent }}>{value}</span>
    </div>
  )
}
