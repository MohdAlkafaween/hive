'use client'
import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'
import { Clock, CheckCircle2, XCircle, Loader2, Coffee, ChefHat, Bell, Star } from 'lucide-react'

interface OrderItem { id: number; menuItemId: number | null; name: string; nameAr: string | null; quantity: number; price: number; status: string; note: string | null; options: string }
interface Order { orderGroupId: string; receiptNumber: string; status: string; createdAt: string; paymentMethod: string | null; items: OrderItem[]; total: number; note: string | null }

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  PENDING: { color: 'text-yellow-400', bg: 'bg-yellow-500/15', icon: Clock, label: 'customer.statusPending' },
  ACCEPTED: { color: 'text-blue-400', bg: 'bg-blue-500/15', icon: Coffee, label: 'customer.statusAccepted' },
  PREPARING: { color: 'text-orange-400', bg: 'bg-orange-500/15', icon: ChefHat, label: 'customer.statusPreparing' },
  READY: { color: 'text-green-400', bg: 'bg-green-500/15', icon: Bell, label: 'customer.statusReady' },
  COMPLETED: { color: 'text-white/30', bg: 'bg-white/5', icon: CheckCircle2, label: 'customer.statusCompleted' },
  CANCELLED: { color: 'text-red-400/50', bg: 'bg-red-500/10', icon: XCircle, label: 'customer.statusCancelled' },
}

const STEPS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY']

