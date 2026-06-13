'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { todayString } from '@/lib/subscriptionLogic'
import { Loader2, Ticket, CheckCircle2, XCircle, AlertTriangle, LogIn, Printer } from 'lucide-react'
import { PLAN_DEFAULTS, PlanType } from '@/lib/subscriptionLogic'
import type { ReceiptData } from '@/components/dashboard/ReceiptModal'
import { useI18n } from '@/lib/i18n'

interface ApiPlan {
  id: number
  name: string
  nameAr?: string
  durationDays: number
  totalVisits: number
  price: number
  isActive: boolean
  sortOrder: number
}

interface PlanOption {
  id: number | null // null for hardcoded fallback plans
  name: string
  nameAr?: string
  price: number
  totalVisitsAllowed: number
  durationDays: number
}

const GATEWAYS = ['Cash', 'CliQ', 'eFAWATEERcom', 'Credit Card']

interface RenewModalProps {
  open: boolean
  onClose: () => void
  studentId: number
  studentName: string
  onRenewed: (data?: ReceiptData) => void
}

export function RenewModal({ open, onClose, studentId, studentName, onRenewed }: RenewModalProps) {
  const { t, lang } = useI18n()
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0)
  const [gateway, setGateway]   = useState('Cash')
  const [amountPaid, setAmount] = useState(0)
  const [startDate, setStart]   = useState(todayString())
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [plansWarning, setPlansWarning] = useState(false)
  const [activeSessionMsg, setActiveSessionMsg] = useState('')

  // Success state after subscription creation — shows "Check In Now" option
  const [success, setSuccess] = useState(false)
  const [pendingReceipt, setPendingReceipt] = useState<ReceiptData | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; message: string } | null>(null)

  // F13: Current subscription info for early-renewal warning
  const [currentSub, setCurrentSub] = useState<{ daysLeft: number; entriesLeft: number | null } | null>(null)

  // Reset success state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSuccess(false)
      setPendingReceipt(null)
      setCheckingIn(false)
      setCheckInResult(null)
      setActiveSessionMsg('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    // Fetch student's current active subscription to warn about early renewal
    fetch(`/api/students/${studentId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        const activeSub = data.subscriptions?.find((s: { isActive: boolean; expiryDate: string }) => s.isActive && new Date(s.expiryDate) > new Date())
        if (activeSub) {
          const daysLeft = Math.max(0, Math.ceil((new Date(activeSub.expiryDate).getTime() - Date.now()) / 86400000))
          const entriesLeft = activeSub.totalVisitsAllowed === -1 ? null : Math.max(0, activeSub.totalVisitsAllowed - activeSub.visitsUsed)
          if (daysLeft > 0 || (entriesLeft !== null && entriesLeft > 0)) {
            setCurrentSub({ daysLeft, entriesLeft })
          } else {
            setCurrentSub(null)
          }
        } else {
          setCurrentSub(null)
        }
      })
      .catch(() => setCurrentSub(null))
  }, [open, studentId])

  // Load plans from API, fallback to PLAN_DEFAULTS
  useEffect(() => {
    if (!open) return
    fetch('/api/plans')
      .then(r => r.ok ? r.json() : null)
      .then((apiPlans: ApiPlan[] | null) => {
        if (apiPlans && apiPlans.length > 0) {
          const activePlans = apiPlans.filter(p => p.isActive)
          if (activePlans.length > 0) {
            const opts: PlanOption[] = activePlans.map(p => ({
              id: p.id,
              name: p.name,
              nameAr: p.nameAr || undefined,
              price: p.price,
              totalVisitsAllowed: p.totalVisits === -1 ? 999 : p.totalVisits,
              durationDays: p.durationDays,
            }))
            setPlans(opts)
            setSelectedPlanIdx(opts.length > 2 ? opts.length - 1 : 0)
            setAmount(opts.length > 2 ? opts[opts.length - 1].price : opts[0].price)
            setPlansWarning(false)
            return
          }
        }
        // Fallback to hardcoded defaults
        const fallback: PlanOption[] = (['Daily', 'Weekly', 'Monthly'] as PlanType[]).map(p => ({
          id: null,
          name: p,
          price: PLAN_DEFAULTS[p].price,
          totalVisitsAllowed: PLAN_DEFAULTS[p].totalVisitsAllowed,
          durationDays: PLAN_DEFAULTS[p].durationDays,
        }))
        setPlans(fallback)
        setSelectedPlanIdx(2) // Monthly
        setAmount(PLAN_DEFAULTS.Monthly.price)
        setPlansWarning(true)
      })
      .catch(() => {
        // Fallback to hardcoded defaults
        const fallback: PlanOption[] = (['Daily', 'Weekly', 'Monthly'] as PlanType[]).map(p => ({
          id: null,
          name: p,
          price: PLAN_DEFAULTS[p].price,
          totalVisitsAllowed: PLAN_DEFAULTS[p].totalVisitsAllowed,
          durationDays: PLAN_DEFAULTS[p].durationDays,
        }))
        setPlans(fallback)
        setSelectedPlanIdx(2)
        setAmount(PLAN_DEFAULTS.Monthly.price)
        setPlansWarning(true)
      })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Promo code state
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountType: string; discountAmount: number; bonusEntries: number; id: number } | null>(null)
  const [promoError, setPromoError] = useState('')

  const selectedPlan = plans[selectedPlanIdx] || { id: null, name: 'Monthly', price: 50, totalVisitsAllowed: 30, durationDays: 40 }
  const promoDiscount = promoApplied
    ? promoApplied.discountType === 'PERCENTAGE'
      ? Math.round(amountPaid * promoApplied.discountAmount) / 100
      : promoApplied.discountType === 'BONUS_ENTRIES'
      ? 0
      : promoApplied.discountAmount
    : 0
  const promoBonusEntries = promoApplied?.discountType === 'BONUS_ENTRIES' ? (promoApplied.bonusEntries || 0) : 0
  const finalAmount = Math.max(0, amountPaid - promoDiscount)
  const totalDiscount = Math.max(0, selectedPlan.price - finalAmount)

  const handlePlanChange = (idx: number) => {
    setSelectedPlanIdx(idx)
    setAmount(plans[idx].price)
  }

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return
    setPromoLoading(true); setPromoError('')
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput.trim() }),
      })
      const data = await res.json()
      if (data.valid) {
        setPromoApplied({ code: data.code, discountType: data.discountType || 'AMOUNT', discountAmount: data.discountAmount, bonusEntries: data.bonusEntries || 0, id: data.id })
        setPromoError('')
      } else {
        setPromoError(data.error || 'Invalid promo code')
        setPromoApplied(null)
      }
    } catch {
      setPromoError('Failed to validate code')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleRemovePromo = () => {
    setPromoApplied(null)
    setPromoInput('')
    setPromoError('')
  }

  const handleSubmit = async () => {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          planType: selectedPlan.name,
          gateway,
          amountPaid: finalAmount,
          customStartDate: startDate,
          planId: selectedPlan.id,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? t('renew.failed'))
        return
      }

      const subData = await res.json()

      // F12: Show active session warning if student was checked in under old subscription
      if (subData.activeSessionWarning) {
        setActiveSessionMsg(t('renew.activeSessionWarning'))
      }

      if (promoApplied) {
        fetch(`/api/promo/${promoApplied.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timesUsed: true, studentId, discountApplied: promoDiscount }),
        }).catch(() => {})

        // If promo gives bonus entries, add them to the newly created subscription
        if (promoBonusEntries > 0 && subData.subscription?.id) {
          const currentVisits = selectedPlan.totalVisitsAllowed
          fetch(`/api/subscriptions/${subData.subscription.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalVisitsAllowed: currentVisits + promoBonusEntries }),
          }).catch(() => {})
        }
      }

      const expiry = new Date(startDate)
      expiry.setDate(expiry.getDate() + selectedPlan.durationDays)

      // Store receipt data and show success state with "Check In Now" option
      setPendingReceipt({
        studentName,
        plan: selectedPlan.name,
        amountPaid: finalAmount,
        discount: totalDiscount,
        expiryDate: expiry.toISOString(),
        receiptNumber: subData.receiptNumber || undefined,
        transactionId: subData.transaction?.id || undefined,
      })
      setSuccess(true)
    } finally {
      setSaving(false)
    }
  }

  const handleCheckInNow = async () => {
    setCheckingIn(true)
    setCheckInResult(null)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const data = await res.json()
      if (res.ok && (data.status === 'OK' || data.status === 'ALREADY_IN')) {
        setCheckInResult({ success: true, message: t('dash.checkedInSuccess') })
        onRenewed(pendingReceipt ?? undefined)
        // Auto-close after brief success display
        setTimeout(() => onClose(), 1500)
      } else {
        setCheckInResult({ success: false, message: data.reason || data.error || t('dash.checkInFailed') })
      }
    } catch {
      setCheckInResult({ success: false, message: t('dash.connectionError') })
    } finally {
      setCheckingIn(false)
    }
  }

  const handleDoneClose = () => {
    onRenewed(pendingReceipt ?? undefined)
    onClose()
  }

  // Success state — subscription created, offer "Check In Now"
  if (success) {
    return (
      <Modal open={open} onClose={handleDoneClose} title={`${t('renew.title')} · ${studentName}`} maxWidth="max-w-lg">
        <div className="flex flex-col items-center text-center py-6" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(34, 197, 94, 0.1)', border: '2px solid rgba(34, 197, 94, 0.3)' }}
          >
            <CheckCircle2 size={40} className="text-green-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{t('renew.subscriptionCreated')}</h3>
          <p className="text-sm text-white/40 mb-6">{studentName}</p>

          {/* F12: Active session warning */}
          {activeSessionMsg && (
            <div className="w-full flex items-start gap-2 text-sm font-medium text-blue-400 p-3 rounded-lg mb-4" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{activeSessionMsg}</span>
            </div>
          )}

          {checkInResult && (
            <div className={`w-full px-4 py-3 rounded-xl text-sm font-medium mb-4 ${
              checkInResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {checkInResult.message}
            </div>
          )}

          <div className="w-full space-y-3">
            <button
              onClick={handleCheckInNow}
              disabled={checkingIn || checkInResult?.success}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 text-green-400 font-bold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
            >
              {checkingIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {checkingIn ? t('common.loading') : t('renew.checkInNow')}
            </button>

            <button
              onClick={() => {
                if (pendingReceipt?.transactionId) {
                  window.open(`/subscription/receipt/${pendingReceipt.transactionId}`, '_blank')
                } else if (pendingReceipt?.receiptNumber) {
                  window.open(`/barista/receipt/${pendingReceipt.receiptNumber}`, '_blank')
                }
              }}
              disabled={!pendingReceipt?.transactionId && !pendingReceipt?.receiptNumber}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white font-bold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Printer size={16} />
              {t('receipt.print')}
            </button>

            <button
              onClick={handleDoneClose}
              className="w-full py-3 text-sm text-white/25 hover:text-white/40 font-medium transition-colors"
            >
              {t('renew.doneClose')}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={`${t('renew.title')} · ${studentName}`} maxWidth="max-w-lg">
      <div className="space-y-6">
        {/* F13: Early renewal warning */}
        {currentSub && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-amber-300">
              {t('renew.currentSubWarning')
                .replace('{days}', String(currentSub.daysLeft))
                .replace('{entries}', currentSub.entriesLeft !== null ? String(currentSub.entriesLeft) : '∞')}
            </p>
          </div>
        )}

        {/* Plan selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">{t('renew.plan')}</label>
          {plansWarning && (
            <div className="flex items-center gap-2 text-xs text-amber-400/80 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <AlertTriangle size={12} /> {t('renew.usingDefaults')}
            </div>
          )}
          <div className={`grid gap-3 ${plans.length <= 3 ? 'grid-cols-3' : plans.length <= 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {plans.map((p, idx) => (
              <button
                key={p.id ?? p.name}
                onClick={() => handlePlanChange(idx)}
                className={`flex flex-col items-center p-4 rounded-xl border transition-all duration-200 cursor-pointer
                  ${selectedPlanIdx === idx
                    ? 'border-[#F5C518] bg-[rgba(245,197,24,0.1)] text-[#F5C518] shadow-[0_0_20px_rgba(245,197,24,0.1)] scale-[1.02]'
                    : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:bg-white/8'}`}
              >
                <span className={`font-black text-2xl ${selectedPlanIdx === idx ? 'text-[#F5C518]' : 'text-white/80'}`}>{p.price} <span className="text-sm font-medium">JD</span></span>
                <span className="text-sm font-semibold mt-1">{lang === 'ar' && p.nameAr ? p.nameAr : p.name}</span>
                <span className="text-[10px] opacity-60 mt-1.5 text-center leading-tight">
                  {p.totalVisitsAllowed >= 999 ? t('renew.unlimited') : `${p.totalVisitsAllowed} ${t('renew.visits')}`} / {p.durationDays} {t('renew.days')}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">{t('renew.startDate')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStart(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">{t('renew.paymentMethod')}</label>
            <select
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all"
              style={{ colorScheme: 'dark' }}
            >
              {GATEWAYS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Promo Code */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
            <Ticket size={12} className="text-white/25" />
            {t('renew.promoCode')}
          </label>
          {promoApplied ? (
            <div className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', animation: 'fadeIn 0.3s ease-out' }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="font-mono font-bold text-sm text-green-400">{promoApplied.code}</span>
                <span className="text-xs text-green-400/70">
                  {promoApplied.discountType === 'PERCENTAGE' ? `${promoApplied.discountAmount}% ${t('renew.promoOff')}` : promoApplied.discountType === 'BONUS_ENTRIES' ? `+${promoApplied.bonusEntries} ${t('renew.bonusEntries')}` : `−${promoApplied.discountAmount} JD`}
                </span>
              </div>
              <button onClick={handleRemovePromo} className="text-green-400/50 hover:text-red-400 transition-colors">
                <XCircle size={18} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError('') }}
                placeholder={t('renew.enterPromo')}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-mono text-white outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all placeholder:text-white/20"
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyPromo() }}
              />
              <button
                onClick={handleApplyPromo}
                disabled={promoLoading || !promoInput.trim()}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 border border-white/10"
              >
                {promoLoading ? <Loader2 size={14} className="animate-spin" /> : t('renew.apply')}
              </button>
            </div>
          )}
          {promoError && (
            <p className="text-xs text-red-400 font-medium flex items-center gap-1">
              <XCircle size={12} /> {promoError}
            </p>
          )}
        </div>

        {/* Amount Paid */}
        <div className="space-y-2 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex justify-between items-end">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">{t('renew.amountPaid')}</label>
            <div className="flex items-center gap-2">
              {promoDiscount > 0 && (
                <span className="text-xs font-semibold text-green-400 px-2 py-0.5 rounded"
                  style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                >
                  Promo: −{promoDiscount} JD
                </span>
              )}
              {totalDiscount > 0 && (
                <span className="text-xs font-semibold text-[#F5C518] px-2 py-0.5 rounded"
                  style={{ background: 'rgba(245, 197, 24, 0.1)', border: '1px solid rgba(245, 197, 24, 0.2)' }}
                >
                  {t('renew.totalDiscount')}: {totalDiscount} JD
                </span>
              )}
            </div>
          </div>
          <input
            type="number"
            value={amountPaid}
            min={0}
            step={0.5}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-lg font-bold text-white outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all"
          />
          {promoDiscount > 0 && (
            <p className="text-sm text-white/30">
              {t('renew.finalCharge')} <span className="font-bold text-white">{finalAmount} JD</span>
              <span className="line-through text-white/20 ml-2">{amountPaid} JD</span>
            </p>
          )}
          {promoBonusEntries > 0 && (
            <p className="text-sm text-green-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              +{promoBonusEntries} {t('renew.bonusEntriesAdded')}
            </p>
          )}
        </div>

        {/* F12: Active session warning after renewal */}
        {activeSessionMsg && (
          <div className="flex items-start gap-2 text-sm font-medium text-blue-400 p-3 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{activeSessionMsg}</span>
          </div>
        )}
        {error && <p className="text-sm font-medium text-red-400 p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1 py-6 bg-white/5 border-white/10 text-white hover:bg-white/10">{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving} className="flex-[2] py-6 text-base font-bold shadow-lg bg-[#F5C518] hover:bg-[#D4A017] text-black">
            {saving && <Loader2 size={18} className="animate-spin mr-2" />}
            {saving ? t('renew.processing') : `${t('renew.confirm')} ${selectedPlan.name} · ${finalAmount} JD`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
