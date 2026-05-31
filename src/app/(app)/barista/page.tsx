'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { todayString } from '@/lib/subscriptionLogic'
import {
  Plus, Coffee, DollarSign, Image as ImageIcon, ShoppingCart, Trash2, XCircle,
  Upload, Loader2, Ban, User, Search, X, Edit3, FolderPlus, Tag, CreditCard,
  Banknote, ChevronDown, Printer, Receipt, Settings, Check, LayoutGrid, Minus,
  Sliders, PenLine, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageTransition } from '@/components/animations/PageTransition'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/ui/Toast'
import { CashRegisterBar } from '@/components/barista/CashRegisterBar'

// ─── Types ───
interface MenuCategory {
  id: number
  name: string
  nameAr: string | null
  sortOrder: number
  isActive: boolean
  _count?: { items: number }
}

interface OptionValue {
  id: number
  label: string
  labelAr: string | null
  price: number
  costPrice: number
  isDefault: boolean
  sortOrder: number
}

interface MenuItemOption {
  id: number
  name: string
  nameAr: string | null
  type: string
  required: boolean
  sortOrder: number
  values: OptionValue[]
}

interface MenuItem {
  id: number
  name: string
  nameAr: string | null
  price: number
  costPrice: number
  imageUrl: string | null
  isOutOfStock: boolean
  categoryId: number | null
  category: { id: number; name: string; nameAr: string | null } | null
  options: MenuItemOption[]
}

interface Order {
  id: number
  quantity: number
  totalPrice: number
  finalPrice: number
  costPrice: number
  paymentMethod: string
  receiptNumber: string | null
  selectedOptions: string
  createdAt: string
  menuItem: { id: number; name: string; price: number; imageUrl: string | null; isOutOfStock: boolean }
  student?: { id: number; fullName: string; studentNumber?: number } | null
}

interface StudentOption {
  id: number
  fullName: string
  studentNumber?: number
}

// ─── Cart Item ───
interface CartItem {
  cartId: string // unique key for this cart entry
  menuItem: MenuItem
  quantity: number
  selectedOptions: Record<number, OptionValue>
  lineTotal: number
}

