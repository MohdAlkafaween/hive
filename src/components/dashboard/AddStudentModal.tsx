'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CreditCard, Loader2, User, Phone, BookOpen, Scan, CheckCircle2, ExternalLink, Wallet, ChevronDown, Mail, GraduationCap, Heart, UserCircle, KeyRound, Eye, EyeOff } from 'lucide-react'
import { useHiveStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
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
  const { t } = useI18n()

  const [step, setStep] = useState<Step>('form')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [major, setMajor] = useState('')
  const [rfidUuid, setRfidUuid] = useState('')
  const [email, setEmail] = useState('')
  const [university, setUniversity] = useState('')
  const [gender, setGender] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [listeningRfid, setListeningRfid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Customer login password (optional)
  const [enableLogin, setEnableLogin] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
    setEmail(''); setUniversity(''); setGender(''); setEmergencyContact('')
    setEmergencyPhone(''); setReferralSource(''); setDateOfBirth(''); setShowMore(false)
    setListeningRfid(false); setError(''); setStep('form')
    setCreatedStudent(null); setShowRenew(false); setReceiptData(null)
    setEnableLogin(false); setLoginPassword(''); setConfirmPassword(''); setShowPassword(false)
  }

  const handleClose = () => { reset(); setAddStudentOpen(false) }

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim()) { setError(t('addStudent.namePhoneRequired')); return }
    if (enableLogin) {
      if (!loginPassword || loginPassword.length < 6) { setError(t('addStudent.passwordMinChars')); return }
      if (loginPassword !== confirmPassword) { setError(t('customerAuth.passwordsMismatch')); return }
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, phone, major: major || null, rfidUuid: rfidUuid || null,
          email: email || null, university: university || null, gender: gender || null,
          emergencyContact: emergencyContact || null, emergencyPhone: emergencyPhone || null,
          referralSource: referralSource || null, dateOfBirth: dateOfBirth || null,
          ...(enableLogin && loginPassword ? { password: loginPassword } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('addStudent.createFailed'))
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
    <Modal open={addStudentOpen} onClose={handleClose} title={step === 'form' ? t('addStudent.title') : t('addStudent.created')} maxWidth="max-w-md">

      {/* ===== FORM STEP ===== */}
      {step === 'form' && (
        <div className="space-y-5">
          <Field label={`${t('addStudent.fullName')} *`} icon={<User size={16} />}>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('addStudent.fullNamePlaceholder')}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" autoFocus />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={`${t('addStudent.phone')} *`} icon={<Phone size={16} />}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('addStudent.phonePlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" type="tel" />
            </Field>
            <Field label={t('addStudent.major')} icon={<BookOpen size={16} />}>
              <input value={major} onChange={(e) => setMajor(e.target.value)} placeholder={t('addStudent.majorPlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" />
            </Field>
          </div>

          <Field label={t('addStudent.rfidCard')} icon={<Scan size={16} />}>
            <div className="flex flex-col gap-2">
              <div className={`flex gap-2 p-1.5 rounded-xl border-2 transition-all duration-300 ${listeningRfid ? 'border-[#F5C518] shadow-[0_0_20px_rgba(245,197,24,0.1)]' : 'border-white/10'}`}
                style={{ background: listeningRfid ? 'rgba(245, 197, 24, 0.05)' : 'rgba(255,255,255,0.04)' }}
              >
                <input value={rfidUuid} onChange={(e) => setRfidUuid(e.target.value)} placeholder={t('addStudent.rfidPlaceholder')}
                  className="flex-1 bg-transparent border-none outline-none text-white px-3 font-mono text-sm placeholder-white/20" readOnly={listeningRfid} />
                <Button
                  variant={listeningRfid ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setListeningRfid((v) => !v)}
                  className={listeningRfid ? 'bg-[#F5C518] text-black hover:bg-[#D4A017] font-bold' : 'bg-white/10 text-white/50 hover:text-white hover:bg-white/15'}
                >
                  {listeningRfid ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <CreditCard size={16} className="mr-1.5" />}
                  {listeningRfid ? t('addStudent.waiting') : t('addStudent.scan')}
                </Button>
              </div>
              {listeningRfid && (
                <p className="text-xs font-bold tracking-widest uppercase text-[#F5C518] text-center animate-pulse mt-1">
                  {t('addStudent.swipeNow')}
                </p>
              )}
            </div>
          </Field>

          {/* Customer Login (optional) */}
          <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-10 h-5 rounded-full transition-all ${enableLogin ? 'bg-[#F5C518]' : 'bg-white/10'}`}
                onClick={() => setEnableLogin(!enableLogin)}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enableLogin ? 'left-5' : 'left-0.5'}`} />
              </div>
              <div className="flex items-center gap-1.5">
                <KeyRound size={14} className={enableLogin ? 'text-[#F5C518]' : 'text-white/25'} />
                <span className={`text-xs font-bold ${enableLogin ? 'text-[#F5C518]' : 'text-white/40'}`}>
                  {t('addStudent.enableCustomerLogin')}
                </span>
              </div>
            </label>
            {enableLogin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Field label={`${t('addStudent.setLoginPassword')} *`} icon={<KeyRound size={16} />}>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder={t('profile.minChars')}
                      minLength={6}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-10 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-white/30 hover:text-white/50">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>
                <Field label={`${t('customerAuth.confirmPassword')} *`} icon={<KeyRound size={16} />}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('profile.reenterPassword')}
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all"
                  />
                </Field>
              </div>
            )}
          </div>

          {/* More Details (collapsible) */}
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="w-full flex items-center justify-between text-xs font-bold text-white/30 uppercase tracking-wider py-2 hover:text-white/50 transition-colors"
          >
            <span>{t('addStudent.moreDetails')}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`} />
          </button>

          {showMore && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('addStudent.email')} icon={<Mail size={16} />}>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" />
                </Field>
                <Field label={t('addStudent.university')} icon={<GraduationCap size={16} />}>
                  <input value={university} onChange={(e) => setUniversity(e.target.value)} placeholder={t('addStudent.universityPlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('addStudent.gender')} icon={<UserCircle size={16} />}>
                  <select value={gender} onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] transition-all">
                    <option value="">{t('addStudent.selectGender')}</option>
                    <option value="male">{t('addStudent.male')}</option>
                    <option value="female">{t('addStudent.female')}</option>
                  </select>
                </Field>
                <Field label={t('addStudent.dateOfBirth')} icon={<BookOpen size={16} />}>
                  <input value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] transition-all" />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('addStudent.emergencyContact')} icon={<Heart size={16} />}>
                  <input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder={t('addStudent.emergencyContactPlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" />
                </Field>
                <Field label={t('addStudent.emergencyPhone')} icon={<Phone size={16} />}>
                  <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder={t('addStudent.emergencyPhonePlaceholder')} type="tel"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] focus:shadow-[0_0_0_1px_#F5C518] placeholder:text-white/20 transition-all" />
                </Field>
              </div>

              <Field label={t('addStudent.referralSource')} icon={<User size={16} />}>
                <select value={referralSource} onChange={(e) => setReferralSource(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F5C518] transition-all">
                  <option value="">{t('addStudent.selectReferral')}</option>
                  <option value="friend">{t('addStudent.referralFriend')}</option>
                  <option value="social_media">{t('addStudent.referralSocial')}</option>
                  <option value="university">{t('addStudent.referralUniversity')}</option>
                  <option value="walk_in">{t('addStudent.referralWalkIn')}</option>
                  <option value="other">{t('addStudent.referralOther')}</option>
                </select>
              </Field>
            </div>
          )}

          {error && <p className="text-sm font-medium text-red-400 p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</p>}

          <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Button variant="secondary" onClick={handleClose} className="flex-1 py-5 bg-white/5 border-white/10 text-white hover:bg-white/10">{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={saving} className="flex-[2] py-5 text-base font-bold shadow-lg bg-[#F5C518] hover:bg-[#D4A017] text-black">
              {saving && <Loader2 size={18} className="animate-spin mr-2" />}
              {saving ? t('addStudent.saving') : t('addStudent.addStudent')}
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

          <p className="text-sm text-white/25 mb-5">{t('addStudent.whatNext')}</p>

          <div className="w-full space-y-3">
            <button
              onClick={handleStartSubscription}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl bg-[#F5C518] hover:bg-[#D5A711] text-black font-bold text-sm transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <Wallet size={18} />
              {t('addStudent.startSubscription')}
            </button>

            <button
              onClick={handleViewProfile}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-white font-semibold text-sm transition-all duration-200 hover:bg-white/8 active:scale-[0.98]"
            >
              <ExternalLink size={16} />
              {t('addStudent.viewProfile')}
            </button>

            <button
              onClick={handleClose}
              className="w-full py-3 text-sm text-white/25 hover:text-white/40 font-medium transition-colors"
            >
              {t('addStudent.doneClose')}
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
