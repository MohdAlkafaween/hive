'use client'
import { useCallback } from 'react'
import { useRFIDScanner } from '@/hooks/useRFIDScanner'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useHiveStore } from '@/lib/store'
import { CheckInOverlay } from '@/components/CheckInOverlay'

export function GlobalProviders({ children }: { children: React.ReactNode }) {
  const { setOverlay } = useHiveStore()
  useKeyboardShortcuts()

  const handleScan = useCallback(async (uuid: string) => {
    try {
      const res = await fetch(`/api/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfidUuid: uuid }),
      })
      const data = await res.json()
      setOverlay(data)
    } catch {
      setOverlay({ status: 'NOT_FOUND', reason: 'Connection error.' })
    }
  }, [setOverlay])

  useRFIDScanner({ onScan: handleScan })

  return (
    <>
      {children}
      <CheckInOverlay />
    </>
  )
}
