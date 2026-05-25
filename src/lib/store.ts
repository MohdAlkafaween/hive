'use client'
import { create } from 'zustand'
import { RefObject } from 'react'

export interface CheckInResult {
  status: 'OK' | 'EXPIRED' | 'NOT_FOUND' | 'ALREADY_IN'
  student?: { id: number; fullName: string; phone: string }
  subscription?: {
    planType: string
    expiryDate: string
    visitsUsed: number
    totalVisitsAllowed: number
  }
  remainingVisits?: number | null
  reason?: string
  alreadyCheckedInToday?: boolean
}

interface HiveStore {
  overlay: CheckInResult | null
  setOverlay: (r: CheckInResult | null) => void

  addStudentOpen: boolean
  setAddStudentOpen: (v: boolean) => void

  searchRef: RefObject<HTMLInputElement> | null
  setSearchRef: (r: RefObject<HTMLInputElement>) => void
}

export const useHiveStore = create<HiveStore>((set) => ({
  overlay: null,
  setOverlay: (overlay) => set({ overlay }),

  addStudentOpen: false,
  setAddStudentOpen: (addStudentOpen) => set({ addStudentOpen }),

  searchRef: null,
  setSearchRef: (searchRef) => set({ searchRef }),
}))
