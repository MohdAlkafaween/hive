'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, CreditCard, RefreshCw, Loader2, User, Phone, BookOpen, Activity, Calendar, Hash, CheckCircle, XCircle, Trash2, AlertTriangle, Edit3, Save, Plus, Minus, Camera, Snowflake, QrCode, StickyNote, Send, X, Coffee } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { RenewModal } from './RenewModal'
import { ReceiptModal, type ReceiptData } from '@/components/dashboard/ReceiptModal'

// QR code canvas component using the qrcode library
function QrCanvas({ value, size = 192 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!value || !canvasRef.current) return
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      })
    }).catch(() => {})
  }, [value, size])
  return <canvas ref={canvasRef} />
}

interface Student {
  id: number
  fullName: string
  phone: string
  major?: string
  rfidUuid?: string
  photoUrl?: string
  qrToken?: string
  lifetimeCheckIns: number
  createdAt: string
  subscriptions: Subscription[]
  logs: Log[]
  transactions: Transaction[]
}
interface Subscription {
  id: number; planType: string; startDate: string; expiryDate: string
  totalVisitsAllowed: number; visitsUsed: number; isActive: boolean; createdAt: string
  isFrozen?: boolean; frozenAt?: string; freezeDays?: number
}
interface Log { id: number; checkInTime: string; checkOutTime?: string; date: string }
interface Transaction { id: number; amountPaid: number; planType: string; gateway: string; discountAmount: number; createdAt: string }
interface Note { id: number; content: string; authorName: string; createdAt: string }
interface BaristaOrderItem { id: number; quantity: number; totalPrice: number; createdAt: string; menuItem: { name: string; price: number } }

interface ProfileViewProps {
  studentId: number
  onBack: () => void
}

