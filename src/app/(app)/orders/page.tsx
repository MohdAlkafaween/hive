'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ClipboardList, Check, ChefHat, Bell, XCircle, Clock, Loader2, CreditCard, Banknote, Wallet, Printer } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/Button'
import { PageTransition } from '@/components/animations/PageTransition'

interface OrderItem {
  id: number
  name: string
  nameAr: string | null
  quantity: number
  price: number
  status: string
  note: string | null
  options: string
}

interface Order {
  orderGroupId: string
  receiptNumber: string
  status: string
  createdAt: string
  studentName: string
  studentNumber: number | null
  paymentMethod: string | null
  items: OrderItem[]
  total: number
}

type FilterStatus = 'ALL' | 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY'

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  ACCEPTED: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20' },
  PREPARING: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/20' },
  READY: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/20' },
  COMPLETED: { bg: 'bg-white/5', text: 'text-white/30', border: 'border-white/5' },
  CANCELLED: { bg: 'bg-red-500/10', text: 'text-red-400/50', border: 'border-red-500/10' },
}

export default function OrderQueuePage() {
  const { t, lang } = useI18n()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [updating, setUpdating] = useState<string | null>(null)
  const [completeModal, setCompleteModal] = useState<Order | null>(null)
  const [cancelModal, setCancelModal] = useState<Order | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const prevPendingCount = useRef(0)
  const newOrderIdsRef = useRef<Set<string>>(new Set())
  const highlightTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())

  const fetchOrders = useCallback(() => {
    fetch('/api/orders/queue')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.orders) {
          setOrders(data.orders)
          // Highlight new pending orders (sound is handled globally by IconSidebar)
          const newPending = data.orders.filter((o: Order) => o.status === 'PENDING').length
          if (newPending > prevPendingCount.current && prevPendingCount.current > 0) {
            // Mark new order IDs for highlight
            const existingIds = newOrderIdsRef.current
            const incoming = data.orders
              .filter((o: Order) => o.status === 'PENDING')
              .map((o: Order) => o.orderGroupId)
            const addedIds = incoming.filter((id: string) => !existingIds.has(id))
            if (addedIds.length > 0) {
              const next = new Set([...existingIds, ...addedIds])
              newOrderIdsRef.current = next
              setNewOrderIds(new Set(next))
              // Remove highlight after 5 seconds
              const timer = setTimeout(() => {
                highlightTimersRef.current.delete(timer)
                for (const id of addedIds) newOrderIdsRef.current.delete(id)
                setNewOrderIds(new Set(newOrderIdsRef.current))
              }, 5000)
              highlightTimersRef.current.add(timer)
            }
          } else if (prevPendingCount.current === 0) {
            // First load — populate ref without highlighting
            newOrderIdsRef.current = new Set(
              data.orders.filter((o: Order) => o.status === 'PENDING').map((o: Order) => o.orderGroupId)
            )
          }
          prevPendingCount.current = newPending
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => {
      clearInterval(interval)
      for (const t of highlightTimersRef.current) clearTimeout(t)
      highlightTimersRef.current.clear()
    }
  }, [fetchOrders])

  const updateStatus = async (orderGroupId: string, status: string, pm?: string) => {
    setUpdating(orderGroupId)
    try {
      const body: Record<string, string> = { status }
      if (pm) body.paymentMethod = pm
      const res = await fetch(`/api/orders/queue/${orderGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        fetchOrders()
        setCompleteModal(null)
        setCancelModal(null)
        // Auto-open receipt after completing an order
        if (status === 'COMPLETED') {
          window.open(`/customer-order/receipt/${orderGroupId}`, '_blank', 'width=350,height=600')
        }
      }
    } catch {}
    setUpdating(null)
  }

  const filteredOrders = filter === 'ALL'
    ? orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status))
    : orders.filter(o => o.status === filter)

  const completedOrders = orders.filter(o => ['COMPLETED', 'CANCELLED'].includes(o.status))

  const timeAgo = (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1) return t('queue.justNow')
    if (m < 60) return `${m}m ${t('queue.ago')}`
    return `${Math.floor(m / 60)}h ${m % 60}m`
  }

  const parseOptions = (json: string) => {
    try {
      return JSON.parse(json).map((o: { name: string }) => o.name).join(', ')
    } catch { return '' }
  }

  const pendingCount = orders.filter(o => o.status === 'PENDING').length

  const nextAction = (status: string): { label: string; action: string; icon: React.ElementType; color: string } | null => {
    switch (status) {
      case 'PENDING': return { label: t('queue.accept'), action: 'ACCEPTED', icon: Check, color: 'bg-blue-500 hover:bg-blue-600' }
      case 'ACCEPTED': return { label: t('queue.startPreparing'), action: 'PREPARING', icon: ChefHat, color: 'bg-orange-500 hover:bg-orange-600' }
      case 'PREPARING': return { label: t('queue.readyForPickup'), action: 'READY', icon: Bell, color: 'bg-green-500 hover:bg-green-600' }
      default: return null
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <ClipboardList className="text-[#F5C518]" size={24} />
              {t('queue.title')}
              {pendingCount > 0 && (
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-bold animate-pulse">
                  {pendingCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-white/40 mt-1">{t('queue.subtitle')}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['ALL', 'PENDING', 'ACCEPTED', 'PREPARING', 'READY'] as FilterStatus[]).map(s => {
            const count = s === 'ALL'
              ? orders.filter(o => !['COMPLETED', 'CANCELLED'].includes(o.status)).length
              : orders.filter(o => o.status === s).length
            return (
              <button key={s} onClick={() => setFilter(s)}
                className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  filter === s ? 'bg-[#F5C518]/15 text-[#F5C518] border border-[#F5C518]/30' : 'bg-white/5 text-white/40 border border-transparent hover:text-white/60'
                }`}>
                {s === 'ALL' ? t('queue.all') : t(`queue.status${s.charAt(0) + s.slice(1).toLowerCase()}`)}
                {count > 0 && <span className="ml-1.5 opacity-60">({count})</span>}
              </button>
            )
          })}
        </div>

        {/* Orders */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ClipboardList className="text-white/10 mx-auto mb-3" size={48} />
            <p className="text-white/30">{t('queue.noOrders')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredOrders.map(order => {
              const sc = STATUS_COLORS[order.status] || STATUS_COLORS.PENDING
              const next = nextAction(order.status)
              const isNew = newOrderIds.has(order.orderGroupId)

              return (
                <div key={order.orderGroupId}
                  className={`rounded-2xl p-4 space-y-3 border transition-all duration-500 ${sc.border} ${isNew ? 'ring-2 ring-[#F5C518]/60 shadow-[0_0_20px_rgba(245,197,24,0.25)]' : ''}`}
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-bold text-sm">{order.receiptNumber}</span>
                      <span className="text-white/20 text-xs ml-2">{timeAgo(order.createdAt)}</span>
                    </div>
                    <span className={`${sc.bg} ${sc.text} text-xs font-bold px-2.5 py-1 rounded-full`}>
                      {t(`queue.status${order.status.charAt(0) + order.status.slice(1).toLowerCase()}`)}
                    </span>
                  </div>

                  {/* Customer */}
                  <p className="text-white/50 text-sm">
                    {order.studentName}
                    {order.studentNumber ? ` (STD-${String(order.studentNumber).padStart(4, '0')})` : ''}
                  </p>

                  {/* Items */}
                  <div className="space-y-1.5">
                    {order.items.map((item, i) => {
                      const opts = parseOptions(item.options)
                      return (
                        <div key={i} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white font-medium">
                              {item.quantity}x {lang === 'ar' && item.nameAr ? item.nameAr : item.name}
                            </span>
                            <span className="text-white/40">{item.price.toFixed(2)}</span>
                          </div>
                          {opts && <p className="text-white/25 text-xs mt-0.5">{opts}</p>}
                          {item.note && <p className="text-yellow-400/50 text-xs mt-0.5 italic">{item.note}</p>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-white font-bold">{order.total.toFixed(2)} JD</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {next && (
                      <Button
                        onClick={() => updateStatus(order.orderGroupId, next.action)}
                        disabled={updating === order.orderGroupId}
                        className={`flex-1 ${next.color} text-white text-sm font-bold`}
                        size="sm"
                      >
                        {updating === order.orderGroupId ? <Loader2 size={14} className="animate-spin" /> : <next.icon size={14} />}
                        <span className="ml-1.5">{next.label}</span>
                      </Button>
                    )}

                    {order.status === 'READY' && (
                      <Button
                        onClick={() => { setCompleteModal(order); setPaymentMethod('CASH') }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold"
                        size="sm"
                      >
                        <Check size={14} /> <span className="ml-1.5">{t('queue.complete')}</span>
                      </Button>
                    )}

                    {!['COMPLETED', 'CANCELLED'].includes(order.status) && (
                      <Button
                        onClick={() => setCancelModal(order)}
                        variant="secondary"
                        className="text-red-400/60 hover:text-red-400 text-sm"
                        size="sm"
                      >
                        <XCircle size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Completed/Cancelled section */}
        {completedOrders.length > 0 && (
          <details className="group">
            <summary className="text-sm font-bold text-white/30 uppercase tracking-wider cursor-pointer hover:text-white/50 list-none flex items-center gap-2">
              <span className="group-open:rotate-90 transition-transform">▶</span>
              {t('queue.completedOrders')} ({completedOrders.length})
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
              {completedOrders.slice(0, 20).map(order => {
                const sc = STATUS_COLORS[order.status] || STATUS_COLORS.COMPLETED
                return (
                  <div key={order.orderGroupId} className="rounded-xl p-3 opacity-50"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-white/30 text-xs font-mono">{order.receiptNumber}</span>
                      <span className={`${sc.text} text-xs font-semibold`}>
                        {t(`queue.status${order.status.charAt(0) + order.status.slice(1).toLowerCase()}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-white/20 text-xs flex-1">{order.studentName} — {order.total.toFixed(2)} JD</p>
                      {order.status === 'COMPLETED' && order.paymentMethod && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          order.paymentMethod === 'CASH'
                            ? 'text-green-400/70 bg-green-500/10'
                            : order.paymentMethod === 'CARD'
                            ? 'text-blue-400/70 bg-blue-500/10'
                            : 'text-white/30 bg-white/5'
                        }`}>
                          {order.paymentMethod === 'CASH' ? t('payment.cash') : order.paymentMethod === 'CARD' ? t('payment.card') : t('payment.other')}
                        </span>
                      )}
                      {order.status === 'COMPLETED' && (
                        <button
                          onClick={() => window.open(`/customer-order/receipt/${order.orderGroupId}`, '_blank', 'width=350,height=600')}
                          className="text-white/30 hover:text-white/60 transition-colors"
                          title={t('receipt.printReceipt')}
                        >
                          <Printer size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        )}
      </div>

      {/* Complete modal with payment selector */}
      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCompleteModal(null)}>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-1">{t('queue.completeOrder')}</h3>
            <p className="text-white/40 text-sm mb-4">{completeModal.receiptNumber} — {completeModal.total.toFixed(2)} JD</p>

            <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-2">{t('queue.paymentMethod')}</p>
            <div className="flex gap-2 mb-5">
              {[
                { value: 'CASH', icon: Banknote, label: t('barista.cash') },
                { value: 'CARD', icon: CreditCard, label: t('barista.card') },
                { value: 'OTHER', icon: Wallet, label: t('queue.paymentOther') },
              ].map(pm => (
                <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === pm.value
                      ? 'bg-[#F5C518]/15 text-[#F5C518] border border-[#F5C518]/30'
                      : 'bg-white/5 text-white/40 border border-transparent hover:text-white/60'
                  }`}>
                  <pm.icon size={18} />
                  {pm.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setCompleteModal(null)} variant="secondary" className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => updateStatus(completeModal.orderGroupId, 'COMPLETED', paymentMethod)}
                disabled={updating === completeModal.orderGroupId}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                {updating === completeModal.orderGroupId ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span className="ml-1.5">{t('queue.complete')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCancelModal(null)}>
          <div className="bg-[#1A1A1A] rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg mb-1">{t('queue.cancelOrder')}</h3>
            <p className="text-white/40 text-sm mb-4">
              {t('queue.cancelConfirm')} {cancelModal.receiptNumber}?
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setCancelModal(null)} variant="secondary" className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => updateStatus(cancelModal.orderGroupId, 'CANCELLED')}
                disabled={updating === cancelModal.orderGroupId}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {updating === cancelModal.orderGroupId ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                <span className="ml-1.5">{t('queue.cancelOrder')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  )
}
