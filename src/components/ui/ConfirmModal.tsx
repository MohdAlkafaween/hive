'use client'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  const accentColor =
    variant === 'danger'
      ? 'rgba(239, 68, 68, 0.8)'
      : variant === 'warning'
      ? 'rgba(245, 197, 24, 0.8)'
      : 'rgba(255, 255, 255, 0.8)'

  const btnClass =
    variant === 'danger'
      ? 'bg-red-500/90 hover:bg-red-500 text-white'
      : variant === 'warning'
      ? 'bg-[#F5C518] hover:bg-[#D4A017] text-black'
      : 'bg-white/20 hover:bg-white/30 text-white'

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 p-2 rounded-lg shrink-0"
            style={{ background: `${accentColor.replace('0.8', '0.1')}`, border: `1px solid ${accentColor.replace('0.8', '0.2')}` }}
          >
            <AlertTriangle size={20} style={{ color: accentColor }} />
          </div>
          <p className="text-sm text-white/70 leading-relaxed pt-1">{message}</p>
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-5 bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 py-5 font-bold ${btnClass}`}
          >
            {loading && <Loader2 size={16} className="animate-spin mr-2" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
