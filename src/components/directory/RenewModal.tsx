'use client'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Loader2, Ticket, CheckCircle2, XCircle } from 'lucide-react'
import { PLAN_DEFAULTS, PlanType } from '@/lib/subscriptionLogic'
import type { ReceiptData } from '@/components/dashboard/ReceiptModal'

const PLANS: PlanType[] = ['Daily', 'Weekly', 'Monthly']
const GATEWAYS = ['Cash', 'CliQ', 'eFAWATEERcom', 'Credit Card']

type PlanConfig = Record<PlanType, { price: number; totalVisitsAllowed: number; durationDays: number }>

interface RenewModalProps {
  open: boolean
  onClose: () => void
  studentId: number
  studentName: string
  onRenewed: (data?: ReceiptData) => void
}

export function RenewModal({ open, onClose, studentId, studentName, onRenewed }: RenewModalProps) {
  const [planConfig, setPlanConfig] = useState<PlanConfig>(PLAN_DEFAULTS)
  const [plan, setPlan]         = useState<PlanType>('Monthly')
  const [gateway, setGateway]   = useState('Cash')
  const [amountPaid, setAmount] = useState(PLAN_DEFAULTS.Monthly.price)
  const [startDate, setStart]   = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // Load plan pricing from settings
  useEffect(() => {
    if (!open) return
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then((settings: Record<string, string> | null) => {
        if (!settings) return
        const config = { ...PLAN_DEFAULTS }
        for (const p of PLANS) {
          const priceKey = `plan_${p}_price`
          const visitsKey = `plan_${p}_visits`
          const daysKey = `plan_${p}_days`
          if (settings[priceKey]) config[p] = { ...config[p], price: parseFloat(settings[priceKey]) }
          if (settings[visitsKey]) config[p] = { ...config[p], totalVisitsAllowed: parseInt(settings[visitsKey]) }
          if (settings[daysKey]) config[p] = { ...config[p], durationDays: parseInt(settings[daysKey]) }
        }
        setPlanConfig(config)
        setAmount(config[plan].price)
      })
      .catch(() => {})
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Promo code state
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountType: string; discountAmount: number; bonusEntries: number; id: number } | null>(null)
  const [promoError, setPromoError] = useState('')

  const defaults = planConfig[plan]
  const promoDiscount = promoApplied
    ? promoApplied.discountType === 'PERCENTAGE'
      ? Math.round(amountPaid * promoApplied.discountAmount) / 100
      : promoApplied.discountType === 'BONUS_ENTRIES'
      ? 0
      : promoApplied.discountAmount
    : 0
  const promoBonusEntries = promoApplied?.discountType === 'BONUS_ENTRIES' ? (promoApplied.bonusEntries || 0) : 0
  const finalAmount = Math.max(0, amountPaid - promoDiscount)
  const totalDiscount = Math.max(0, defaults.price - finalAmount)

  const handlePlanChange = (p: PlanType) => {
    setPlan(p)
    setAmount(planConfig[p].price)
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
        body: JSON.stringify({ studentId, planType: plan, gateway, amountPaid: finalAmount, customStartDate: startDate }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to issue subscription.')
        return
      }

      const subData = await res.json()

      if (promoApplied) {
        fetch(`/api/promo/${promoApplied.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timesUsed: true, studentId, discountApplied: promoDiscount }),
        }).catch(() => {})

        // If promo gives bonus entries, add them to the newly created subscription
        if (promoBonusEntries > 0 && subData.subscription?.id) {
          const currentVisits = planConfig[plan].totalVisitsAllowed
          fetch(`/api/subscriptions/${subData.subscription.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalVisitsAllowed: currentVisits + promoBonusEntries }),
          }).catch(() => {})
        }
      }

      const expiry = new Date(startDate)
      expiry.setDate(expiry.getDate() + planConfig[plan].durationDays)

      onRenewed({
        studentName,
        plan,
        amountPaid: finalAmount,
        discount: totalDiscount,
        expiryDate: expiry.toISOString()
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Renew · ${studentName}`} maxWidth="max-w-lg">
      <div className="space-y-6">
        {/* Plan selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Subscription Plan</label>
          <div className="grid grid-cols-3 gap-3">
            {PLANS.map((p) => (
              <button
                key={p}
                onClick={() => handlePlanChange(p)}
                className={`flex flex-col items-center p-4 rounded-xl border transition-all duration-200 cursor-pointer
                  ${plan === p
                    ? 'border-[#F5C518] bg-[rgba(245,197,24,0.1)] text-[#F5C518] shadow-[0_0_20px_rgba(245,197,24,0.1)] scale-[1.02]'
                    : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:bg-white/8'}`}
              >
                <span className={`font-black text-2xl ${plan === p ? 'text-[#F5C518]' : 'text-white/80'}`}>{planConfig[p].price} <span className="text-sm font-medium">JD</span></span>
                <span className="text-sm font-semibold mt-1">{p}</span>
                <span className="text-[10px] opacity-60 mt-1.5 text-center leading-tight">
                  {planConfig[p].totalVisitsAllowed >= 999 ? 'Unlimited' : `${planConfig[p].totalVisitsAllowed} visits`} / {planConfig[p].durationDays} days
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStart(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Payment Method</label>
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
            Promo Code
          </label>
          {promoApplied ? (
            <div className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', animation: 'fadeIn 0.3s ease-out' }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="font-mono font-bold text-sm text-green-400">{promoApplied.code}</span>
                <span className="text-xs text-green-400/70">
                  {promoApplied.discountType === 'PERCENTAGE' ? `${promoApplied.discountAmount}% off` : promoApplied.discountType === 'BONUS_ENTRIES' ? `+${promoApplied.bonusEntries} bonus entries` : `−${promoApplied.discountAmount} JD`}
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
                placeholder="Enter promo code"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-mono text-white outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all placeholder:text-white/20"
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyPromo() }}
              />
              <button
                onClick={handleApplyPromo}
                disabled={promoLoading || !promoInput.trim()}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 border border-white/10"
              >
                {promoLoading ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
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
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">Amount Paid (JD)</label>
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
                  Total Discount: {totalDiscount} JD
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
              Final charge: <span className="font-bold text-white">{finalAmount} JD</span>
              <span className="line-through text-white/20 ml-2">{amountPaid} JD</span>
            </p>
          )}
          {promoBonusEntries > 0 && (
            <p className="text-sm text-green-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              +{promoBonusEntries} bonus entries will be added to subscription
            </p>
          )}
        </div>

        {error && <p className="text-sm font-medium text-red-400 p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1 py-6 bg-white/5 border-white/10 text-white hover:bg-white/10">Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="flex-[2] py-6 text-base font-bold shadow-lg bg-[#F5C518] hover:bg-[#D4A017] text-black">
            {saving && <Loader2 size={18} className="animate-spin mr-2" />}
            {saving ? 'Processing...' : `Confirm ${plan} · ${finalAmount} JD`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
