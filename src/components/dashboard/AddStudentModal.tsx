'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CreditCard, Loader2, User, Phone, BookOpen, Scan, CheckCircle2, ExternalLink, Wallet } from 'lucide-react'
import { useHiveStore } from '@/lib/store'
import { RenewModal } from '@/components/directory/RenewModal'
import { ReceiptModal, type ReceiptData } from '@/components/dashboard/ReceiptModal'

interface AddStudentModalProps {
  onCreated?: () => void
}

type Step = 'form' | 'success'

interface CreatedStudent {
  id: number
  fullName: string
  phone: string
}

export function AddStudentModal({ onCreated }: AddStudentModalProps) {
  const { addStudentOpen, setAddStudentOpen } = useHiveStore()
  const router = useRouter()

  const [step, setStep] = useState<Step>('form')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [major, setMajor] = useState('')
  const [rfidUuid, setRfidUuid] = useState('')
  const [listeningRfid, setListeningRfid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null)
  const [showRenew, setShowRenew] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  const rfidBuffer = useRef('')
  const rfidLastKey = useRef(0)

  useEffect(() => {
    if (!listeningRfid) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const buf = rfidBuffer.current
        rfidBuffer.current = ''
        if (buf.length >= 4) { setRfidUuid(buf); setListeningRfid(false) }
        return
      }
      const now = Date.now()
      if (now - rfidLastKey.current > 100) rfidBuffer.current = ''
      rfidLastKey.current = now
      if (e.key.length === 1) rfidBuffer.current += e.key
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [listeningRfid])

  const reset = () => {
    setFullName(''); setPhone(''); setMajor(''); setRfidUuid('')
    setListeningRfid(false); setError(''); setStep('form')
    setCreatedStudent(null); setShowRenew(false); setReceiptData(null)
  }

  const handleClose = () => { reset(); setAddStudentOpen(false) }

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim()) { setError('Name and phone are required.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, major: major || null, rfidUuid: rfidUuid || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create student.')
        return
      }
      onCreated?.()
      setCreatedStudent({ id: data.id, fullName: data.fullName, phone: data.phone })
      setStep('success')
    } finally {
      setSaving(false)
    }
  }

  const handleViewProfile = () => {
    handleClose()
    router.push('/directory')
  }

  const handleStartSubscription = () => {
    setShowRenew(true)
  }

  if (showRenew && createdStudent) {
    return (
      <>
        <RenewModal
          open={true}
          onClose={() => { setShowRenew(false) }}
          studentId={createdStudent.id}
          studentName={createdStudent.fullName}
          onRenewed={(data) => {
            setShowRenew(false)
            if (data) setReceiptData(data)
            onCreated?.()
          }}
        />
        <ReceiptModal
          open={!!receiptData}
          onClose={() => { setReceiptData(null); handleClose() }}
          data={receiptData}
        />
      </>
    )
  }

  if (receiptData) {
    return (
      <ReceiptModal
        open={true}
        onClose={() => { setReceiptData(null); handleClose() }}
        data={receiptData}
      />
    )
  }

  return (
    <Modal open={addStudentOpen} onClose={handleClose} title={step === 'form' ? 'Add New Student (F2)' : 'Student Created!'} maxWidth="max-w-md">

      {/* ===== FORM STEP ===== */}
      {step === 'form' && (
        <div className="space-y-5">
          <Field label="Full Name *" icon={<User size={16} />}>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ahmed Al-Rashid"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone *" icon={<Phone size={16} />}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 07XXXXXXXX"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" type="tel" />
            </Field>
            <Field label="Major" icon={<BookOpen size={16} />}>
              <input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. CS"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" />
            </Field>
          </div>

          <Field label="RFID Card" icon={<Scan size={16} />}>
            <div className="flex flex-col gap-2">
              <div className={`flex gap-2 p-1.5 rounded-xl border-2 transition-all duration-300 ${listeningRfid ? 'border-[#F5C518] shadow-[0_0_20px_rgba(245,197,24,0.1)]' : 'border-white/10'}`}
                style={{ background: listeningRfid ? 'rgba(245, 197, 24, 0.05)' : 'rgba(255,255,255,0.04)' }}
              >
                <input value={rfidUuid} onChange={(e) => setRfidUuid(e.target.value)} placeholder="Scan card or type UUID"
                  className="flex-1 bg-transparent border-none outline-none text-white px-3 font-mono text-sm placeholder-white/20" readOnly={listeningRfid} />
                <Button
                  variant={listeningRfid ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setListeningRfid((v) => !v)}
                  className={listeningRfid ? 'bg-[#F5C518] text-black hover:bg-[#D4A017] font-bold' : 'bg-white/10 text-white/50 hover:text-white hover:bg-white/15'}
                >
                  {listeningRfid ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <CreditCard size={16} className="mr-1.5" />}
                  {listeningRfid ? 'Waiting...' : 'Scan'}
                </Button>
              </div>
              {listeningRfid && (
                <p className="text-xs font-bold tracking-widest uppercase text-[#F5C518] text-center animate-pulse mt-1">
                  Swipe the RFID card now...
                </p>
              )}
            </div>
          </Field>

          {error && <p className="text-sm font-medium text-red-400 p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</p>}

          <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Button variant="secondary" onClick={handleClose} className="flex-1 py-5 bg-white/5 border-white/10 text-white hover:bg-white/10">Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="flex-[2] py-5 text-base font-bold shadow-lg bg-[#F5C518] hover:bg-[#D4A017] text-black">
              {saving && <Loader2 size={18} className="animate-spin mr-2" />}
              {saving ? 'Saving...' : 'Add Student'}
            </Button>
          </div>
        </div>
      )}

      {/* ===== SUCCESS STEP ===== */}
      {step === 'success' && createdStudent && (
        <div className="flex flex-col items-center text-center py-4" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(34, 197, 94, 0.1)', border: '2px solid rgba(34, 197, 94, 0.3)' }}
          >
            <CheckCircle2 size={40} className="text-green-400" />
          </div>

          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#F5C518] to-[#D4A516] flex items-center justify-center mb-3">
            <span className="text-black font-bold text-lg">
              {createdStudent.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">{createdStudent.fullName}</h3>
          <p className="text-sm text-white/40 mb-6">{createdStudent.phone}</p>

          <p className="text-sm text-white/25 mb-5">What would you like to do next?</p>

          <div className="w-full space-y-3">
            <button
              onClick={handleStartSubscription}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <Wallet size={18} />
              Start Subscription
            </button>

            <button
              onClick={handleViewProfile}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white font-semibold text-sm transition-all duration-200 hover:bg-white/8 active:scale-[0.98]"
            >
              <ExternalLink size={16} />
              View Profile in Directory
            </button>

            <button
              onClick={handleClose}
              className="w-full py-3 text-sm text-white/25 hover:text-white/40 font-medium transition-colors"
            >
              Done — Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1.5">
        <span className="text-white/25">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}
