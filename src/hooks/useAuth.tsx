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
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
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
      .catch(() => {})
      .finally(() => setLoading(false))
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
