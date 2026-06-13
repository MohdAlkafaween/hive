'use client'
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface CustomerData {
  id: number
  fullName: string
  phone: string
  email: string | null
  status: string
  qrToken: string | null
  photoUrl: string | null
  studentNumber: number | null
}

interface CustomerContextValue {
  customer: CustomerData | null
  loading: boolean
  refresh: () => void
}

const CustomerCtx = createContext<CustomerContextValue>({
  customer: null,
  loading: true,
  refresh: () => {},
})

export function useCustomer() {
  return useContext(CustomerCtx)
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchCustomer = useCallback(() => {
    let retries = 0
    const maxRetries = 2

    const doFetch = () => {
      fetch('/api/auth/me?type=customer')
        .then(res => {
          if (res.status === 503 && retries < maxRetries) {
            retries++
            setTimeout(doFetch, 2000)
            return null
          }
          return res.ok ? res.json() : null
        })
        .then(data => {
          if (!data) {
            // retries === 0: API returned 401 (no retry scheduled) → redirect immediately
            // retries >= maxRetries: all 503 retries exhausted → redirect
            // retries in (0, maxRetries): a 503 retry is pending → wait
            if (retries === 0 || retries >= maxRetries) {
              setLoading(false)
              router.push('/customer-login')
            }
            return
          }
          if (data.type === 'customer' && data.student) {
            setCustomer(data.student)
          } else {
            // Not a customer token — redirect
            router.push('/customer-login')
          }
          setLoading(false)
        })
        .catch(() => {
          if (retries < maxRetries) {
            retries++
            setTimeout(doFetch, 2000)
          } else {
            setLoading(false)
            router.push('/customer-login')
          }
        })
    }
    doFetch()
  }, [router])

  useEffect(() => {
    fetchCustomer()
  }, [fetchCustomer])

  return (
    <CustomerCtx.Provider value={{ customer, loading, refresh: fetchCustomer }}>
      {children}
    </CustomerCtx.Provider>
  )
}
