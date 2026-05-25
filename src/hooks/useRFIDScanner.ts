'use client'
import { useEffect, useRef } from 'react'

interface UseRFIDScannerOptions {
  onScan: (uuid: string) => void
  minLength?: number
  maxGapMs?: number
}

export function useRFIDScanner({ onScan, minLength = 4, maxGapMs = 80 }: UseRFIDScannerOptions) {
  const bufferRef   = useRef('')
  const lastKeyRef  = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable

      if (e.key === 'Enter') {
        const buf = bufferRef.current
        bufferRef.current = ''
        if (buf.length >= minLength && !isEditable) {
          onScan(buf)
        }
        return
      }

      const now = Date.now()
      if (now - lastKeyRef.current > maxGapMs) {
        bufferRef.current = ''
      }
      lastKeyRef.current = now

      if (e.key?.length === 1 && !isEditable) {
        bufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onScan, minLength, maxGapMs])
}
