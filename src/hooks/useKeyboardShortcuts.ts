'use client'
import { useEffect } from 'react'
import { useHiveStore } from '@/lib/store'

export function useKeyboardShortcuts() {
  const { setAddStudentOpen, setOverlay, searchRef, overlay } = useHiveStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (overlay) { setOverlay(null); return }
        setAddStudentOpen(false)
        return
      }

      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return

      if (e.key === 'F1') {
        e.preventDefault()
        searchRef?.current?.focus()
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        setAddStudentOpen(true)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [overlay, searchRef, setAddStudentOpen, setOverlay])
}
