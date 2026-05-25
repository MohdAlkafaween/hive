'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Coffee, DollarSign, Image as ImageIcon, ShoppingCart, Trash2, XCircle, Upload, Loader2, Ban } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageTransition } from '@/components/animations/PageTransition'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface MenuItem {
  id: number
  name: string
  price: number
  imageUrl: string | null
  isOutOfStock: boolean
}

interface Order {
  id: number
  quantity: number
  totalPrice: number
  createdAt: string
  menuItem: MenuItem
}

export default function BaristaPage() {
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = async () => {
    const [menuRes, ordersRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/barista/orders')
    ])
    if (menuRes.ok) setMenu(await menuRes.json())
    if (ordersRes.ok) setOrders(await ordersRes.json())
  }

  useEffect(() => { loadData() }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      alert('Only JPEG, PNG, WebP, and GIF images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB')
      return
    }
    setImageFile(file)
    setImageUrl('')
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null)
    setImageUrl('')
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let finalImageUrl = imageUrl
      if (imageFile) {
        setUploading(true)
        const formData = new FormData()
        formData.append('file', imageFile)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          finalImageUrl = uploadData.imageUrl
        } else {
          const err = await uploadRes.json().catch(() => ({}))
          alert(err.error || 'Failed to upload image')
          return
        }
        setUploading(false)
      }
      await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, imageUrl: finalImageUrl })
      })
      setName(''); setPrice(''); clearImage()
      loadData()
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  const handleOrder = async (item: MenuItem) => {
    if (item.isOutOfStock) return
    await fetch('/api/barista/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuItemId: item.id, quantity: 1, totalPrice: item.price })
    })
    loadData()
  }

  const handleToggleStock = async (item: MenuItem) => {
    await fetch(`/api/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOutOfStock: !item.isOutOfStock })
    })
    loadData()
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const handleDeleteItem = (id: number) => {
    setConfirmDeleteId(id)
    setConfirmOpen(true)
  }

  const executeDeleteItem = async () => {
    if (confirmDeleteId === null) return
    await fetch(`/api/menu/${confirmDeleteId}`, { method: 'DELETE' })
    setConfirmOpen(false)
    setConfirmDeleteId(null)
    loadData()
  }

  const handleDeleteOrder = async (id: number) => {
    await fetch(`/api/barista/orders/${id}`, { method: 'DELETE' })
    loadData()
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0)

  return (
    <PageTransition>
    <div className="flex flex-col gap-6">
      <motion.section
        className="flex flex-col items-center justify-center text-center py-5 select-none"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-black text-white tracking-tight">Barista POS & Finance</h1>
        <p className="text-white/30 text-xs font-mono max-w-sm leading-relaxed mt-2">
          Manage menu items and track daily revenue.
        </p>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu Management */}
        <div className="lg:col-span-1 hive-card !rounded-2xl">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white"><Plus className="w-5 h-5 text-[#F5C518]" /> Add Menu Item</h2>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-2">Item Name</label>
              <div className="relative">
                <Coffee className="absolute left-3 top-3 w-5 h-5 text-white/20" />
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none placeholder-white/20 transition-all focus:shadow-[0_0_0_3px_rgba(245,197,24,0.15)]"
                  placeholder="Espresso"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-2">Price (JD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 w-5 h-5 text-white/20" />
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none placeholder-white/20 transition-all focus:shadow-[0_0_0_3px_rgba(245,197,24,0.15)]"
                  placeholder="2.50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-2">Image (Optional)</label>
              {imagePreview && (
                <div className="relative mb-3 rounded-xl overflow-hidden border border-white/10">
                  <img src={imagePreview} alt="Preview" className="w-full h-28 object-cover" />
                  <button type="button" onClick={clearImage} className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-all">
                    <XCircle size={16} />
                  </button>
                </div>
              )}
              {!imagePreview && (
                <div className="space-y-2">
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelect} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white/3 border border-dashed border-white/15 hover:border-[#F5C518] text-white/40 hover:text-[#F5C518] rounded-xl text-sm font-medium transition-all"
                  >
                    <Upload size={16} />
                    Upload from device
                  </button>
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-3 w-5 h-5 text-white/20" />
                    <input
                      value={imageUrl}
                      onChange={e => { setImageUrl(e.target.value); setImageFile(null); setImagePreview('') }}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none placeholder-white/20 transition-all"
                      placeholder="Or paste https:// URL"
                    />
                  </div>
                </div>
              )}
            </div>

            <button disabled={loading || uploading} type="submit" className="hive-btn w-full !py-4 text-sm font-bold text-[#0A0A0A] !rounded-xl">
              {uploading ? <><Loader2 size={16} className="animate-spin mr-2" /> Uploading...</> : loading ? 'Adding...' : 'Add Item'}
            </button>
          </form>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-bold text-white/50 mb-2 uppercase">Total Revenue</h3>
            <div className="text-3xl font-black text-green-400">{totalRevenue.toFixed(2)} JD</div>
            <p className="text-xs text-white/25 mt-1">{orders.length} total orders recorded</p>
          </div>
        </div>

        {/* POS Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="hive-card !rounded-2xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white"><ShoppingCart className="w-5 h-5 text-[#F5C518]" /> Point of Sale</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {menu.map((item, index) => (
                <motion.div
                  key={item.id}
                  className="group relative flex flex-col h-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  whileHover={{ y: -3 }}
                >
                  <button
                    onClick={() => handleOrder(item)}
                    disabled={item.isOutOfStock}
                    className={`relative border rounded-xl overflow-hidden transition-all duration-300 text-left flex flex-col h-full
                      ${item.isOutOfStock
                        ? 'border-white/5 opacity-50 cursor-not-allowed bg-white/3'
                        : 'border-white/10 hover:border-[#F5C518] hover:shadow-[0_8px_32px_rgba(245,197,24,0.15)] cursor-pointer bg-white/5'
                      }`}
                  >
                    <div className="w-full h-24 bg-white/5 flex items-center justify-center overflow-hidden relative">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Coffee className="w-8 h-8 text-white/20" />
                      )}
                      {item.isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 border border-red-500/30">
                            <Ban size={12} /> Out of Stock
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="font-bold text-white/80 text-sm truncate">{item.name}</div>
                      <div className="text-[#F5C518] font-black text-sm">{item.price.toFixed(2)} JD</div>
                    </div>
                  </button>

                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 translate-y-1 group-hover:translate-y-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleStock(item) }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shadow-md transition-all ${
                        item.isOutOfStock
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-orange-400 hover:bg-orange-500 text-white'
                      }`}
                      title={item.isOutOfStock ? 'Mark In Stock' : 'Mark Out of Stock'}
                    >
                      <Ban size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id) }}
                      className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-all"
                      title="Delete Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
              {menu.length === 0 && (
                <div className="col-span-full py-8 text-center text-white/25 text-sm font-mono border-2 border-dashed border-white/10 rounded-xl">
                  No menu items available. Add some on the left.
                </div>
              )}
            </div>
          </div>

          <div className="hive-card !rounded-2xl h-64 overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 sticky top-0 z-10 pb-2 text-white" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Recent Transactions</h2>
            <div className="divide-y divide-white/5">
              {orders.map(order => (
                <div key={order.id} className="py-2 flex justify-between items-center text-sm group">
                  <div className="flex flex-col">
                    <span className="font-bold text-white/80">{order.menuItem.name} x{order.quantity}</span>
                    <span className="text-xs text-white/25">{new Date(order.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-mono font-bold text-green-400">+{order.totalPrice.toFixed(2)} JD</div>
                    <button
                      onClick={() => handleDeleteOrder(order.id)}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-center transition-all"
                      title="Delete transaction"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="text-center text-white/25 text-sm py-4">No transactions yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      open={confirmOpen}
      onClose={() => { setConfirmOpen(false); setConfirmDeleteId(null) }}
      onConfirm={executeDeleteItem}
      title="Delete Menu Item"
      message="Delete this menu item and all its orders? This action cannot be undone."
      confirmLabel="Delete"
      variant="danger"
    />
    </PageTransition>
  )
}