// ─── Main Component ───
export default function BaristaPage() {
  const { t, lang } = useI18n()
  const { toast } = useToast()

  // ─── State ───
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])

  // Category filter for POS
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all')

  // Cart
  const [cart, setCart] = useState<CartItem[]>([])

  // Add/Edit item form
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemNameAr, setItemNameAr] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemCostPrice, setItemCostPrice] = useState('')
  const [itemCategoryId, setItemCategoryId] = useState<number | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Category management
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [catName, setCatName] = useState('')
  const [catNameAr, setCatNameAr] = useState('')
  const [editingCat, setEditingCat] = useState<MenuCategory | null>(null)
  const [savingCat, setSavingCat] = useState(false)

  // Options modal (for items with options before adding to cart)
  const [optionsModal, setOptionsModal] = useState<MenuItem | null>(null)
  const [optionsQuantity, setOptionsQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<Record<number, OptionValue>>({})

  // Checkout modal
  const [showCheckout, setShowCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentOption[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null)
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)

  // Receipt modal
  const [receiptData, setReceiptData] = useState<{
    receiptNumber: string
    orders: Order[]
    total: number
    paymentMethod: string
    student?: { id: number; fullName: string; studentNumber?: number } | null
  } | null>(null)

  // Delete confirm
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [confirmCatDeleteId, setConfirmCatDeleteId] = useState<number | null>(null)

  // Tab: 'pos' or 'manage'
  const [tab, setTab] = useState<'pos' | 'manage'>('pos')

  // Options management
  const [optionsMgmtItemId, setOptionsMgmtItemId] = useState<number | null>(null)
  const [showOptionForm, setShowOptionForm] = useState(false)
  const [editingOption, setEditingOption] = useState<MenuItemOption | null>(null)
  const [optFormName, setOptFormName] = useState('')
  const [optFormNameAr, setOptFormNameAr] = useState('')
  const [optFormType, setOptFormType] = useState<'ADD_TO_PRICE' | 'SET_PRICE'>('ADD_TO_PRICE')
  const [optFormRequired, setOptFormRequired] = useState(false)
  const [savingOption, setSavingOption] = useState(false)
  // Option values
  const [showValueForm, setShowValueForm] = useState<number | null>(null) // option id
  const [valLabel, setValLabel] = useState('')
  const [valLabelAr, setValLabelAr] = useState('')
  const [valPrice, setValPrice] = useState('')
  const [valCost, setValCost] = useState('')
  const [valIsDefault, setValIsDefault] = useState(false)
  const [savingValue, setSavingValue] = useState(false)

  // Custom item modal (POS)
  const [showCustomItem, setShowCustomItem] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customCost, setCustomCost] = useState('')

  // Cash register refresh trigger
  const [orderPlacedCount, setOrderPlacedCount] = useState(0)

  // Expenses
  const [expenses, setExpenses] = useState<{ id: number; description: string; amount: number; category: string | null; addedByName: string; createdAt: string }[]>([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expDesc, setExpDesc] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expCategory, setExpCategory] = useState('')
  const [savingExpense, setSavingExpense] = useState(false)

  // ─── Data Loading ───
  const loadData = useCallback(async () => {
    const today = todayString()
    const [menuRes, ordersRes, catRes, expRes] = await Promise.all([
      fetch('/api/menu'),
      fetch('/api/barista/orders'),
      fetch('/api/menu/categories'),
      fetch(`/api/expenses?from=${today}&to=${today}`),
    ])
    if (menuRes.ok) setMenu(await menuRes.json())
    if (ordersRes.ok) setOrders(await ordersRes.json())
    if (catRes.ok) setCategories(await catRes.json())
    if (expRes.ok) setExpenses(await expRes.json())
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── Student search debounce ───
  useEffect(() => {
    if (!studentSearch.trim() || studentSearch.length < 2) { setStudentResults([]); return }
    const timer = setTimeout(async () => {
      setSearchingStudents(true)
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(studentSearch)}`)
        if (res.ok) {
          const data = await res.json()
          const students = Array.isArray(data) ? data : data.students
          setStudentResults(students.slice(0, 5).map((s: Record<string, unknown>) => ({
            id: s.id as number,
            fullName: s.fullName as string,
            studentNumber: s.studentNumber as number | undefined,
          })))
        }
      } catch { /* silent */ }
      setSearchingStudents(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [studentSearch])

  // ─── Filtered menu items ───
  const filteredItems = selectedCategoryId === 'all'
    ? menu
    : menu.filter(i => i.categoryId === selectedCategoryId)

  // ─── Cart helpers ───
  const addToCart = (item: MenuItem, qty: number, opts: Record<number, OptionValue>) => {
    let lineTotal = item.price
    for (const opt of item.options) {
      const sel = opts[opt.id]
      if (sel) {
        if (opt.type === 'SET_PRICE') lineTotal = sel.price
        else lineTotal += sel.price
      }
    }
    lineTotal *= qty

    setCart(prev => [...prev, {
      cartId: `${item.id}-${Date.now()}`,
      menuItem: item,
      quantity: qty,
      selectedOptions: opts,
      lineTotal,
    }])
  }

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(c => c.cartId !== cartId))
  }

  const updateCartQty = (cartId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.cartId !== cartId) return c
      const newQty = Math.max(1, Math.min(99, c.quantity + delta))
      let unitPrice = c.menuItem.price
      for (const opt of c.menuItem.options) {
        const sel = c.selectedOptions[opt.id]
        if (sel) {
          if (opt.type === 'SET_PRICE') unitPrice = sel.price
          else unitPrice += sel.price
        }
      }
      return { ...c, quantity: newQty, lineTotal: unitPrice * newQty }
    }))
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.lineTotal, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  // ─── Add item to cart (handle options) ───
  const handleItemClick = (item: MenuItem) => {
    if (item.isOutOfStock) return
    if (item.options.length > 0) {
      // Open options modal
      setOptionsModal(item)
      setOptionsQuantity(1)
      const defaults: Record<number, OptionValue> = {}
      for (const opt of item.options) {
        const def = opt.values.find(v => v.isDefault) || (opt.required ? opt.values[0] : undefined)
        if (def) defaults[opt.id] = def
      }
      setSelectedOptions(defaults)
    } else {
      // No options, add directly
      addToCart(item, 1, {})
    }
  }

  const confirmOptionsAndAdd = () => {
    if (!optionsModal) return
    addToCart(optionsModal, optionsQuantity, selectedOptions)
    setOptionsModal(null)
  }

  // ─── Checkout ───
  const handleCheckout = async () => {
    if (cart.length === 0 || placingOrder) return
    setPlacingOrder(true)
    try {
      const items = cart.map(c => {
        const isCustom = c.menuItem.id < 0
        const optionsPayload = Object.entries(c.selectedOptions).map(([optId, val]) => ({
          optionId: Number(optId),
          optionName: c.menuItem.options.find(o => o.id === Number(optId))?.name || '',
          valueLabel: val.label,
          price: val.price,
          costPrice: val.costPrice,
        }))
        return {
          menuItemId: isCustom ? -1 : c.menuItem.id,
          quantity: c.quantity,
          totalPrice: c.menuItem.price * c.quantity,
          finalPrice: c.lineTotal,
          selectedOptions: isCustom ? [] : optionsPayload,
          ...(isCustom ? { customName: c.menuItem.name, customCostPrice: c.menuItem.costPrice } : {}),
        }
      })

      const res = await fetch('/api/barista/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          paymentMethod,
          ...(selectedStudent ? { studentId: selectedStudent.id } : {}),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setReceiptData(data)
        setCart([])
        setOrderPlacedCount(c => c + 1)
      } else {
        const errData = await res.json().catch(() => null)
        toast(errData?.error || 'Order failed. Please try again.')
      }

      setShowCheckout(false)
      setSelectedStudent(null)
      setStudentSearch('')
      loadData()
    } finally {
      setPlacingOrder(false)
    }
  }

  // ─── Image handling ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return
    if (file.size > 5 * 1024 * 1024) return
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

  // ─── Add/Edit Item ───
  const openAddForm = () => {
    setEditingItem(null)
    setItemName(''); setItemNameAr(''); setItemPrice(''); setItemCostPrice('')
    setItemCategoryId(null); clearImage()
    setShowItemForm(true)
  }

  const openEditForm = (item: MenuItem) => {
    setEditingItem(item)
    setItemName(item.name)
    setItemNameAr(item.nameAr || '')
    setItemPrice(String(item.price))
    setItemCostPrice(String(item.costPrice || ''))
    setItemCategoryId(item.categoryId)
    setImageUrl(item.imageUrl || '')
    setImagePreview(item.imageUrl || '')
    setImageFile(null)
    setShowItemForm(true)
  }

  const handleSaveItem = async (e: React.FormEvent) => {
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
        }
        setUploading(false)
      }

      const payload = {
        name: itemName,
        nameAr: itemNameAr || null,
        price: parseFloat(itemPrice),
        costPrice: parseFloat(itemCostPrice) || 0,
        categoryId: itemCategoryId,
        imageUrl: finalImageUrl || null,
      }

      if (editingItem) {
        await fetch(`/api/menu/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      setShowItemForm(false)
      setEditingItem(null)
      loadData()
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  // ─── Toggle stock ───
  const handleToggleStock = async (item: MenuItem) => {
    await fetch(`/api/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOutOfStock: !item.isOutOfStock }),
    })
    loadData()
  }

  // ─── Delete item ───
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

  // ─── Delete order ───
  const handleDeleteOrder = async (id: number) => {
    await fetch(`/api/barista/orders/${id}`, { method: 'DELETE' })
    loadData()
  }

  // ─── Category CRUD ───
  const openCategoryModal = (cat?: MenuCategory) => {
    if (cat) {
      setEditingCat(cat)
      setCatName(cat.name)
      setCatNameAr(cat.nameAr || '')
    } else {
      setEditingCat(null)
      setCatName('')
      setCatNameAr('')
    }
    setShowCategoryModal(true)
  }

  const handleSaveCategory = async () => {
    if (!catName.trim()) return
    setSavingCat(true)
    try {
      if (editingCat) {
        await fetch(`/api/menu/categories/${editingCat.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName, nameAr: catNameAr || null }),
        })
      } else {
        await fetch('/api/menu/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName, nameAr: catNameAr || null }),
        })
      }
      setShowCategoryModal(false)
      loadData()
    } finally {
      setSavingCat(false)
    }
  }

  const handleDeleteCategory = async () => {
    if (confirmCatDeleteId === null) return
    await fetch(`/api/menu/categories/${confirmCatDeleteId}`, { method: 'DELETE' })
    setConfirmCatDeleteId(null)
    loadData()
  }

  // ─── Options Management ───
  const openOptionForm = (item: MenuItem, opt?: MenuItemOption) => {
    setOptionsMgmtItemId(item.id)
    if (opt) {
      setEditingOption(opt)
      setOptFormName(opt.name)
      setOptFormNameAr(opt.nameAr || '')
      setOptFormType(opt.type as 'ADD_TO_PRICE' | 'SET_PRICE')
      setOptFormRequired(opt.required)
    } else {
      setEditingOption(null)
      setOptFormName('')
      setOptFormNameAr('')
      setOptFormType('ADD_TO_PRICE')
      setOptFormRequired(false)
    }
    setShowOptionForm(true)
  }

  const handleSaveOption = async () => {
    if (!optFormName.trim() || !optionsMgmtItemId) return
    setSavingOption(true)
    try {
      const payload = { name: optFormName, nameAr: optFormNameAr || null, type: optFormType, required: optFormRequired }
      if (editingOption) {
        await fetch(`/api/menu/${optionsMgmtItemId}/options/${editingOption.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } else {
        await fetch(`/api/menu/${optionsMgmtItemId}/options`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      setShowOptionForm(false)
      loadData()
    } finally { setSavingOption(false) }
  }

  const handleDeleteOption = async (itemId: number, optId: number) => {
    await fetch(`/api/menu/${itemId}/options/${optId}`, { method: 'DELETE' })
    loadData()
  }

  const handleSaveValue = async (itemId: number, optId: number) => {
    if (!valLabel.trim()) return
    setSavingValue(true)
    try {
      await fetch(`/api/menu/${itemId}/options/${optId}/values`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: valLabel, labelAr: valLabelAr || null, price: parseFloat(valPrice) || 0, costPrice: parseFloat(valCost) || 0, isDefault: valIsDefault }),
      })
      setShowValueForm(null)
      setValLabel(''); setValLabelAr(''); setValPrice(''); setValCost(''); setValIsDefault(false)
      loadData()
    } finally { setSavingValue(false) }
  }

  const handleDeleteValue = async (itemId: number, optId: number, valId: number) => {
    await fetch(`/api/menu/${itemId}/options/${optId}/values/${valId}`, { method: 'DELETE' })
    loadData()
  }

  // ─── Custom Item (POS) ───
  const addCustomItemToCart = () => {
    if (!customName.trim() || !customPrice.trim()) return
    const price = parseFloat(customPrice)
    const cost = parseFloat(customCost) || 0
    if (isNaN(price) || price <= 0) return
    const trimmedName = customName.trim()
    if (!trimmedName) return
    const fakeItem: MenuItem = {
      id: -Date.now(), name: trimmedName, nameAr: null, price, costPrice: cost,
      imageUrl: null, isOutOfStock: false, categoryId: null, category: null, options: [],
    }
    setCart(prev => [...prev, { cartId: `custom-${Date.now()}`, menuItem: fakeItem, quantity: 1, selectedOptions: {}, lineTotal: price }])
    setShowCustomItem(false)
    setCustomName(''); setCustomPrice(''); setCustomCost('')
  }

  // ─── Expenses ───
  const handleAddExpense = async () => {
    if (!expDesc.trim() || !expAmount.trim()) return
    const amt = parseFloat(expAmount)
    if (isNaN(amt) || amt <= 0) { toast(t('barista.invalidAmount') || 'Amount must be greater than zero'); return }
    setSavingExpense(true)
    try {
      await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: expDesc.trim(), amount: parseFloat(expAmount), category: expCategory || null }),
      })
      setShowExpenseForm(false)
      setExpDesc(''); setExpAmount(''); setExpCategory('')
      loadData()
    } finally { setSavingExpense(false) }
  }

  const handleDeleteExpense = async (id: number) => {
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    loadData()
  }

  const todayExpenseTotal = expenses.reduce((s, e) => s + e.amount, 0)

  // ─── Revenue calc ───
  const totalRevenue = orders.reduce((sum, o) => sum + (o.finalPrice || o.totalPrice), 0)

  // ─── Render ───
  return (
    <PageTransition>
    <div className="flex flex-col gap-4">
      {/* Header */}
      <motion.section
        className="flex flex-col items-center justify-center text-center py-2 select-none"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-black text-white tracking-tight">{t('barista.title')}</h1>
        <p className="text-white/30 text-xs font-mono max-w-sm leading-relaxed mt-1">
          {t('barista.subtitle')}
        </p>
      </motion.section>

      {/* Tab Switch: POS / Manage */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setTab('pos')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            tab === 'pos' ? 'bg-[#F5C518] text-black' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
          }`}
        >
          <ShoppingCart size={16} /> {t('barista.pos')}
        </button>
        <button
          onClick={() => setTab('manage')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
            tab === 'manage' ? 'bg-[#F5C518] text-black' : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
          }`}
        >
          <Settings size={16} /> {t('barista.manage')}
        </button>
      </div>

      {/* Cash Register Bar */}
      <CashRegisterBar onOrderPlaced={orderPlacedCount} />

      {/* ═══════════════════════ POS TAB ═══════════════════════ */}
      {tab === 'pos' && (
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: 'calc(100vh - 240px)' }}>

          {/* ── LEFT: Category Sidebar ── */}
          <div className="col-span-2 space-y-1.5">
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                selectedCategoryId === 'all'
                  ? 'bg-[#F5C518] text-black'
                  : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/8'
              }`}
            >
              <LayoutGrid size={14} />
              {t('barista.allCategories')}
              <span className="ml-auto text-xs opacity-60">{menu.length}</span>
            </button>

            {categories.filter(c => c.isActive).map(cat => {
              const count = menu.filter(i => i.categoryId === cat.id).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                    selectedCategoryId === cat.id
                      ? 'bg-[#F5C518] text-black'
                      : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/8'
                  }`}
                >
                  <Tag size={14} />
                  <span className="truncate">{lang === 'ar' && cat.nameAr ? cat.nameAr : cat.name}</span>
                  <span className="ml-auto text-xs opacity-60">{count}</span>
                </button>
              )
            })}


            {/* Revenue Summary */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="hive-card !rounded-xl !p-3">
                <div className="text-[10px] font-bold text-white/30 uppercase">{t('barista.totalRevenue')}</div>
                <div className="text-xl font-black text-green-400">{totalRevenue.toFixed(2)} JD</div>
                <div className="text-[10px] text-white/20 mt-0.5">{orders.length} {t('barista.totalOrders')}</div>
              </div>
            </div>
          </div>

          {/* ── CENTER: Items Grid ── */}
          <div className="col-span-7">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredItems.map(item => (
                <div key={item.id} className="group relative flex flex-col h-full">
                  <button
                    onClick={() => handleItemClick(item)}
                    disabled={item.isOutOfStock}
                    className={`relative border rounded-xl overflow-hidden transition-all duration-300 text-left flex flex-col h-full
                      ${item.isOutOfStock
                        ? 'border-white/5 opacity-50 cursor-not-allowed bg-white/3'
                        : 'border-white/10 hover:border-[#F5C518] hover:shadow-[0_8px_32px_rgba(245,197,24,0.15)] cursor-pointer bg-white/5'
                      }`}
                  >
                    <div className="w-full h-20 bg-white/5 flex items-center justify-center overflow-hidden relative">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Coffee className="w-7 h-7 text-white/20" />
                      )}
                      {item.isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-500/30">
                            <Ban size={10} /> {t('barista.outOfStock')}
                          </span>
                        </div>
                      )}
                      {item.options.length > 0 && (
                        <div className="absolute top-1 left-1 bg-purple-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                          +{t('barista.options')}
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="font-bold text-white/80 text-xs truncate">
                        {lang === 'ar' && item.nameAr ? item.nameAr : item.name}
                      </div>
                      <div className="text-[#F5C518] font-black text-sm">{item.price.toFixed(2)} JD</div>
                    </div>
                  </button>
                  {/* Edit/Stock/Delete overlays */}
                  <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditForm(item) }}
                      className="w-6 h-6 rounded-md bg-blue-500/80 hover:bg-blue-600 text-white flex items-center justify-center shadow-md transition-all"
                      title={t('common.edit')}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleStock(item) }}
                      className={`w-6 h-6 rounded-md flex items-center justify-center shadow-md transition-all ${
                        item.isOutOfStock ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-orange-400 hover:bg-orange-500 text-white'
                      }`}
                      title={item.isOutOfStock ? t('barista.markInStock') : t('barista.markOutOfStock')}
                    >
                      <Ban size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id) }}
                      className="w-6 h-6 rounded-md bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-all"
                      title={t('common.delete')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Custom Item Button */}
              <div className="group relative flex flex-col h-full">
                <button
                  onClick={() => setShowCustomItem(true)}
                  className="relative border border-dashed border-white/15 hover:border-[#F5C518] rounded-xl overflow-hidden transition-all duration-300 text-left flex flex-col h-full cursor-pointer bg-white/3 hover:bg-white/5"
                >
                  <div className="w-full h-20 bg-white/3 flex items-center justify-center">
                    <PenLine className="w-7 h-7 text-white/20" />
                  </div>
                  <div className="p-2">
                    <div className="font-bold text-white/50 text-xs">{t('barista.customItem')}</div>
                    <div className="text-white/25 text-[10px]">{t('barista.addCustom')}</div>
                  </div>
                </button>
              </div>

              {filteredItems.length === 0 && (
                <div className="col-span-full py-12 text-center text-white/25 text-sm font-mono border-2 border-dashed border-white/10 rounded-xl">
                  {t('barista.emptyCategory')}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Cart ── */}
          <div className="col-span-3">
            <div className="hive-card !rounded-2xl !p-0 overflow-hidden sticky top-4">
              {/* Cart Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShoppingCart size={16} className="text-[#F5C518]" />
                  {t('barista.cart')}
                  {cartCount > 0 && (
                    <span className="bg-[#F5C518] text-black text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {cartCount}
                    </span>
                  )}
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wider"
                  >
                    {t('barista.clearCart')}
                  </button>
                )}
              </div>

              {/* Cart Items */}
              <div className="max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {cart.length === 0 ? (
                  <div className="py-10 text-center text-white/20 text-xs">
                    <ShoppingCart size={24} className="mx-auto mb-2 opacity-30" />
                    {t('barista.emptyCart')}
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {cart.map(c => (
                      <div key={c.cartId} className="px-4 py-3 group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white/80 truncate">
                              {lang === 'ar' && c.menuItem.nameAr ? c.menuItem.nameAr : c.menuItem.name}
                            </p>
                            {/* Show selected options */}
                            {Object.entries(c.selectedOptions).length > 0 && (
                              <div className="text-[10px] text-white/30 mt-0.5">
                                {Object.entries(c.selectedOptions).map(([, val]) => val.label).join(', ')}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(c.cartId)}
                            className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateCartQty(c.cartId, -1)}
                              className="w-6 h-6 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center text-xs font-bold transition-all"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="w-7 text-center text-white font-bold text-sm">{c.quantity}</span>
                            <button
                              onClick={() => updateCartQty(c.cartId, 1)}
                              className="w-6 h-6 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 flex items-center justify-center text-xs font-bold transition-all"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                          <span className="text-[#F5C518] font-black text-sm">{c.lineTotal.toFixed(2)} JD</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="border-t border-white/5 px-4 py-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white/60">{t('barista.total')}</span>
                    <span className="text-xl font-black text-[#F5C518]">{cartTotal.toFixed(2)} JD</span>
                  </div>
                  <button
                    onClick={() => { setShowCheckout(true); setPaymentMethod('CASH') }}
                    className="w-full py-3 rounded-xl bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> {t('barista.checkout')}
                  </button>
                </div>
              )}
            </div>

            {/* Recent Transactions below cart */}
            <div className="hive-card !rounded-2xl mt-4 !overflow-visible">
              <h2 className="text-[10px] font-bold mb-2 text-white/30 uppercase tracking-widest">
                {t('barista.recentTx')}
              </h2>
              <div className="max-h-[250px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                <div className="divide-y divide-white/5">
                  {orders.slice(0, 15).map(order => (
                    <div key={order.id} className="py-2 flex justify-between items-center text-xs group">
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-white/70 truncate">{order.menuItem.name} x{order.quantity}</span>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] text-white/20">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className={`text-[8px] px-1 py-0.5 rounded font-bold ${
                            order.paymentMethod === 'CASH' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>{order.paymentMethod === 'CASH' ? t('barista.cash') : t('barista.card')}</span>
                          {order.student && (
                            <span className="text-[8px] text-[#F5C518]/60">{order.student.fullName}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ms-1">
                        <span className="font-mono font-bold text-green-400 text-[10px]">+{(order.finalPrice || order.totalPrice).toFixed(2)}</span>
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="text-center text-white/25 text-xs py-4">{t('barista.noTx')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ MANAGE TAB ═══════════════════════ */}
      {tab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories Management */}
          <div className="hive-card !rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag size={18} className="text-[#F5C518]" /> {t('barista.categories')}
              </h2>
              <button
                onClick={() => openCategoryModal()}
                className="px-3 py-1.5 rounded-lg bg-[#F5C518] text-black text-xs font-bold flex items-center gap-1 hover:bg-[#D5A711] transition-all"
              >
                <FolderPlus size={14} /> {t('barista.addCategory')}
              </button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div>
                    <span className="font-bold text-white text-sm">{cat.name}</span>
                    {cat.nameAr && <span className="text-white/30 text-xs ms-2">({cat.nameAr})</span>}
                    <span className="text-white/20 text-xs ms-2">{cat._count?.items || 0} {t('barista.items')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openCategoryModal(cat)} className="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 flex items-center justify-center transition-all">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => setConfirmCatDeleteId(cat.id)} className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="text-center text-white/25 text-sm py-6 border-2 border-dashed border-white/10 rounded-xl">{t('barista.noCategories')}</div>
              )}
            </div>
          </div>

          {/* All Menu Items List with Options Management */}
          <div className="hive-card !rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <LayoutGrid size={18} className="text-[#F5C518]" /> {t('barista.menuItems')}
              </h2>
              <button onClick={openAddForm} className="px-3 py-1.5 rounded-lg bg-[#F5C518] text-black text-xs font-bold flex items-center gap-1 hover:bg-[#D5A711] transition-all">
                <Plus size={14} /> {t('barista.addItem')}
              </button>
            </div>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {menu.map(item => (
                <div key={item.id} className="rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center justify-between p-2.5 group">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <Coffee size={16} className="text-white/20" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">
                          {item.name}
                          {item.nameAr && <span className="text-white/30 ms-1 text-xs">({item.nameAr})</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#F5C518] font-bold">{item.price.toFixed(2)} JD</span>
                          {item.costPrice > 0 && <span className="text-white/20">{t('barista.cost')}: {item.costPrice.toFixed(2)}</span>}
                          {item.category && (
                            <span className="text-white/20 px-1 py-0.5 rounded bg-white/5 text-[10px]">
                              {lang === 'ar' && item.category.nameAr ? item.category.nameAr : item.category.name}
                            </span>
                          )}
                          {item.options.length > 0 && <span className="text-purple-400 text-[10px]">{item.options.length} {t('barista.options')}</span>}
                          {item.isOutOfStock && <span className="text-red-400 text-[10px] font-bold">{t('barista.outOfStock')}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setOptionsMgmtItemId(optionsMgmtItemId === item.id ? null : item.id)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${optionsMgmtItemId === item.id ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400/50 hover:text-purple-400'}`} title={t('barista.manageOptions')}>
                        <Sliders size={14} />
                      </button>
                      <button onClick={() => openEditForm(item)} className="w-7 h-7 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteItem(item.id)} className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Options Management Panel */}
                  {optionsMgmtItemId === item.id && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{t('barista.manageOptions')}</span>
                        <button onClick={() => openOptionForm(item)} className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1">
                          <Plus size={10} /> {t('barista.addOption')}
                        </button>
                      </div>

                      {item.options.length === 0 ? (
                        <p className="text-white/20 text-xs text-center py-2">{t('barista.noOptions')}</p>
                      ) : (
                        <div className="space-y-2">
                          {item.options.map(opt => (
                            <div key={opt.id} className="rounded-lg bg-white/3 border border-white/5 p-2.5">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white/70">{lang === 'ar' && opt.nameAr ? opt.nameAr : opt.name}</span>
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${opt.type === 'SET_PRICE' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                                    {opt.type === 'SET_PRICE' ? t('barista.setPrice') : t('barista.addToPrice')}
                                  </span>
                                  {opt.required && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-red-500/10 text-red-400 border border-red-500/20">{t('barista.required')}</span>}
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => openOptionForm(item, opt)} className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center hover:bg-blue-500/20"><Edit3 size={10} /></button>
                                  <button onClick={() => handleDeleteOption(item.id, opt.id)} className="w-5 h-5 rounded bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20"><Trash2 size={10} /></button>
                                </div>
                              </div>
                              {/* Values */}
                              <div className="flex flex-wrap gap-1 mb-1.5">
                                {opt.values.map(val => (
                                  <div key={val.id} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] group/val">
                                    <span className="text-white/60 font-bold">{lang === 'ar' && val.labelAr ? val.labelAr : val.label}</span>
                                    {val.price > 0 && <span className="text-[#F5C518]">{opt.type === 'SET_PRICE' ? val.price.toFixed(2) : `+${val.price.toFixed(2)}`}</span>}
                                    {val.isDefault && <span className="text-green-400 text-[8px]">✓</span>}
                                    <button onClick={() => handleDeleteValue(item.id, opt.id, val.id)} className="text-red-400/40 hover:text-red-400 opacity-0 group-hover/val:opacity-100 transition-all"><X size={8} /></button>
                                  </div>
                                ))}
                              </div>
                              {/* Add Value Form */}
                              {showValueForm === opt.id ? (
                                <div className="flex flex-wrap gap-1.5 items-end bg-white/3 rounded-lg p-2 border border-white/5">
                                  <div className="flex-1 min-w-[80px]">
                                    <label className="text-[8px] text-white/30 uppercase block mb-0.5">{t('barista.valueLabel')}</label>
                                    <input value={valLabel} onChange={e => setValLabel(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:border-purple-400 outline-none" placeholder="Small" />
                                  </div>
                                  <div className="w-16">
                                    <label className="text-[8px] text-white/30 uppercase block mb-0.5">{t('barista.valuePrice')}</label>
                                    <input type="text" inputMode="decimal" value={valPrice} onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setValPrice(e.target.value) }} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:border-purple-400 outline-none" placeholder="0.50" />
                                  </div>
                                  <div className="w-16">
                                    <label className="text-[8px] text-white/30 uppercase block mb-0.5">{t('barista.valueCost')}</label>
                                    <input type="text" inputMode="decimal" value={valCost} onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setValCost(e.target.value) }} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white focus:border-purple-400 outline-none" placeholder="0.20" />
                                  </div>
                                  <label className="flex items-center gap-1 text-[10px] text-white/40 cursor-pointer">
                                    <input type="checkbox" checked={valIsDefault} onChange={e => setValIsDefault(e.target.checked)} className="accent-purple-500 w-3 h-3" />
                                    {t('barista.default')}
                                  </label>
                                  <button onClick={() => handleSaveValue(item.id, opt.id)} disabled={savingValue || !valLabel.trim()} className="px-2 py-1 rounded bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-bold disabled:opacity-50 flex items-center gap-0.5">
                                    {savingValue ? <Loader2 size={8} className="animate-spin" /> : <Plus size={8} />} {t('common.save')}
                                  </button>
                                  <button onClick={() => setShowValueForm(null)} className="px-2 py-1 rounded bg-white/5 text-white/40 text-[10px] hover:text-white">{t('common.cancel')}</button>
                                </div>
                              ) : (
                                <button onClick={() => { setShowValueForm(opt.id); setValLabel(''); setValLabelAr(''); setValPrice(''); setValCost(''); setValIsDefault(false) }}
                                  className="text-[10px] text-purple-400/60 hover:text-purple-400 flex items-center gap-0.5 transition-all">
                                  <Plus size={8} /> {t('barista.addValue')}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {menu.length === 0 && (
                <div className="text-center text-white/25 text-sm py-6 border-2 border-dashed border-white/10 rounded-xl">{t('barista.noItems')}</div>
              )}
            </div>
          </div>

          {/* Expenses Section */}
          <div className="hive-card !rounded-2xl lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Wallet size={18} className="text-red-400" /> {t('barista.expenses')}
                {todayExpenseTotal > 0 && <span className="text-red-400 text-sm font-mono">-{todayExpenseTotal.toFixed(2)} JD</span>}
              </h2>
              <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-1 hover:bg-red-500/20 transition-all">
                <Plus size={14} /> {t('barista.addExpense')}
              </button>
            </div>
            {showExpenseForm && (
              <div className="mb-4 p-3 rounded-xl bg-white/3 border border-white/5 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-400 outline-none placeholder-white/20" placeholder={t('barista.expenseDesc')} />
                  </div>
                  <div>
                    <input type="text" inputMode="decimal" value={expAmount} onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setExpAmount(e.target.value) }} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-400 outline-none placeholder-white/20" placeholder={t('barista.expenseAmount')} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-red-400 outline-none appearance-none">
                    <option value="" className="bg-[#1A1A1A]">{t('barista.expenseCategory')}</option>
                    <option value="Ingredients" className="bg-[#1A1A1A]">{t('barista.expenseCategories.ingredients')}</option>
                    <option value="Supplies" className="bg-[#1A1A1A]">{t('barista.expenseCategories.supplies')}</option>
                    <option value="Utilities" className="bg-[#1A1A1A]">{t('barista.expenseCategories.utilities')}</option>
                    <option value="Maintenance" className="bg-[#1A1A1A]">{t('barista.expenseCategories.maintenance')}</option>
                    <option value="Other" className="bg-[#1A1A1A]">{t('barista.expenseCategories.other')}</option>
                  </select>
                  <button onClick={handleAddExpense} disabled={savingExpense || !expDesc.trim() || !expAmount.trim()} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-1">
                    {savingExpense ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t('common.save')}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-1 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {expenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-2 rounded-lg bg-white/3 group">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white/70 font-bold">{exp.description}</span>
                    {exp.category && <span className="text-[10px] text-white/20 ms-2 px-1 py-0.5 rounded bg-white/5">{exp.category}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-red-400 font-bold text-sm">-{exp.amount.toFixed(2)} JD</span>
                    <button onClick={() => handleDeleteExpense(exp.id)} className="w-5 h-5 rounded bg-red-500/10 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"><Trash2 size={10} /></button>
                  </div>
                </div>
              ))}
              {expenses.length === 0 && (
                <p className="text-center text-white/20 text-xs py-4">{t('barista.noExpenses')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ═══════════════════════ MODALS ═══════════════════════ */}

    {/* Add/Edit Item Modal */}
    <AnimatePresence>
      {showItemForm && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowItemForm(false)} />
          <motion.div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <button onClick={() => setShowItemForm(false)} className="absolute top-5 right-5 text-white/30 hover:text-white"><X size={18} /></button>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              {editingItem ? <><Edit3 size={18} className="text-[#F5C518]" /> {t('barista.editItem')}</> : <><Plus size={18} className="text-[#F5C518]" /> {t('barista.addItem')}</>}
            </h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.itemName')}</label>
                <div className="relative">
                  <Coffee className="absolute left-3 top-3 w-4 h-4 text-white/20" />
                  <input required value={itemName} onChange={e => setItemName(e.target.value)} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="Espresso" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.itemNameAr')}</label>
                <input value={itemNameAr} onChange={e => setItemNameAr(e.target.value)} dir="rtl" className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="اسبريسو" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.price')}</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-white/20" />
                    <input type="text" inputMode="decimal" required value={itemPrice} onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setItemPrice(e.target.value) }} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="2.50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.costPrice')}</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 w-4 h-4 text-white/20" />
                    <input type="text" inputMode="decimal" value={itemCostPrice} onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setItemCostPrice(e.target.value) }} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="1.00" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.category')}</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 w-4 h-4 text-white/20" />
                  <select value={itemCategoryId ?? ''} onChange={e => setItemCategoryId(e.target.value ? Number(e.target.value) : null)} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer transition-all">
                    <option value="" className="bg-[#1A1A1A]">{t('barista.noCategory')}</option>
                    {categories.map(c => <option key={c.id} value={c.id} className="bg-[#1A1A1A]">{c.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-white/20 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.image')}</label>
                {imagePreview && (
                  <div className="relative mb-2 rounded-xl overflow-hidden border border-white/10">
                    <img src={imagePreview} alt="Preview" className="w-full h-24 object-cover" />
                    <button type="button" onClick={clearImage} className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-all"><XCircle size={14} /></button>
                  </div>
                )}
                {!imagePreview && (
                  <div className="space-y-2">
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelect} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/3 border border-dashed border-white/15 hover:border-[#F5C518] text-white/40 hover:text-[#F5C518] rounded-xl text-xs font-medium transition-all">
                      <Upload size={14} /> {t('barista.uploadImage')}
                    </button>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-2.5 w-4 h-4 text-white/20" />
                      <input value={imageUrl} onChange={e => { setImageUrl(e.target.value); setImageFile(null); setImagePreview('') }} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder={t('barista.pasteUrl')} />
                    </div>
                  </div>
                )}
              </div>
              <button disabled={loading || uploading} type="submit" className="hive-btn w-full !py-3 text-sm font-bold text-[#0A0A0A] !rounded-xl flex items-center justify-center gap-2">
                {uploading ? <><Loader2 size={14} className="animate-spin" /> {t('barista.uploadingImage')}</> :
                 loading ? <Loader2 size={14} className="animate-spin" /> :
                 editingItem ? <><Check size={14} /> {t('barista.saveChanges')}</> :
                 <><Plus size={14} /> {t('barista.addItem')}</>}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Category Modal */}
    <AnimatePresence>
      {showCategoryModal && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)} />
          <motion.div className="relative w-full max-w-sm rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <button onClick={() => setShowCategoryModal(false)} className="absolute top-5 right-5 text-white/30 hover:text-white"><X size={18} /></button>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Tag size={18} className="text-[#F5C518]" /> {editingCat ? t('barista.editCategory') : t('barista.addCategory')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.categoryName')}</label>
                <input value={catName} onChange={e => setCatName(e.target.value)} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="Hot Drinks" />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.categoryNameAr')}</label>
                <input value={catNameAr} onChange={e => setCatNameAr(e.target.value)} dir="rtl" className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="مشروبات ساخنة" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCategoryModal(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all">{t('common.cancel')}</button>
                <button onClick={handleSaveCategory} disabled={savingCat || !catName.trim()} className="flex-1 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                  {savingCat ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingCat ? t('common.save') : t('common.confirm')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Options Modal (for items with options — select before adding to cart) */}
    <AnimatePresence>
      {optionsModal && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOptionsModal(null)} />
          <motion.div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <button onClick={() => setOptionsModal(null)} className="absolute top-5 right-5 text-white/30 hover:text-white"><X size={18} /></button>

            {/* Item info */}
            <div className="flex items-center gap-3 mb-4">
              {optionsModal.imageUrl ? (
                <img src={optionsModal.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center"><Coffee size={20} className="text-[#F5C518]" /></div>
              )}
              <div>
                <p className="font-bold text-white text-sm">{lang === 'ar' && optionsModal.nameAr ? optionsModal.nameAr : optionsModal.name}</p>
                <p className="text-[#F5C518] font-black text-sm">{optionsModal.price.toFixed(2)} JD</p>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-4">
              {optionsModal.options.map(opt => (
                <div key={opt.id}>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                    {lang === 'ar' && opt.nameAr ? opt.nameAr : opt.name}
                    {opt.required && <span className="text-red-400">*</span>}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {!opt.required && (
                      <button type="button" onClick={() => { const next = { ...selectedOptions }; delete next[opt.id]; setSelectedOptions(next) }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${!selectedOptions[opt.id] ? 'bg-[#F5C518]/20 border-[#F5C518] text-[#F5C518]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20'}`}>
                        {t('barista.none')}
                      </button>
                    )}
                    {opt.values.map(val => (
                      <button key={val.id} type="button" onClick={() => setSelectedOptions(prev => ({ ...prev, [opt.id]: val }))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedOptions[opt.id]?.id === val.id ? 'bg-[#F5C518]/20 border-[#F5C518] text-[#F5C518]' : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}>
                        {lang === 'ar' && val.labelAr ? val.labelAr : val.label}
                        {val.price > 0 && <span className="text-white/30 ms-1">{opt.type === 'SET_PRICE' ? val.price.toFixed(2) : `+${val.price.toFixed(2)}`}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5 block">{t('barista.quantity')}</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOptionsQuantity(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 transition-all">-</button>
                <span className="w-10 text-center text-white font-bold text-lg">{optionsQuantity}</span>
                <button type="button" onClick={() => setOptionsQuantity(q => Math.min(99, q + 1))} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 transition-all">+</button>
              </div>
            </div>

            <button onClick={confirmOptionsAndAdd} className="w-full py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all flex items-center justify-center gap-1">
              <ShoppingCart size={14} /> {t('barista.addToCart')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Checkout Modal */}
    <AnimatePresence>
      {showCheckout && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckout(false)} />
          <motion.div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <button onClick={() => setShowCheckout(false)} className="absolute top-5 right-5 text-white/30 hover:text-white"><X size={18} /></button>
            <h3 className="text-lg font-bold text-white mb-4">{t('barista.checkout')}</h3>

            {/* Cart summary */}
            <div className="space-y-1.5 mb-4 p-3 rounded-xl bg-white/5 border border-white/5 max-h-[200px] overflow-y-auto">
              {cart.map(c => (
                <div key={c.cartId} className="flex justify-between text-sm">
                  <span className="text-white/70">{c.quantity}x {lang === 'ar' && c.menuItem.nameAr ? c.menuItem.nameAr : c.menuItem.name}</span>
                  <span className="text-white font-bold">{c.lineTotal.toFixed(2)} JD</span>
                </div>
              ))}
            </div>

            {/* Payment Method */}
            <div className="mb-4">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5 block">{t('barista.paymentMethod')}</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPaymentMethod('CASH')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border ${paymentMethod === 'CASH' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
                  <Banknote size={16} /> {t('barista.cash')}
                </button>
                <button type="button" onClick={() => setPaymentMethod('CARD')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 border ${paymentMethod === 'CARD' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
                  <CreditCard size={16} /> {t('barista.card')}
                </button>
              </div>
            </div>

            {/* Student link */}
            <div className="mb-4">
              <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1.5 block">{t('barista.linkStudent')}</label>
              {selectedStudent ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/20">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-[#F5C518]" />
                    <span className="text-sm font-bold text-white">{selectedStudent.fullName}</span>
                  </div>
                  <button onClick={() => { setSelectedStudent(null); setStudentSearch('') }} className="text-white/40 hover:text-red-400"><X size={14} /></button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-white/20" />
                  <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder={t('barista.searchStudent')} className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/20 focus:border-[#F5C518] outline-none" />
                  {searchingStudents && <Loader2 size={14} className="absolute right-3 top-2.5 text-white/30 animate-spin" />}
                  {studentResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-white/10 overflow-hidden z-10" style={{ background: '#1A1A1A' }}>
                      {studentResults.map(s => (
                        <button key={s.id} onClick={() => { setSelectedStudent(s); setStudentSearch(''); setStudentResults([]) }}
                          className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors">
                          <User size={12} className="text-white/30" /> {s.fullName}
                          {s.studentNumber && <span className="text-white/25 text-xs">#{s.studentNumber}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="p-3 rounded-xl bg-[#F5C518]/10 border border-[#F5C518]/20 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white/70">{t('barista.total')} ({cart.length} {t('barista.cartItems')})</span>
                <span className="text-xl font-black text-[#F5C518]">{cartTotal.toFixed(2)} JD</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCheckout(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all">{t('common.cancel')}</button>
              <button onClick={handleCheckout} disabled={placingOrder} className="flex-1 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                {placingOrder ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {t('barista.placeOrder')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Receipt Modal (multi-item) */}
    <AnimatePresence>
      {receiptData && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReceiptData(null)} />
          <motion.div className="relative w-full max-w-xs rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <button onClick={() => setReceiptData(null)} className="absolute top-5 right-5 text-white/30 hover:text-white"><X size={18} /></button>

            <div className="text-center mb-4">
              <Receipt size={32} className="text-[#F5C518] mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">{t('barista.orderComplete')}</h3>
              <p className="text-white/30 text-xs font-mono mt-1">{receiptData.receiptNumber}</p>
            </div>

            <div className="space-y-2 mb-4 p-3 rounded-xl bg-white/5 border border-white/5 max-h-[250px] overflow-y-auto">
              {receiptData.orders.map((o, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white/70">{o.quantity}x {o.menuItem.name}</span>
                  <span className="text-white font-bold">{(o.finalPrice || o.totalPrice).toFixed(2)} JD</span>
                </div>
              ))}
              <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                <span className="text-white/50">{t('barista.paymentMethod')}</span>
                <span className={`font-bold ${receiptData.paymentMethod === 'CASH' ? 'text-green-400' : 'text-blue-400'}`}>
                  {receiptData.paymentMethod === 'CASH' ? t('barista.cash') : t('barista.card')}
                </span>
              </div>
              {receiptData.student && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">{t('barista.student')}</span>
                  <span className="text-white font-bold">{receiptData.student.fullName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                <span className="text-white font-bold">{t('barista.total')}</span>
                <span className="text-[#F5C518] font-black text-lg">{receiptData.total.toFixed(2)} JD</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => { window.open(`/barista/receipt/${receiptData.orders[0]?.id || receiptData.receiptNumber}`, '_blank') }}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all flex items-center justify-center gap-1">
                <Printer size={14} /> {t('barista.print')}
              </button>
              <button onClick={() => setReceiptData(null)} className="flex-1 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all">{t('common.done')}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Custom Item Modal */}
    <AnimatePresence>
      {showCustomItem && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCustomItem(false)} />
          <motion.div className="relative w-full max-w-xs rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <button onClick={() => setShowCustomItem(false)} className="absolute top-5 right-5 text-white/30 hover:text-white"><X size={18} /></button>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <PenLine size={18} className="text-[#F5C518]" /> {t('barista.customItem')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.customItemName')}</label>
                <input value={customName} onChange={e => setCustomName(e.target.value)} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="Custom drink..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.customItemPrice')}</label>
                  <input type="text" inputMode="decimal" value={customPrice} onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setCustomPrice(e.target.value) }} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="3.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.customItemCost')}</label>
                  <input type="text" inputMode="decimal" value={customCost} onChange={e => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setCustomCost(e.target.value) }} className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="1.00" />
                </div>
              </div>
              <button onClick={addCustomItemToCart} disabled={!customName.trim() || !customPrice.trim()} className="w-full py-2.5 rounded-xl bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                <ShoppingCart size={14} /> {t('barista.addToCart')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Option Form Modal */}
    <AnimatePresence>
      {showOptionForm && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOptionForm(false)} />
          <motion.div className="relative w-full max-w-xs rounded-2xl border border-white/10 p-6" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #0F0F0F 100%)' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
            <button onClick={() => setShowOptionForm(false)} className="absolute top-5 right-5 text-white/30 hover:text-white"><X size={18} /></button>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sliders size={18} className="text-purple-400" /> {editingOption ? t('barista.editOption') : t('barista.addOption')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.optionName')}</label>
                <input value={optFormName} onChange={e => setOptFormName(e.target.value)} className="w-full bg-white/5 border border-white/10 focus:border-purple-400 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="Size, Topping..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.optionNameAr')}</label>
                <input value={optFormNameAr} onChange={e => setOptFormNameAr(e.target.value)} dir="rtl" className="w-full bg-white/5 border border-white/10 focus:border-purple-400 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-white/20 transition-all" placeholder="الحجم" />
              </div>
              <div>
                <label className="block text-xs font-bold text-white/30 uppercase tracking-wider mb-1">{t('barista.optionType')}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOptFormType('ADD_TO_PRICE')} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${optFormType === 'ADD_TO_PRICE' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-white/5 border-white/10 text-white/40'}`}>{t('barista.addToPrice')}</button>
                  <button type="button" onClick={() => setOptFormType('SET_PRICE')} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${optFormType === 'SET_PRICE' ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-white/5 border-white/10 text-white/40'}`}>{t('barista.setPrice')}</button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/50 cursor-pointer">
                <input type="checkbox" checked={optFormRequired} onChange={e => setOptFormRequired(e.target.checked)} className="accent-purple-500 w-4 h-4" />
                {t('barista.required')}
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowOptionForm(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white text-sm font-bold transition-all">{t('common.cancel')}</button>
                <button onClick={handleSaveOption} disabled={savingOption || !optFormName.trim()} className="flex-1 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                  {savingOption ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {t('common.save')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Delete Item Confirm */}
    <ConfirmModal open={confirmOpen} onClose={() => { setConfirmOpen(false); setConfirmDeleteId(null) }} onConfirm={executeDeleteItem} title={t('barista.deleteItem')} message={t('barista.deleteItemMsg')} confirmLabel={t('common.delete')} variant="danger" />

    {/* Delete Category Confirm */}
    <ConfirmModal open={confirmCatDeleteId !== null} onClose={() => setConfirmCatDeleteId(null)} onConfirm={handleDeleteCategory} title={t('barista.deleteCategory')} message={t('barista.deleteCategoryMsg')} confirmLabel={t('common.delete')} variant="danger" />
    </PageTransition>
  )
}
