'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { generateId } from '@/lib/utils'
import { ShoppingCart, Plus, Minus, X, Loader2, Coffee, Trash2, ChevronRight, StickyNote } from 'lucide-react'

interface OptionValue { id: number; label: string; labelAr: string | null; price: number; isDefault: boolean }
interface MenuOption { id: number; name: string; nameAr: string | null; type: string; required: boolean; values: OptionValue[] }
interface MenuItem { id: number; name: string; nameAr: string | null; price: number; imageUrl: string | null; options: MenuOption[] }
interface Category { id: number; name: string; nameAr: string | null; items: MenuItem[] }

interface CartItem {
  cartId: string
  menuItemId: number
  name: string
  unitPrice: number
  quantity: number
  selectedOptions: Array<{ optionId: number; valueId: number; name: string; price: number }>
  note: string
  lineTotal: number
}

export default function CustomerMenuPage() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [orderNote, setOrderNote] = useState('')
  const [placing, setPlacing] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)

  // Option selection state for modal
  const [modalQty, setModalQty] = useState(1)
  const [modalSelections, setModalSelections] = useState<Record<number, number>>({})
  const [modalNote, setModalNote] = useState('')

  const catScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/menu/public')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.categories) setCategories(data.categories) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const allItems = categories.flatMap(c => c.items)
  const displayItems = activeCategory === null ? allItems : categories.find(c => c.id === activeCategory)?.items || []

  const openItem = (item: MenuItem) => {
    setSelectedItem(item)
    setModalQty(1)
    setModalNote('')
    // Set defaults
    const defaults: Record<number, number> = {}
    for (const opt of item.options) {
      const def = opt.values.find(v => v.isDefault)
      if (def) defaults[opt.id] = def.id
      else if (opt.required && opt.values.length > 0) defaults[opt.id] = opt.values[0].id
    }
    setModalSelections(defaults)
  }

  const calcModalPrice = () => {
    if (!selectedItem) return 0
    let price = selectedItem.price
    for (const opt of selectedItem.options) {
      const selId = modalSelections[opt.id]
      if (!selId) continue
      const val = opt.values.find(v => v.id === selId)
      if (!val) continue
      if (opt.type === 'SET_PRICE') price = val.price
      else price += val.price
    }
    return Math.round(price * modalQty * 100) / 100
  }

  const addToCart = () => {
    if (!selectedItem) return
    // Validate required options
    for (const opt of selectedItem.options) {
      if (opt.required && !modalSelections[opt.id]) return
    }

    let unitPrice = selectedItem.price
    const opts: CartItem['selectedOptions'] = []
    for (const opt of selectedItem.options) {
      const selId = modalSelections[opt.id]
      if (!selId) continue
      const val = opt.values.find(v => v.id === selId)
      if (!val) continue
      if (opt.type === 'SET_PRICE') unitPrice = val.price
      else unitPrice += val.price
      opts.push({ optionId: opt.id, valueId: val.id, name: val.label, price: val.price })
    }

    const lineTotal = Math.round(unitPrice * modalQty * 100) / 100
    setCart(prev => [...prev, {
      cartId: generateId(),
      menuItemId: selectedItem.id,
      name: lang === 'ar' && selectedItem.nameAr ? selectedItem.nameAr : selectedItem.name,
      unitPrice,
      quantity: modalQty,
      selectedOptions: opts,
      note: modalNote,
      lineTotal,
    }])
    setSelectedItem(null)
  }

  const removeFromCart = (cartId: string) => setCart(prev => prev.filter(i => i.cartId !== cartId))
  const cartTotal = cart.reduce((s, i) => s + i.lineTotal, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const placeOrder = async () => {
    if (cart.length === 0) return
    setPlacing(true)
    try {
      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(i => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            selectedOptions: i.selectedOptions.map(o => ({ optionId: o.optionId, valueId: o.valueId })),
            note: i.note || undefined,
          })),
          orderNote: orderNote || undefined,
        }),
      })
      if (res.ok) {
        setOrderSuccess(true)
        setCart([])
        setOrderNote('')
        setTimeout(() => router.push('/customer/orders'), 1500)
      }
    } catch {}
    setPlacing(false)
  }

  const n = (item: { name: string; nameAr?: string | null }) => lang === 'ar' && item.nameAr ? item.nameAr : item.name
  const nOpt = (v: { label: string; labelAr?: string | null }) => lang === 'ar' && v.labelAr ? v.labelAr : v.label

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-black text-white">{t('customer.menu')}</h1>

      {/* Category tabs */}
      <div ref={catScrollRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        <button onClick={() => setActiveCategory(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${activeCategory === null ? 'bg-[#F5C518] text-black' : 'bg-white/5 text-white/50 hover:text-white/70'}`}>
          {t('customer.allCategories')}
        </button>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${activeCategory === cat.id ? 'bg-[#F5C518] text-black' : 'bg-white/5 text-white/50 hover:text-white/70'}`}>
            {n(cat)}
          </button>
        ))}
      </div>

      {/* Items grid */}
      {displayItems.length === 0 ? (
        <div className="text-center py-12">
          <Coffee className="text-white/20 mx-auto mb-3" size={40} />
          <p className="text-white/30 text-sm">{t('customer.noItems')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {displayItems.map(item => (
            <button key={item.id} onClick={() => openItem(item)}
              className="rounded-xl overflow-hidden text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {item.imageUrl ? (
                <div className="w-full h-28 bg-white/5">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full h-28 bg-white/5 flex items-center justify-center">
                  <Coffee className="text-white/10" size={32} />
                </div>
              )}
              <div className="p-3">
                <p className="text-white text-sm font-semibold truncate">{n(item)}</p>
                <p className="text-[#F5C518] text-sm font-bold mt-1">{item.price.toFixed(2)} JD</p>
                {item.options.length > 0 && <p className="text-white/30 text-[10px] mt-0.5">{t('customer.hasOptions')}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Floating cart button */}
      {cart.length > 0 && !showCart && !selectedItem && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-4 right-4 max-w-md mx-auto py-3.5 rounded-xl font-bold flex items-center justify-between px-5 z-40 shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #F5C518 0%, #EAB308 100%)', color: '#0A0A0A' }}>
          <span className="flex items-center gap-2"><ShoppingCart size={20} /> {t('customer.cart')} ({cartCount})</span>
          <span>{cartTotal.toFixed(2)} JD</span>
        </button>
      )}

      {/* Item detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedItem(null)}>
          <div className="w-full max-w-lg bg-[#141414] rounded-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{n(selectedItem)}</h2>
                <button onClick={() => setSelectedItem(null)} className="text-white/40 hover:text-white/60"><X size={20} /></button>
              </div>
              <p className="text-[#F5C518] font-bold">{selectedItem.price.toFixed(2)} JD</p>

              {/* Options */}
              {selectedItem.options.map(opt => (
                <div key={opt.id} className="space-y-2">
                  <p className="text-white/60 text-sm font-semibold">
                    {n(opt)} {opt.required && <span className="text-red-400 text-xs">*</span>}
                  </p>
                  <div className="space-y-1.5">
                    {opt.values.map(val => (
                      <button key={val.id} onClick={() => setModalSelections(prev => ({ ...prev, [opt.id]: val.id }))}
                        className={`w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all ${
                          modalSelections[opt.id] === val.id
                            ? 'bg-[#F5C518]/15 border border-[#F5C518]/30 text-white'
                            : 'bg-white/5 border border-transparent text-white/60 hover:bg-white/8'
                        }`}>
                        <span>{nOpt(val)}</span>
                        <span className="text-white/40">{opt.type === 'SET_PRICE' ? `${val.price.toFixed(2)} JD` : val.price > 0 ? `+${val.price.toFixed(2)}` : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Quantity */}
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">{t('customer.quantity')}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-white/5 text-white/50 flex items-center justify-center hover:bg-white/10"><Minus size={16} /></button>
                  <span className="text-white font-bold w-6 text-center">{modalQty}</span>
                  <button onClick={() => setModalQty(q => Math.min(10, q + 1))} className="w-8 h-8 rounded-lg bg-white/5 text-white/50 flex items-center justify-center hover:bg-white/10"><Plus size={16} /></button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-white/40 text-xs flex items-center gap-1 mb-1"><StickyNote size={12} /> {t('customer.addNote')}</label>
                <input type="text" value={modalNote} onChange={e => setModalNote(e.target.value)} maxLength={200}
                  placeholder={t('customer.notePlaceholder')}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F5C518] placeholder-white/20" />
              </div>

              {/* Add to cart */}
              <button onClick={addToCart}
                className="w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #F5C518 0%, #EAB308 100%)', color: '#0A0A0A' }}>
                <Plus size={18} /> {t('customer.addToCart')} — {calcModalPrice().toFixed(2)} JD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart view */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCart(false)}>
          <div className="w-full max-w-lg bg-[#141414] rounded-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><ShoppingCart size={20} /> {t('customer.cart')}</h2>
                <button onClick={() => setShowCart(false)} className="text-white/40 hover:text-white/60"><X size={20} /></button>
              </div>

              {orderSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="text-green-400" size={28} />
                  </div>
                  <p className="text-green-400 font-bold text-lg">{t('customer.orderPlaced')}</p>
                  <p className="text-white/40 text-sm mt-1">{t('customer.redirectingToOrders')}</p>
                </div>
              ) : cart.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">{t('customer.cartEmpty')}</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.cartId} className="flex items-start justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold">{item.quantity}x {item.name}</p>
                          {item.selectedOptions.length > 0 && (
                            <p className="text-white/30 text-xs mt-0.5">{item.selectedOptions.map(o => o.name).join(', ')}</p>
                          )}
                          {item.note && <p className="text-white/20 text-xs mt-0.5 italic">{item.note}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-white text-sm font-bold">{item.lineTotal.toFixed(2)}</span>
                          <button onClick={() => removeFromCart(item.cartId)} className="text-red-400/50 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order note */}
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">{t('customer.orderNote')}</label>
                    <input type="text" value={orderNote} onChange={e => setOrderNote(e.target.value)} maxLength={200}
                      placeholder={t('customer.orderNotePlaceholder')}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F5C518] placeholder-white/20" />
                  </div>

                  {/* Total + actions */}
                  <div className="flex items-center justify-between py-2 border-t border-white/10">
                    <span className="text-white/60 text-sm">{t('customer.total')}</span>
                    <span className="text-white text-lg font-black">{cartTotal.toFixed(2)} JD</span>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => { setCart([]); setShowCart(false) }}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/5 text-white/50 hover:bg-white/10 transition-all">
                      {t('customer.clearCart')}
                    </button>
                    <button onClick={placeOrder} disabled={placing}
                      className="flex-2 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 flex-[2]"
                      style={{ background: 'linear-gradient(135deg, #F5C518 0%, #EAB308 100%)', color: '#0A0A0A' }}>
                      {placing ? <Loader2 className="animate-spin" size={18} /> : <ChevronRight size={18} />}
                      {t('customer.placeOrder')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
