'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Banknote, X, Loader2, Lock, Unlock, AlertTriangle, FileText } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface RegisterData {
  id: number
  userId: number
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
}

interface RegisterSummary {
  openRegister: RegisterData | null
  todayCash: number
  todayCard: number
  todayOther: number
  todayTotal: number
  orderCount: number
}

export function CashRegisterBar({ onOrderPlaced }: { onOrderPlaced?: number }) {
  const { t } = useI18n()
  const [summary, setSummary] = useState<RegisterSummary | null>(null)
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showReceipt, setShowReceipt] = useState<RegisterData | null>(null)
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/cash-register/summary')
      if (res.ok) setSummary(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadSummary() }, [loadSummary, onOrderPlaced])

  const handleOpen = async () => {
    const amt = parseFloat(openingCash)
    if (isNaN(amt) || amt < 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingCash: amt }),
      })
      if (res.ok) {
        setShowOpen(false)
        setOpeningCash('')
        loadSummary()
      }
    } finally { setLoading(false) }
  }

  const handleClose = async () => {
    if (!summary?.openRegister) return
    const amt = parseFloat(closingCash)
    if (isNaN(amt) || amt < 0) return
    setLoading(true)
    try {
      const res = await fetch(`/api/cash-register/${summary.openRegister.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closingCash: amt, notes: closeNotes.trim() || null }),
      })
      if (res.ok) {
        const closed = await res.json()
        setShowClose(false)
        setClosingCash('')
        setCloseNotes('')
        setShowReceipt(closed)
        loadSummary()
      }
    } finally { setLoading(false) }
  }

  const reg = summary?.openRegister

  return (
    <>
      {/* Register Bar / Open Button */}
      {reg ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-green-500/20 bg-green-500/5"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Unlock size={14} className="text-green-400" />
              <span className="text-xs font-bold text-green-400 uppercase tracking-wider">{t('register.open')}</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-white/50">{t('register.opening')}: <span className="text-white font-bold">{reg.openingCash.toFixed(2)}</span></span>
              <span className="text-white/50">{t('register.cashSales')}: <span className="text-green-400 font-bold">{reg.cashSales.toFixed(2)}</span></span>
              <span className="text-white/50">{t('register.cardSales')}: <span className="text-blue-400 font-bold">{reg.cardSales.toFixed(2)}</span></span>
              <span className="text-white/50">{t('register.total')}: <span className="text-[#F5C518] font-bold">{(reg.cashSales + reg.cardSales).toFixed(2)} JD</span></span>
            </div>
          </div>
          <button
            onClick={() => { setShowClose(true); setClosingCash(''); setCloseNotes('') }}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-1.5 hover:bg-red-500/20 transition-all"
          >
            <Lock size={12} /> {t('register.close')}
          </button>
        </motion.div>
      ) : (
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => { setShowOpen(true); setOpeningCash('') }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#F5C518]/30 text-[#F5C518]/70 hover:text-[#F5C518] hover:border-[#F5C518]/50 hover:bg-[#F5C518]/5 text-xs font-bold transition-all"
        >
          <Banknote size={14} /> {t('register.openRegister')}
        </motion.button>
      )}

      {/* Open Register Modal */}
      <AnimatePresence>
        {showOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOpen(false)} />
            <motion.div className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <button onClick={() => setShowOpen(false)} className="absolute top-3 right-3 text-white/30 hover:text-white"><X size={18} /></button>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Banknote size={18} className="text-[#F5C518]" /> {t('register.openRegister')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('register.openingAmount')}</label>
                  <input
                    type="text" inputMode="decimal" autoFocus
                    value={openingCash}
                    onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setOpeningCash(e.target.value) }}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-3 text-lg font-bold focus:outline-none placeholder-white/20 transition-all text-center"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowOpen(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all">{t('common.cancel')}</button>
                  <button onClick={handleOpen} disabled={loading || !openingCash} className="flex-1 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                    {t('register.openRegister')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close Register Modal */}
      <AnimatePresence>
        {showClose && reg && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowClose(false)} />
            <motion.div className="relative w-full max-w-md rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <button onClick={() => setShowClose(false)} className="absolute top-3 right-3 text-white/30 hover:text-white"><X size={18} /></button>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Lock size={18} className="text-red-400" /> {t('register.closeRegister')}
              </h3>

              <div className="space-y-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">{t('register.openingAmount')}</span>
                  <span className="text-white font-bold">{reg.openingCash.toFixed(2)} JD</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">{t('register.cashSales')}</span>
                  <span className="text-green-400 font-bold">+{reg.cashSales.toFixed(2)} JD</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">{t('register.cardSales')}</span>
                  <span className="text-blue-400 font-bold">{reg.cardSales.toFixed(2)} JD</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                  <span className="text-white/70 font-bold">{t('register.expectedCash')}</span>
                  <span className="text-[#F5C518] font-bold">{(reg.openingCash + reg.cashSales).toFixed(2)} JD</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('register.actualCash')}</label>
                  <input
                    type="text" inputMode="decimal" autoFocus
                    value={closingCash}
                    onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setClosingCash(e.target.value) }}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-3 text-lg font-bold focus:outline-none placeholder-white/20 transition-all text-center"
                    placeholder="0.00"
                  />
                </div>

                {closingCash && (
                  <div className="p-3 rounded-xl border" style={{
                    background: (() => {
                      const diff = parseFloat(closingCash) - (reg.openingCash + reg.cashSales)
                      return diff >= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)'
                    })(),
                    borderColor: (() => {
                      const diff = parseFloat(closingCash) - (reg.openingCash + reg.cashSales)
                      return diff >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'
                    })(),
                  }}>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">{t('register.discrepancy')}</span>
                      {(() => {
                        const diff = parseFloat(closingCash) - (reg.openingCash + reg.cashSales)
                        return (
                          <span className={`font-bold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(2)} JD
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('register.notes')}</label>
                  <textarea
                    value={closeNotes}
                    onChange={e => setCloseNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all resize-none"
                    placeholder={t('register.notesPlaceholder')}
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setShowClose(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all">{t('common.cancel')}</button>
                  <button onClick={handleClose} disabled={loading || !closingCash} className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    {t('register.closeRegister')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close Receipt Summary */}
      <AnimatePresence>
        {showReceipt && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReceipt(null)} />
            <motion.div className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <button onClick={() => setShowReceipt(null)} className="absolute top-3 right-3 text-white/30 hover:text-white"><X size={18} /></button>
              <div className="text-center mb-4">
                <FileText size={32} className="text-[#F5C518] mx-auto mb-2" />
                <h3 className="text-lg font-bold text-white">{t('register.closeSummary')}</h3>
              </div>
              <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/5 mb-4">
                <div className="flex justify-between text-sm"><span className="text-white/50">{t('register.openingAmount')}</span><span className="text-white font-bold">{showReceipt.openingCash.toFixed(2)} JD</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">{t('register.cashSales')}</span><span className="text-green-400 font-bold">+{showReceipt.cashSales.toFixed(2)} JD</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">{t('register.cardSales')}</span><span className="text-blue-400 font-bold">{showReceipt.cardSales.toFixed(2)} JD</span></div>
                <div className="flex justify-between text-sm border-t border-white/5 pt-2"><span className="text-white/70 font-bold">{t('register.expectedCash')}</span><span className="text-[#F5C518] font-bold">{showReceipt.expectedCash?.toFixed(2)} JD</span></div>
                <div className="flex justify-between text-sm"><span className="text-white/50">{t('register.actualCash')}</span><span className="text-white font-bold">{showReceipt.closingCash?.toFixed(2)} JD</span></div>
                <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                  <span className="text-white/70 font-bold">{t('register.discrepancy')}</span>
                  <span className={`font-bold ${(showReceipt.cashDiscrepancy ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(showReceipt.cashDiscrepancy ?? 0) >= 0 ? '+' : ''}{showReceipt.cashDiscrepancy?.toFixed(2)} JD
                  </span>
                </div>
                {showReceipt.notes && (
                  <div className="text-xs text-white/40 pt-2 border-t border-white/5">{t('register.notes')}: {showReceipt.notes}</div>
                )}
              </div>
              <button onClick={() => setShowReceipt(null)} className="w-full py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all">{t('common.done')}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export function useOpenRegisterCheck() {
  const [hasOpenRegister, setHasOpenRegister] = useState(false)

  useEffect(() => {
    fetch('/api/cash-register/summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.openRegister) setHasOpenRegister(true); else setHasOpenRegister(false) })
      .catch(() => {})
  }, [])

  return hasOpenRegister
}
