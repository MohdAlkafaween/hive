'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Loader2, Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Authentication failed')
        return
      }

      router.push('/')
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white font-sans relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 40%, #1E1708 100%)' }}>
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F5C518]/10 rounded-full blur-[120px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-[#F5C518]/5 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" style={{ animationDelay: '1.5s' }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-2xl p-8 z-10"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(245, 197, 24, 0.15)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 60px rgba(245, 197, 24, 0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <div className="flex items-center justify-center gap-3 mb-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.1 }}
            >
              <img src="/logo.png" alt="HIVE" width={80} height={80} className="w-20 h-20 object-contain drop-shadow-[0_0_16px_rgba(245,197,24,0.3)]" />
            </motion.div>
            <span className="text-3xl font-black tracking-tight text-white">HIVE<span className="hive-gradient-text">.</span></span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-white/40 text-sm mt-2">Enter your credentials to access the workspace</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.35 }}
          >
            <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Email</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-white/30 group-focus-within:text-[#F5C518] transition-colors" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none placeholder-white/20 transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(245,197,24,0.15),0_0_20px_rgba(245,197,24,0.08)] focus:bg-white/8"
                placeholder="admin@hive.study"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.35 }}
          >
            <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3.5 w-5 h-5 text-white/30 group-focus-within:text-[#F5C518] transition-colors" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-[#F5C518] text-white rounded-xl pl-10 pr-4 py-3.5 text-sm focus:outline-none placeholder-white/20 transition-all duration-300 focus:shadow-[0_0_0_3px_rgba(245,197,24,0.15),0_0_20px_rgba(245,197,24,0.08)] focus:bg-white/8"
                placeholder="••••••••"
              />
            </div>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="text-sm p-3 rounded-lg border bg-red-500/10 text-red-400 border-red-500/20"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.35 }}
          >
            <button type="submit" disabled={loading}
              className="w-full py-4 text-base font-black rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #F5C518 0%, #EAB308 100%)',
                boxShadow: '0 8px 32px rgba(245, 197, 24, 0.3), 0 0 60px rgba(245, 197, 24, 0.1)',
                color: '#0A0A0A',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(245, 197, 24, 0.4), 0 0 80px rgba(245, 197, 24, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(245, 197, 24, 0.3), 0 0 60px rgba(245, 197, 24, 0.1)'; }}
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Sign In'}
            </button>
          </motion.div>
        </form>

        <motion.p
          className="mt-6 text-center text-xs text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Contact your administrator to create an account
        </motion.p>
      </motion.div>
    </div>
  )
}
