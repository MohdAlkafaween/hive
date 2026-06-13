'use client'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div
            className="flex min-h-full items-center justify-center p-0 md:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          >
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              className={`relative z-10 w-full ${maxWidth} bg-[#18181B] border border-[#27272A] rounded-none md:rounded-2xl shadow-2xl max-md:min-h-screen max-md:max-w-full max-md:m-0`}
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 20 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
            {title && (
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#27272A]">
                <h2 className="text-base font-semibold text-[#F4F4F5] pr-4">{title}</h2>
                <motion.button
                  onClick={onClose}
                  className="text-[#71717A] hover:text-[#F4F4F5] transition-colors cursor-pointer flex-shrink-0"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={18} />
                </motion.button>
              </div>
            )}
            <div className="p-5">{children}</div>
          </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
