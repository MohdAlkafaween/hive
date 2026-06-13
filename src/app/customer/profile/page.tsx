'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useCustomer } from '@/lib/customerContext'
import { useI18n } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import { User, Phone, Mail, Shield, GraduationCap, QrCode, Clock, Pencil, Save, X, LogOut, Lock, Loader2, AlertTriangle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

function QrCanvas({ value, size = 200 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!value || !canvasRef.current) return
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size, margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      })
    }).catch(() => {})
  }, [value, size])
  return <canvas ref={canvasRef} />
}

interface ProfileData {
  id: number
  studentNumber: number | null
  fullName: string
  phone: string
  email: string | null
  major: string | null
  university: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  qrToken: string | null
  createdAt: string
  lifetimeCheckIns: number
}

interface LogEntry {
  id: number
  checkInTime: string
  checkOutTime: string | null
}

export default function CustomerProfilePage() {
  const { customer } = useCustomer()
  const { t } = useI18n()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [kioskEnabled, setKioskEnabled] = useState(false)

  useEffect(() => {
    fetch('/api/settings/public')
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, string>) => { if (s.kioskEnabled === 'true') setKioskEnabled(true) })
      .catch(() => {})
  }, [])
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ phone: '', email: '', emergencyContact: '', emergencyPhone: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const fetchProfile = useCallback(() => {
    Promise.all([
      fetch('/api/customer/profile').then(r => r.ok ? r.json() : null),
      fetch('/api/customer/history').then(r => r.ok ? r.json() : null),
    ]).then(([pData, hData]) => {
      if (pData?.student) {
        setProfile(pData.student)
        setEditData({
          phone: pData.student.phone || '',
          email: pData.student.email || '',
          emergencyContact: pData.student.emergencyContact || '',
          emergencyPhone: pData.student.emergencyPhone || '',
        })
      }
      if (hData?.logs) setRecentLogs(hData.logs.slice(0, 5))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error || t('common.failed'))
        return
      }
      setEditing(false)
      fetchProfile()
    } catch {
      setSaveError(t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/customer-login')
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
  if (!profile) return null

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
  const fmtDuration = (inT: string, outT: string | null) => {
    if (!outT) return t('customer.stillInside')
    const m = Math.round((new Date(outT).getTime() - new Date(inT).getTime()) / 60000)
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">{t('customer.myProfile')}</h1>

      {/* Profile Info */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider">{t('customer.personalInfo')}</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="text-[#F5C518] text-xs font-semibold flex items-center gap-1 hover:opacity-80">
              <Pencil size={12} /> {t('common.edit')}
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setSaveError('') }} className="text-white/40 text-xs flex items-center gap-1 hover:text-white/60"><X size={12} /> {t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="text-[#F5C518] text-xs font-semibold flex items-center gap-1 hover:opacity-80 disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {t('common.save')}
              </button>
            </div>
          )}
        </div>

        {saveError && <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg p-2 border border-red-500/20"><AlertTriangle size={14} /> {saveError}</div>}

        <Row icon={User} label={t('customer.name')} value={profile.fullName} />
        {profile.studentNumber && <Row icon={Shield} label={t('customer.studentNumber')} value={`STD-${String(profile.studentNumber).padStart(4, '0')}`} />}

        {editing ? (
          <>
            <EditRow icon={Phone} label={t('customer.phone')} value={editData.phone} onChange={v => setEditData(d => ({ ...d, phone: v }))} />
            <EditRow icon={Mail} label={t('customer.email')} value={editData.email} onChange={v => setEditData(d => ({ ...d, email: v }))} placeholder={t('customer.optional')} />
            <EditRow icon={User} label={t('customer.emergencyContact')} value={editData.emergencyContact} onChange={v => setEditData(d => ({ ...d, emergencyContact: v }))} />
            <EditRow icon={Phone} label={t('customer.emergencyPhone')} value={editData.emergencyPhone} onChange={v => setEditData(d => ({ ...d, emergencyPhone: v }))} />
          </>
        ) : (
          <>
            <Row icon={Phone} label={t('customer.phone')} value={profile.phone} />
            <Row icon={Mail} label={t('customer.email')} value={profile.email || '-'} />
            {profile.university && <Row icon={GraduationCap} label={t('customer.university')} value={profile.university} />}
            {profile.major && <Row icon={GraduationCap} label={t('customer.major')} value={profile.major} />}
            <Row icon={Clock} label={t('customer.memberSince')} value={new Date(profile.createdAt).toLocaleDateString()} />
            <Row icon={Clock} label={t('customer.totalVisits')} value={String(profile.lifetimeCheckIns)} />
          </>
        )}
      </div>

      {/* QR Code — only shown when kiosk mode is enabled */}
      {kioskEnabled && (
        profile.qrToken ? (
          <div className="rounded-2xl p-5 flex flex-col items-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2 text-sm font-bold text-white/50 uppercase tracking-wider"><QrCode size={16} /> {t('customer.qrCode')}</div>
            <div className="bg-white rounded-xl p-3"><QrCanvas value={profile.qrToken} size={200} /></div>
            <p className="text-white/30 text-xs text-center">{t('customer.showQrKiosk')}</p>
          </div>
        ) : (
          <div className="rounded-2xl p-5 flex flex-col items-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <QrCode size={24} className="text-white/20" />
            <p className="text-white/30 text-xs text-center">{t('customer.noQrAvailable')}</p>
          </div>
        )
      )}

      {/* Recent Check-ins */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider">{t('customer.recentCheckIns')}</h2>
          <a href="/customer/history" className="text-[#F5C518] text-xs font-semibold hover:opacity-80">{t('customer.viewAll')}</a>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-3">{t('customer.noCheckIns')}</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">{fmtDate(log.checkInTime)}</p>
                  <p className="text-white/40 text-xs">{fmtTime(log.checkInTime)} - {log.checkOutTime ? fmtTime(log.checkOutTime) : t('customer.stillInside')}</p>
                </div>
                <span className="text-white/30 text-xs">{fmtDuration(log.checkInTime, log.checkOutTime)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3 pb-4">
        <button onClick={() => setShowPasswordForm(!showPasswordForm)}
          className="w-full flex items-center gap-3 rounded-xl p-4 text-left transition-all hover:bg-white/5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Lock className="text-white/40" size={18} />
          <span className="text-white/70 text-sm font-medium">{t('customer.changePassword')}</span>
        </button>
        {showPasswordForm && <ChangePasswordForm t={t} onClose={() => setShowPasswordForm(false)} />}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-xl p-4 text-left transition-all hover:bg-red-500/10"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <LogOut className="text-red-400" size={18} />
          <span className="text-red-400 text-sm font-medium">{t('customer.logout')}</span>
        </button>
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-white/40 text-sm flex items-center gap-2"><Icon size={14} className="shrink-0" /> {label}</span>
      <span className="text-white text-sm font-medium text-right max-w-[55%] truncate">{value}</span>
    </div>
  )
}

function ChangePasswordForm({ t, onClose }: { t: (k: string) => string; onClose: () => void }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!currentPw) { setError(t('customer.currentPassword') + ' required'); return }
    if (newPw.length < 6) { setError(t('customer.passwordTooShort')); return }
    if (newPw !== confirmPw) { setError(t('customer.passwordsMismatch')); return }

    setLoading(true)
    try {
      const res = await fetch('/api/customer/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
      } else {
        setError(data.error || 'Failed')
      }
    } catch { setError('Failed') } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle2 size={18} />
          <span className="text-sm font-bold">{t('customer.passwordChanged')}</span>
        </div>
        <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-white/5 text-white/50 text-sm font-medium hover:bg-white/10 transition-all">
          {t('common.close') || 'Close'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div>
        <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('customer.currentPassword')}</label>
        <div className="relative mt-1">
          <input
            type={showPw ? 'text' : 'password'}
            value={currentPw}
            onChange={e => setCurrentPw(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] outline-none placeholder:text-white/20 pr-10"
          />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5 text-white/30 hover:text-white/50">
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('customer.newPassword')}</label>
        <input
          type={showPw ? 'text' : 'password'}
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
          placeholder="Min 6 characters"
          className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] outline-none placeholder:text-white/20"
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">{t('customer.confirmNewPassword')}</label>
        <input
          type={showPw ? 'text' : 'password'}
          value={confirmPw}
          onChange={e => setConfirmPw(e.target.value)}
          className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#F5C518] outline-none placeholder:text-white/20"
        />
      </div>
      {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 border border-red-500/20">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-sm font-medium hover:bg-white/10 transition-all">{t('common.cancel')}</button>
        <button onClick={handleSubmit} disabled={loading}
          className="flex-1 py-2.5 rounded-lg bg-[#F5C518] hover:bg-[#D5A711] text-black text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}

function EditRow({ icon: Icon, label, value, onChange, placeholder }: { icon: React.ElementType; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-white/40 text-sm flex items-center gap-2 min-w-[100px] shrink-0"><Icon size={14} /> {label}</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F5C518] placeholder-white/20" />
    </div>
  )
}