export function ProfileView({ studentId, onBack }: ProfileViewProps) {
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [renewOpen, setRenewOpen] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [linkingRfid, setLinkingRfid] = useState(false)
  const [rfidStatus, setRfidStatus] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Edit entries state
  const [editingEntries, setEditingEntries] = useState(false)
  const [entryAdjust, setEntryAdjust] = useState(0)
  const [savingEntries, setSavingEntries] = useState(false)

  // Photo upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Freeze state
  const [freezing, setFreezing] = useState(false)

  // Notes state
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  // QR modal state
  const [qrOpen, setQrOpen] = useState(false)
  const [qrEnabled, setQrEnabled] = useState(false)

  // Barista orders state
  const [baristaOrders, setBaristaOrders] = useState<BaristaOrderItem[]>([])

  // Edit profile state
  const [editingProfile, setEditingProfile] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editMajor, setEditMajor] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const fetchStudent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/students/${studentId}`)
      if (res.ok) setStudent(await res.json())
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => { fetchStudent() }, [fetchStudent])

  useEffect(() => {
    if (!linkingRfid) return
    let buf = '', lastKey = 0
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buf.length >= 4) linkRfid(buf)
        buf = ''
        return
      }
      const now = Date.now()
      if (now - lastKey > 100) buf = ''
      lastKey = now
      if (e.key.length === 1) buf += e.key
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [linkingRfid])  // eslint-disable-line react-hooks/exhaustive-deps

  const linkRfid = async (uuid: string) => {
    setLinkingRfid(false)
    setRfidStatus('Linking…')
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfidUuid: uuid }),
      })
      if (res.ok) {
        setRfidStatus(`Linked: ${uuid}`)
        fetchStudent()
      } else {
        const d = await res.json().catch(() => ({}))
        setRfidStatus(d.error ?? 'Failed to link card.')
      }
    } catch {
      setRfidStatus('Failed to link.')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteOpen(false)
        onBack()
      } else {
        const d = await res.json().catch(() => ({}))
        setDeleteError(d.error ?? 'Failed to delete student.')
      }
    } catch {
      setDeleteError('Failed to delete student.')
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveEntries = async (sub: Subscription) => {
    if (entryAdjust === 0) return
    setSavingEntries(true)
    try {
      const newTotal = Math.max(0, sub.totalVisitsAllowed + entryAdjust)
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalVisitsAllowed: newTotal }),
      })
      if (res.ok) {
        setEditingEntries(false)
        setEntryAdjust(0)
        fetchStudent()
      }
    } finally {
      setSavingEntries(false)
    }
  }

  // Fetch notes
  useEffect(() => {
    fetch(`/api/students/${studentId}/notes`)
      .then(r => r.ok ? r.json() : [])
      .then(setNotes)
      .catch(() => {})
  }, [studentId])

  // Check if QR codes are enabled
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, string>) => setQrEnabled(s.qrEnabled === 'true'))
      .catch(() => {})
  }, [])

  // Fetch barista orders linked to this student
  useEffect(() => {
    fetch(`/api/students/${studentId}/orders`)
      .then(r => r.ok ? r.json() : [])
      .then(setBaristaOrders)
      .catch(() => {})
  }, [studentId])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const res = await fetch(`/api/students/${studentId}/photo`, { method: 'POST', body: formData })
      if (res.ok) fetchStudent()
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFreeze = async (subId: number, freeze: boolean) => {
    setFreezing(true)
    try {
      await fetch(`/api/subscriptions/${subId}/freeze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: freeze ? 'freeze' : 'unfreeze' }),
      })
      fetchStudent()
    } finally {
      setFreezing(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/students/${studentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      })
      if (res.ok) {
        const note = await res.json()
        setNotes(prev => [note, ...prev])
        setNewNote('')
      }
    } finally {
      setAddingNote(false)
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    const res = await fetch(`/api/students/${studentId}/notes?noteId=${noteId}`, { method: 'DELETE' })
    if (res.ok) setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  const handleStartEdit = () => {
    if (!student) return
    setEditName(student.fullName)
    setEditPhone(student.phone)
    setEditMajor(student.major || '')
    setEditingProfile(true)
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: editName, phone: editPhone, major: editMajor || null }),
      })
      if (res.ok) {
        setEditingProfile(false)
        fetchStudent()
      }
    } finally {
      setSavingProfile(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <Loader2 size={32} className="animate-spin text-[#F5C518]" />
      <p className="text-sm font-bold text-white/30 uppercase tracking-widest">Loading Profile...</p>
    </div>
  )
  if (!student) return <div className="p-8 text-white/30 text-center font-medium">Student not found.</div>

  const activeSub = student.subscriptions.find((s) => s.isActive && new Date(s.expiryDate) > new Date())
  const daysLeft = activeSub
    ? Math.max(0, Math.ceil((new Date(activeSub.expiryDate).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            {editingProfile ? (
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="text-3xl font-black text-white tracking-tight bg-transparent border-b-2 border-[#F5C518] outline-none w-64" autoFocus />
            ) : (
              <h1 className="text-3xl font-black text-white tracking-tight">{student.fullName}</h1>
            )}
            {activeSub ? (
              <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle size={12} className="text-green-400" /> Active
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <XCircle size={12} className="text-red-400" /> Expired
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editingProfile ? (
            <>
              <button onClick={() => setEditingProfile(false)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white/50 rounded-xl text-sm font-bold hover:bg-white/10 transition-all">
                <X size={16} /> Cancel
              </button>
              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#F5C518] text-black rounded-xl text-sm font-bold hover:bg-[#D5A711] transition-all disabled:opacity-40">
                {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
              </button>
            </>
          ) : (
            <>
              <button onClick={handleStartEdit}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white/50 rounded-xl text-sm font-bold hover:bg-white/10 hover:text-white transition-all">
                <Edit3 size={16} /> Edit
              </button>
              <button onClick={() => { setDeleteOpen(true); setDeleteError('') }}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/20 hover:border-red-500/30 transition-all">
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info card */}
        <div className="hive-card !rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/100/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-5 flex items-center gap-2">
            <User size={14} className="text-[#F5C518]" />
            Personal Info
          </h2>
          <div className="space-y-5 relative z-10">
            {/* Student Photo */}
            <div className="flex items-center gap-4 mb-2">
              <div className="relative group/photo">
                <div className="w-16 h-16 rounded-full border-2 border-white/10 overflow-hidden bg-white/5 flex items-center justify-center">
                  {student.photoUrl ? (
                    <img src={student.photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <User size={28} className="text-white/20" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity"
                >
                  {uploadingPhoto ? <Loader2 size={16} className="animate-spin text-white" /> : <Camera size={16} className="text-white" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{student.fullName}</p>
                <p className="text-[10px] text-white/30 font-medium">ID #{student.id} • Joined {new Date(student.createdAt).toLocaleDateString('en-JO', { month: 'short', year: 'numeric' })}</p>
              </div>
            </div>

            {editingProfile ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Phone</label>
                  <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#F5C518] outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Major</label>
                  <input value={editMajor} onChange={(e) => setEditMajor(e.target.value)} placeholder="Optional"
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#F5C518] outline-none placeholder:text-white/20" />
                </div>
              </div>
            ) : (
              <>
                <InfoRow icon={<Phone size={14} />} label="Phone" value={student.phone} />
                {student.major && <InfoRow icon={<BookOpen size={14} />} label="Major" value={student.major} />}
              </>
            )}
            <InfoRow icon={<Activity size={14} />} label="Lifetime Check-Ins" value={student.lifetimeCheckIns.toString()} accent />
            <InfoRow icon={<CreditCard size={14} />} label="RFID" value={student.rfidUuid ?? 'Not Linked'} />

            <div className="pt-4 border-t border-white/8">
              <Button
                variant={linkingRfid ? 'danger' : 'secondary'}
                size="sm"
                className={`w-full py-5 text-sm font-bold shadow-sm ${linkingRfid ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-[#1A1A1A] border-[#333] text-white hover:bg-[#2A2A2A]'}`}
                onClick={() => { setLinkingRfid((v) => !v); setRfidStatus('') }}
              >
                {linkingRfid ? <Loader2 size={16} className="animate-spin mr-2" /> : <CreditCard size={16} className="mr-2" />}
                {linkingRfid ? 'Waiting for card swipe...' : student.rfidUuid ? 'Issue Replacement Card' : 'Link New Card'}
              </Button>
              {rfidStatus && <p className="text-xs font-bold text-[#F5C518] text-center mt-3 animate-pulse">{rfidStatus}</p>}
            </div>
          </div>
        </div>

        {/* Subscription card */}
        <div className="hive-card !rounded-2xl relative overflow-hidden">
          {activeSub && <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />}
          <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-5 flex items-center gap-2">
            <Calendar size={14} className="text-[#F5C518]" />
            Current Subscription
          </h2>
          
          {activeSub ? (
            <div className="space-y-5 relative z-10">
              <div className="flex items-center justify-between">
                <div className="inline-block px-3 py-1 bg-yellow-500/10 text-[#F5C518] border border-yellow-500/20 rounded-md text-[11px] font-bold uppercase tracking-widest">
                  {activeSub.planType} Pass
                </div>
                {activeSub.planType !== 'Daily' && !editingEntries && (
                  <button
                    onClick={() => { setEditingEntries(true); setEntryAdjust(0) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-[#F5C518] hover:border-[#F5C518]/30 text-xs font-medium transition-all"
                  >
                    <Edit3 size={12} /> Edit Entries
                  </button>
                )}
              </div>

              {/* Edit entries panel */}
              {editingEntries && activeSub.planType !== 'Daily' && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(245, 197, 24, 0.05)', border: '1px solid rgba(245, 197, 24, 0.15)' }}>
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3">Adjust Total Entries</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEntryAdjust(v => v - 1)}
                      className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-red-400 hover:border-red-500/30 transition-all">
                      <Minus size={16} />
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-black text-white">{activeSub.totalVisitsAllowed + entryAdjust}</span>
                      <span className="text-xs text-white/25 ml-2">total entries</span>
                      {entryAdjust !== 0 && (
                        <span className={`ml-2 text-xs font-bold ${entryAdjust > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ({entryAdjust > 0 ? '+' : ''}{entryAdjust})
                        </span>
                      )}
                    </div>
                    <button onClick={() => setEntryAdjust(v => v + 1)}
                      className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-green-400 hover:border-green-500/30 transition-all">
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setEditingEntries(false); setEntryAdjust(0) }}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-medium hover:bg-white/10 transition-all">Cancel</button>
                    <button onClick={() => handleSaveEntries(activeSub)} disabled={entryAdjust === 0 || savingEntries}
                      className="flex-1 px-3 py-2 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
                      {savingEntries ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Days Left" value={daysLeft.toString()} sub="calendar days" />
                <StatCard
                  label="Visits"
                  value={activeSub.planType === 'Daily' ? '∞' : `${activeSub.totalVisitsAllowed - activeSub.visitsUsed}`}
                  sub={activeSub.planType === 'Daily' ? 'unlimited today' : `of ${activeSub.totalVisitsAllowed} remaining`}
                />
                <StatCard label="Expires" value={new Date(activeSub.expiryDate).toLocaleDateString('en-JO', { month: 'short', day: 'numeric', year: 'numeric' })} sub="" />
                <StatCard label="Started"  value={new Date(activeSub.startDate).toLocaleDateString('en-JO', { month: 'short', day: 'numeric', year: 'numeric' })} sub="" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[180px] bg-white/3 rounded-xl border border-dashed border-white/8">
              <XCircle size={32} className="text-white/25 mb-2" />
              <p className="text-sm font-medium text-white/30">No active subscription.</p>
            </div>
          )}
          
          {/* Freeze/Unfreeze button */}
          {activeSub && !activeSub.isFrozen && (
            <button
              onClick={() => handleFreeze(activeSub.id, true)}
              disabled={freezing}
              className="w-full mt-3 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-40"
            >
              {freezing ? <Loader2 size={14} className="animate-spin" /> : <Snowflake size={14} />}
              Freeze Subscription
            </button>
          )}
          {activeSub?.isFrozen && (
            <div className="mt-3 space-y-2">
              <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <p className="text-xs font-bold text-blue-400 flex items-center justify-center gap-1.5">
                  <Snowflake size={12} /> Subscription Frozen
                </p>
                <p className="text-[10px] text-blue-300/60 mt-0.5">
                  Frozen {activeSub.freezeDays || 0} days total
                </p>
              </div>
              <button
                onClick={() => handleFreeze(activeSub.id, false)}
                disabled={freezing}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-40"
              >
                {freezing ? <Loader2 size={14} className="animate-spin" /> : <Snowflake size={14} />}
                Unfreeze Subscription
              </button>
            </div>
          )}

          <Button onClick={() => setRenewOpen(true)} className="w-full mt-5 py-6 text-base font-bold shadow-[0_4px_20px_rgba(245,197,24,0.15)] bg-[#F5C518] hover:bg-[#D4A017] text-white relative z-10">
            <RefreshCw size={18} className="mr-2" />
            Renew Subscription
          </Button>
        </div>

        {/* Recent logs */}
        <div className="border border-white/8 rounded-2xl p-6 flex flex-col" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Hash size={14} className="text-[#F5C518]" />
            Recent Check-Ins
          </h2>

          {/* Visit frequency — last 4 weeks */}
          {student.logs.length > 0 && (() => {
            const weeks: number[] = [0, 0, 0, 0]
            const now = Date.now()
            student.logs.forEach(l => {
              const age = Math.floor((now - new Date(l.checkInTime).getTime()) / (7 * 86400000))
              if (age < 4) weeks[age]++
            })
            const max = Math.max(...weeks, 1)
            return (
              <div className="flex items-end gap-1.5 h-10 mb-4 px-1">
                {[...weeks].reverse().map((count, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full rounded-sm transition-all" style={{
                      height: `${Math.max(4, (count / max) * 32)}px`,
                      background: count > 0 ? 'rgba(245, 197, 24, 0.5)' : 'rgba(255,255,255,0.05)',
                    }} />
                    <span className="text-[8px] text-white/20 font-bold">{i === 3 ? 'This' : `${3 - i}w`}</span>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Session Duration Average */}
          {(() => {
            const sessions = student.logs.filter(l => l.checkOutTime)
            if (sessions.length === 0) return null
            const avgMs = sessions.reduce((s, l) => s + (new Date(l.checkOutTime!).getTime() - new Date(l.checkInTime).getTime()), 0) / sessions.length
            const avgH = Math.floor(avgMs / 3600000)
            const avgM = Math.floor((avgMs % 3600000) / 60000)
            return (
              <div className="flex items-center gap-2 mb-3 px-1">
                <Activity size={12} className="text-white/20" />
                <span className="text-[10px] text-white/25 font-bold">Avg session: <span className="text-white/50">{avgH}h {avgM}m</span></span>
              </div>
            )
          })()}

          <div className="space-y-2 flex-1 overflow-auto pr-2 custom-scrollbar">
            {student.logs.slice(0, 15).map((log) => (
              <div key={log.id} className="flex justify-between items-center p-3 rounded-lg bg-white/3 hover:bg-white/5 transition-colors border border-white/8 text-sm">
                <span className="font-medium text-white/30">{new Date(log.date).toLocaleDateString('en-JO', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span className="font-bold text-white/80 bg-white/8 px-2 py-1 rounded border border-white/10">{new Date(log.checkInTime).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
            {student.logs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-white/25">
                <p className="text-sm font-medium">No check-ins recorded.</p>
              </div>
            )}
          </div>

          {/* QR Code Button — only shown when QR is enabled in admin settings */}
          {qrEnabled && student.qrToken && (
            <button
              onClick={() => setQrOpen(true)}
              className="mt-4 w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
            >
              <QrCode size={16} />
              Show QR Code
            </button>
          )}
        </div>
      </div>

      {/* Notes Section */}
      <div className="border border-white/8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-5 flex items-center gap-2">
          <StickyNote size={14} className="text-[#F5C518]" />
          Notes
        </h2>
        <div className="flex gap-2 mb-4">
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote() } }}
            placeholder="Add a note about this student..."
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#F5C518]/40 focus:outline-none transition-colors"
            maxLength={1000}
          />
          <button
            onClick={handleAddNote}
            disabled={addingNote || !newNote.trim()}
            className="px-4 py-3 rounded-xl bg-[#F5C518] hover:bg-[#D4A017] text-black font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 transition-all"
          >
            {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <div className="space-y-2 max-h-[200px] overflow-auto pr-2 custom-scrollbar">
          {notes.map((note) => (
            <div key={note.id} className="group flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{note.content}</p>
                <p className="text-[10px] text-white/25 mt-1.5 font-medium">
                  {note.authorName.split('@')[0]} • {new Date(note.createdAt).toLocaleDateString('en-JO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => handleDeleteNote(note.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {notes.length === 0 && (
            <p className="text-sm text-white/20 text-center py-4">No notes yet.</p>
          )}
        </div>
      </div>

      {/* Barista Purchase History */}
      {baristaOrders.length > 0 && (
        <div className="border border-white/8 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Coffee size={14} className="text-[#F5C518]" />
              Barista Purchases
            </h2>
            <span className="text-[10px] font-bold text-white/25 px-2 py-1 rounded-md bg-white/5 border border-white/8">
              {baristaOrders.length} orders · {baristaOrders.reduce((s, o) => s + o.totalPrice, 0).toFixed(2)} JD total
            </span>
          </div>
          <div className="space-y-1.5 max-h-[220px] overflow-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {baristaOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F5C518]/10">
                    <Coffee size={14} className="text-[#F5C518]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white/80">{order.menuItem.name}{order.quantity > 1 ? ` x${order.quantity}` : ''}</p>
                    <p className="text-[10px] text-white/25">
                      {new Date(order.createdAt).toLocaleDateString('en-JO', { month: 'short', day: 'numeric' })} at {new Date(order.createdAt).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-black text-[#F5C518]">{order.totalPrice.toFixed(2)} JD</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscription history */}
      <div className="border border-white/8 rounded-2xl p-6 mt-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <h2 className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Calendar size={14} className="text-[#F5C518]" />
          Subscription History
        </h2>
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full text-sm text-left">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>
                {['Plan', 'Start Date', 'Expiry Date', 'Visits Used', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-4 text-[11px] font-bold text-white/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {student.subscriptions.map((s) => {
                const isActive = s.isActive && new Date(s.expiryDate) > new Date();
                return (
                  <tr key={s.id} className="border-b border-white/8/50 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4 font-bold text-white">{s.planType}</td>
                    <td className="px-5 py-4 font-medium text-white/30">{new Date(s.startDate).toLocaleDateString('en-JO', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="px-5 py-4 font-medium text-white/30">{new Date(s.expiryDate).toLocaleDateString('en-JO', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="px-5 py-4 font-medium text-white/30">{s.planType === 'Daily' ? '—' : <span className="font-bold text-white/80 bg-white/8 px-2 py-0.5 rounded">{s.visitsUsed} / {s.totalVisitsAllowed}</span>}</td>
                    <td className="px-5 py-4">
                      {isActive ? (
                        <span className="px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-[10px] font-bold uppercase tracking-widest">Active</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[10px] font-bold uppercase tracking-widest">Expired</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {student.subscriptions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-white/30 font-medium">No subscription history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RenewModal
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        studentId={student.id}
        studentName={student.fullName}
        onRenewed={(data) => {
          if (data) setReceiptData(data)
          fetchStudent()
        }}
      />

      <ReceiptModal
        open={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />

      {/* Delete Confirmation Modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Student" maxWidth="max-w-md">
        <div className="space-y-5">
          <div className="flex items-start gap-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-700">This action cannot be undone.</p>
              <p className="text-sm text-red-600 mt-1">
                Deleting <span className="font-bold">{student.fullName}</span> will permanently remove their profile. Check-in logs, transactions, and subscription records will be preserved for audit purposes.
              </p>
            </div>
          </div>

          {deleteError && (
            <p className="text-sm font-medium text-red-700 bg-red-50 p-3 rounded-lg border border-red-200">{deleteError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              onClick={() => setDeleteOpen(false)}
              className="flex-1 py-5 bg-[#2A2A2A] border-[#3A3A3A] text-white hover:bg-[#3A3A3A]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-[2] py-5 text-base font-bold bg-red-500 hover:bg-red-600 text-white shadow-lg"
            >
              {deleting ? <Loader2 size={18} className="animate-spin mr-2" /> : <Trash2 size={18} className="mr-2" />}
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="QR Code" maxWidth="max-w-sm">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="p-4 bg-white rounded-2xl">
            <QrCanvas value={student?.qrToken || ''} size={192} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-white">{student?.fullName}</p>
            <p className="text-[10px] text-white/30 mt-1 font-mono">{student?.qrToken}</p>
          </div>
          <p className="text-[11px] text-white/30 text-center">
            Students can scan this QR code at the kiosk to check in without an RFID card.
          </p>
        </div>
      </Modal>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #D1D5DB; }
      `}</style>
    </div>
  )
}

function InfoRow({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-white/3 p-3 rounded-xl border border-white/8">
      <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white/30 shrink-0 border border-white/8 shadow-sm">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-bold truncate mt-0.5 ${accent ? 'text-[#F5C518] text-lg' : 'text-white'}`}>{value}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white/3 rounded-xl p-4 text-center border border-white/8 shadow-sm">
      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-[#F5C518] mt-2 mb-1">{value}</p>
      {sub && <p className="text-[10px] font-medium text-white/30">{sub}</p>}
    </div>
  )
}