export default function CustomerOrdersPage() {
  const { t, lang } = useI18n()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStatusMapRef = useRef<Map<string, string>>(new Map())
  const isFirstLoad = useRef(true)
  const [feedbackEnabled, setFeedbackEnabled] = useState(false)
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null)
  const [ratings, setRatings] = useState<Record<number, number>>({})
  const [comments, setComments] = useState<Record<number, string>>({})
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const ratedOrdersRef = useRef<Set<string>>(new Set())

  // Check if feedback is enabled
  useEffect(() => {
    fetch('/api/settings/public')
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, string>) => {
        if (s.feedbackEnabled === 'true') setFeedbackEnabled(true)
      })
      .catch(() => {})
  }, [])

  const fetchOrders = () => {
    fetch('/api/customer/orders')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.orders) {
          const newOrders: Order[] = data.orders
          // Check for orders that just became COMPLETED — prompt for feedback
          if (feedbackEnabled) {
            for (const order of newOrders) {
              const prev = prevStatusMapRef.current.get(order.orderGroupId)
              if (prev && prev !== 'COMPLETED' && order.status === 'COMPLETED' && !ratedOrdersRef.current.has(order.orderGroupId)) {
                ratedOrdersRef.current.add(order.orderGroupId)
                setRatingOrder(order)
                break // one at a time
              }
            }
          }
          // Update previous status map
          const newMap = new Map<string, string>()
          for (const order of newOrders) newMap.set(order.orderGroupId, order.status)
          prevStatusMapRef.current = newMap
          isFirstLoad.current = false
          setOrders(newOrders)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrders()
    intervalRef.current = setInterval(fetchOrders, 10000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeOrders = orders.filter(o => ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status))
  const pastOrders = orders.filter(o => ['COMPLETED', 'CANCELLED'].includes(o.status))

  // Stop polling if no active orders
  useEffect(() => {
    if (activeOrders.length === 0 && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    } else if (activeOrders.length > 0 && !intervalRef.current) {
      intervalRef.current = setInterval(fetchOrders, 10000)
    }
  }, [activeOrders.length])

  const cancelOrder = async (groupId: string) => {
    setCancelling(groupId)
    try {
      const res = await fetch(`/api/customer/orders/${groupId}`, { method: 'PATCH' })
      if (res.ok) fetchOrders()
    } catch {}
    setCancelling(null)
  }

  const timeAgo = (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1) return t('customer.justNow')
    if (m < 60) return `${m}m ${t('customer.ago')}`
    return `${Math.floor(m / 60)}h ${m % 60}m ${t('customer.ago')}`
  }

  const parseOptions = (json: string) => {
    try {
      const arr = JSON.parse(json)
      return arr.map((o: { name: string }) => o.name).join(', ')
    } catch { return '' }
  }

  const submitFeedback = async () => {
    if (!ratingOrder) return
    setSubmittingFeedback(true)
    try {
      const feedbackRatings = ratingOrder.items
        .filter(item => ratings[item.id] && item.menuItemId)
        .map(item => ({
          baristaOrderId: item.id,
          menuItemId: item.menuItemId!,
          rating: ratings[item.id],
          comment: comments[item.id]?.trim() || undefined,
        }))
      if (feedbackRatings.length > 0) {
        await fetch('/api/customer/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ratings: feedbackRatings }),
        })
      }
    } catch {}
    setSubmittingFeedback(false)
    setRatingOrder(null)
    setRatings({})
    setComments({})
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl font-black text-white">{t('customer.myOrders')}</h1>

      {/* Rating popup */}
      {ratingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="text-center">
              <Star size={28} className="mx-auto text-[#F5C518] mb-2" />
              <h3 className="text-lg font-black text-white">{t('feedback.rateOrder')}</h3>
              <p className="text-xs text-white/30 mt-1">{t('feedback.rateOrderDesc')}</p>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {ratingOrder.items.map(item => (
                <div key={item.id} className="p-3 rounded-xl bg-white/[0.03] space-y-2">
                  <span className="text-sm text-white/70">{lang === 'ar' && item.nameAr ? item.nameAr : item.name}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRatings(prev => ({ ...prev, [item.id]: star }))}
                        className="p-0.5">
                        <Star size={22} className={star <= (ratings[item.id] || 0)
                          ? 'text-[#F5C518] fill-[#F5C518]'
                          : 'text-white/15'
                        } />
                      </button>
                    ))}
                  </div>
                  <input
                    value={comments[item.id] || ''}
                    onChange={e => setComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder={t('feedback.commentPlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/15 focus:outline-none focus:border-[#F5C518]/30"
                    maxLength={200}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setRatingOrder(null); setRatings({}); setComments({}) }}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/40 text-sm font-bold hover:bg-white/5 transition-all">
                {t('feedback.skip')}
              </button>
              <button onClick={submitFeedback} disabled={submittingFeedback || Object.keys(ratings).length === 0}
                className="flex-1 py-2.5 rounded-lg bg-[#F5C518] text-black text-sm font-bold hover:bg-[#D5A711] disabled:opacity-40 transition-all flex items-center justify-center gap-1">
                {submittingFeedback ? <Loader2 size={14} className="animate-spin" /> : null}
                {t('feedback.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl p-8 flex flex-col items-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Coffee className="text-white/15" size={40} />
          <p className="text-white/30 text-sm">{t('customer.noOrders')}</p>
          <a href="/customer/menu" className="text-[#F5C518] text-sm font-semibold hover:opacity-80">{t('customer.browseMenu')} &rarr;</a>
        </div>
      ) : (
        <>
          {/* Active Orders */}
          {activeOrders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider">{t('customer.activeOrders')}</h2>
              {activeOrders.map(order => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING
                const Icon = cfg.icon
                const stepIndex = STEPS.indexOf(order.status)

                return (
                  <div key={order.orderGroupId} className="rounded-2xl p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: order.status === 'READY' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white/40 text-xs font-mono">{order.receiptNumber}</span>
                        <span className="text-white/20 text-xs ml-2">{timeAgo(order.createdAt)}</span>
                      </div>
                      <span className={`${cfg.bg} ${cfg.color} text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1`}>
                        <Icon size={12} /> {t(cfg.label)}
                      </span>
                    </div>

                    {/* Status steps */}
                    <div className="flex items-center gap-1">
                      {STEPS.map((step, i) => (
                        <div key={step} className={`h-1.5 flex-1 rounded-full transition-all ${i <= stepIndex ? 'bg-[#F5C518]' : 'bg-white/10'}`} />
                      ))}
                    </div>

                    {/* Ready alert */}
                    {order.status === 'READY' && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
                        <Bell className="text-green-400 shrink-0" size={18} />
                        <p className="text-green-400 text-sm font-semibold">{t('customer.orderReady')}</p>
                      </div>
                    )}

                    {/* Items */}
                    <div className="space-y-1">
                      {order.items.map((item, i) => {
                        const opts = parseOptions(item.options)
                        return (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-white/70">{item.quantity}x {lang === 'ar' && item.nameAr ? item.nameAr : item.name}{opts ? ` (${opts})` : ''}</span>
                            <span className="text-white/40">{item.price.toFixed(2)}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Total + actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-white font-bold">{order.total.toFixed(2)} JD</span>
                      {order.status === 'PENDING' && (
                        <button onClick={() => cancelOrder(order.orderGroupId)} disabled={cancelling === order.orderGroupId}
                          className="text-red-400/60 text-xs font-semibold hover:text-red-400 disabled:opacity-50 flex items-center gap-1">
                          {cancelling === order.orderGroupId ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                          {t('customer.cancelOrder')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Past Orders */}
          {pastOrders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider">{t('customer.pastOrders')}</h2>
              {pastOrders.slice(0, 20).map(order => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.COMPLETED
                const Icon = cfg.icon
                return (
                  <div key={order.orderGroupId} className="rounded-xl p-3 opacity-60"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-white/30 text-xs font-mono">{order.receiptNumber}</span>
                      <div className="flex items-center gap-2">
                        {order.status === 'COMPLETED' && order.paymentMethod && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            order.paymentMethod === 'CASH'
                              ? 'text-green-400/60 bg-green-500/10'
                              : order.paymentMethod === 'CARD'
                              ? 'text-blue-400/60 bg-blue-500/10'
                              : 'text-white/25 bg-white/5'
                          }`}>
                            {order.paymentMethod === 'CASH' ? t('payment.cash') : order.paymentMethod === 'CARD' ? t('payment.card') : t('payment.other')}
                          </span>
                        )}
                        <span className={`${cfg.color} text-xs font-semibold flex items-center gap-1`}><Icon size={10} /> {t(cfg.label)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white/30 text-xs">{order.items.map(i => `${i.quantity}x ${lang === 'ar' && i.nameAr ? i.nameAr : i.name}`).join(', ')}</span>
                      <span className="text-white/30 text-xs font-bold">{order.total.toFixed(2)} JD</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
