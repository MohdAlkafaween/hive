'use client'
import { useState, useEffect } from 'react'
import { Loader2, Banknote, ChevronDown, ChevronUp } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface Register {
  id: number
  userName: string
  status: string
  openingCash: number
  closingCash: number | null
  expectedCash: number | null
  cashSales: number
  cardSales: number
  cashDiscrepancy: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export function RegistersSection() {
  const { t } = useI18n()
  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/cash-register')
      .then(r => r.ok ? r.json() : [])
      .then(setRegisters)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-white/30" /></div>

  return (
    <div className="space-y-2">
      {registers.length === 0 ? (
        <p className="text-center text-white/25 text-sm py-8">{t('register.noRegisters')}</p>
      ) : (
        registers.map(reg => (
          <div key={reg.id} className="rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === reg.id ? null : reg.id)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-3">
                <Banknote size={16} className={reg.status === 'OPEN' ? 'text-green-400' : 'text-white/30'} />
                <div>
                  <span className="text-sm font-bold text-white">{reg.userName}</span>
                  <span className="text-xs text-white/30 ms-2">{new Date(reg.createdAt).toLocaleDateString()} {new Date(reg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${reg.status === 'OPEN' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-white/5 text-white/30 border border-white/10'}`}>
                  {reg.status === 'OPEN' ? t('register.open') : t('register.closed')}
                </span>
                {reg.cashDiscrepancy !== null && (
                  <span className={`text-xs font-bold ${reg.cashDiscrepancy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {reg.cashDiscrepancy >= 0 ? '+' : ''}{reg.cashDiscrepancy.toFixed(2)}
                  </span>
                )}
                {expanded === reg.id ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
              </div>
            </button>

            {expanded === reg.id && (
              <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-1.5">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-white/3"><span className="text-white/40">{t('register.openingAmount')}</span><div className="text-white font-bold">{reg.openingCash.toFixed(2)} JD</div></div>
                  <div className="p-2 rounded-lg bg-white/3"><span className="text-white/40">{t('register.cashSales')}</span><div className="text-green-400 font-bold">+{reg.cashSales.toFixed(2)} JD</div></div>
                  <div className="p-2 rounded-lg bg-white/3"><span className="text-white/40">{t('register.cardSales')}</span><div className="text-blue-400 font-bold">{reg.cardSales.toFixed(2)} JD</div></div>
                  {reg.closingCash !== null && (
                    <>
                      <div className="p-2 rounded-lg bg-white/3"><span className="text-white/40">{t('register.expectedCash')}</span><div className="text-[#F5C518] font-bold">{reg.expectedCash?.toFixed(2)} JD</div></div>
                      <div className="p-2 rounded-lg bg-white/3"><span className="text-white/40">{t('register.actualCash')}</span><div className="text-white font-bold">{reg.closingCash.toFixed(2)} JD</div></div>
                      <div className="p-2 rounded-lg bg-white/3">
                        <span className="text-white/40">{t('register.discrepancy')}</span>
                        <div className={`font-bold ${(reg.cashDiscrepancy ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {(reg.cashDiscrepancy ?? 0) >= 0 ? '+' : ''}{reg.cashDiscrepancy?.toFixed(2)} JD
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {reg.notes && (
                  <div className="text-xs text-white/40 p-2 rounded-lg bg-white/3">{t('register.notes')}: {reg.notes}</div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
