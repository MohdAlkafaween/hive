'use client'
import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, Save, Edit3, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface Plan {
  id: number
  name: string
  nameAr: string | null
  durationDays: number
  totalVisits: number
  price: number
  isActive: boolean
  sortOrder: number
}

export function PlansSection() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Partial<Plan>>({})
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newPlan, setNewPlan] = useState({ name: '', nameAr: '', price: '', durationDays: '', totalVisits: '', sortOrder: '0' })
  const [adding, setAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/plans')
      if (res.ok) setPlans(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPlans() }, [])

  const handleAdd = async () => {
    if (!newPlan.name.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlan.name,
          nameAr: newPlan.nameAr || null,
          price: Number(newPlan.price) || 0,
          durationDays: Number(newPlan.durationDays) || 30,
          totalVisits: Number(newPlan.totalVisits) || 30,
          sortOrder: Number(newPlan.sortOrder) || 0,
        }),
      })
      if (res.ok) {
        toast(t('plans.created'), 'success')
        setShowAdd(false)
        setNewPlan({ name: '', nameAr: '', price: '', durationDays: '', totalVisits: '', sortOrder: '0' })
        fetchPlans()
      } else {
        const d = await res.json().catch(() => ({}))
        toast(d.error || 'Failed', 'error')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleSave = async (id: number) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        setEditingId(null)
        fetchPlans()
        toast(t('plans.saved'), 'success')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/plans/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteId(null)
        fetchPlans()
        toast(t('plans.deleted'), 'success')
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleToggle = async (plan: Plan) => {
    await fetch(`/api/plans/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !plan.isActive }),
    })
    fetchPlans()
  }

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id)
    setEditData({ name: plan.name, nameAr: plan.nameAr, price: plan.price, durationDays: plan.durationDays, totalVisits: plan.totalVisits, sortOrder: plan.sortOrder })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={24} className="animate-spin text-[#F5C518]" />
    </div>
  )

  const inputClass = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#F5C518] outline-none w-full'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-white/30">{t('plans.desc')}</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all"
        >
          <Plus size={16} /> {t('plans.add')}
        </button>
      </div>

      {showAdd && (
        <div className="hive-card !rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white">{t('plans.newPlan')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.nameEn')}</label>
              <input value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} className={inputClass} placeholder="e.g. Monthly" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.nameAr')}</label>
              <input value={newPlan.nameAr} onChange={e => setNewPlan({ ...newPlan, nameAr: e.target.value })} className={inputClass} placeholder="مثلاً شهري" dir="rtl" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.price')}</label>
              <input value={newPlan.price} onChange={e => setNewPlan({ ...newPlan, price: e.target.value })} className={inputClass} type="number" placeholder="50" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.durationDays')}</label>
              <input value={newPlan.durationDays} onChange={e => setNewPlan({ ...newPlan, durationDays: e.target.value })} className={inputClass} type="number" placeholder="30" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.totalVisits')}</label>
              <input value={newPlan.totalVisits} onChange={e => setNewPlan({ ...newPlan, totalVisits: e.target.value })} className={inputClass} type="number" placeholder="30" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.sortOrder')}</label>
              <input value={newPlan.sortOrder} onChange={e => setNewPlan({ ...newPlan, sortOrder: e.target.value })} className={inputClass} type="number" placeholder="0" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={adding || !newPlan.name.trim()}
              className="px-4 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2">
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t('plans.create')}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 rounded-lg bg-white/5 text-white/50 font-bold text-sm hover:bg-white/10 transition-all">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="text-center py-12 text-white/20">
          <p className="text-sm">{t('plans.noPlansDefined')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className={`hive-card !rounded-2xl ${!plan.isActive ? 'opacity-50' : ''}`}>
              {editingId === plan.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.nameEn')}</label>
                      <input value={editData.name || ''} onChange={e => setEditData({ ...editData, name: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.nameAr')}</label>
                      <input value={editData.nameAr || ''} onChange={e => setEditData({ ...editData, nameAr: e.target.value })} className={inputClass} dir="rtl" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.price')}</label>
                      <input value={editData.price ?? ''} onChange={e => setEditData({ ...editData, price: Number(e.target.value) })} className={inputClass} type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.durationDays')}</label>
                      <input value={editData.durationDays ?? ''} onChange={e => setEditData({ ...editData, durationDays: Number(e.target.value) })} className={inputClass} type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.totalVisits')}</label>
                      <input value={editData.totalVisits ?? ''} onChange={e => setEditData({ ...editData, totalVisits: Number(e.target.value) })} className={inputClass} type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 font-bold uppercase">{t('plans.sortOrder')}</label>
                      <input value={editData.sortOrder ?? ''} onChange={e => setEditData({ ...editData, sortOrder: Number(e.target.value) })} className={inputClass} type="number" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(plan.id)} disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F5C518] text-black font-bold text-xs hover:bg-[#D5A711] disabled:opacity-40">
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {t('plans.save')}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-white/50 font-bold text-xs hover:bg-white/10">
                      <X size={12} /> {t('common.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{plan.name}{plan.nameAr ? ` / ${plan.nameAr}` : ''}</h4>
                    <p className="text-[10px] text-white/30 mt-1">
                      {plan.price} JOD · {plan.durationDays} {t('admin.daysLabel')} · {plan.totalVisits} {t('plans.visits')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggle(plan)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                      {plan.isActive ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} className="text-white/20" />}
                    </button>
                    <button onClick={() => startEdit(plan)} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => setDeleteId(plan.id)} className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-white/20 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleteId !== null}
        title={t('plans.deletePlan')}
        message={t('plans.deleteConfirm')}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  )
}
