'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface AuthUser {
  id: number
  email: string
  role: string
  permissions?: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let retries = 0
    const maxRetries = 2

    const fetchUser = () => {
      fetch('/api/auth/me?type=staff')
        .then(res => {
          // 503 = transient DB error — retry, do NOT treat as logged out
          if (res.status === 503 && retries < maxRetries) {
            retries++
            setTimeout(fetchUser, 2000)
            return null
          }
          // 401 = truly not authenticated — user stays null (correct)
          // Any other error — don't retry, just leave user null
          return res.ok ? res.json() : null
        })
        .then(data => {
          if (!data) return
          if (data.user) {
            setUser(data.user)
            // For MANAGER role, refresh the JWT cookie with latest DB permissions
            // Only once per browser session to avoid excessive API calls
            if (data.user.role === 'MANAGER' && !sessionStorage.getItem('hive:session-refreshed')) {
              fetch('/api/auth/refresh-session', { method: 'POST' })
                .then(() => sessionStorage.setItem('hive:session-refreshed', '1'))
                .catch(() => {})
            }
          }
        })
        .catch(() => {
          // Network error — retry once
          if (retries < maxRetries) {
            retries++
            setTimeout(fetchUser, 2000)
          }
        })
        .finally(() => { if (retries === 0 || retries >= maxRetries) setLoading(false) })
    }

    fetchUser()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
