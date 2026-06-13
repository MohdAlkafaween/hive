'use client'
import { useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { bootstrapAudio, playOrderReadyChime } from '@/lib/sounds'

interface MinimalOrder {
  orderGroupId: string
  status: string
}

export function OrderNotificationProvider() {
  const { t } = useI18n()
  const [showBanner, setShowBanner] = useState(false)
  const prevStatusMapRef = useRef<Map<string, string>>(new Map())
  const isFirstLoad = useRef(true)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Bootstrap audio on mount
  useEffect(() => { bootstrapAudio() }, [])

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const poll = () => {
      fetch('/api/customer/orders')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.orders) return
          const orders: MinimalOrder[] = data.orders

          if (!isFirstLoad.current) {
            let hasNewReady = false
            for (const order of orders) {
              const prev = prevStatusMapRef.current.get(order.orderGroupId)
              if (prev && prev !== 'READY' && order.status === 'READY') {
                hasNewReady = true
              }
            }
            if (hasNewReady) {
              playOrderReadyChime()
              setShowBanner(true)
              if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
              bannerTimerRef.current = setTimeout(() => setShowBanner(false), 10000)
              // Browser notification when page not focused
              if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(t('customer.orderReadyTitle'), {
                    body: t('customer.orderReadyBanner'),
                    icon: '/logo.png',
                  })
                } catch {}
              }
            }
          }

          // Update status map
          const newMap = new Map<string, string>()
          for (const order of orders) newMap.set(order.orderGroupId, order.status)
          prevStatusMapRef.current = newMap
          isFirstLoad.current = false
        })
        .catch(() => {})
    }

    poll()
    intervalRef.current = setInterval(poll, 15000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!showBanner) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-auto max-w-md animate-bounce-in">
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-green-500/30 backdrop-blur-md shadow-[0_4px_24px_rgba(34,197,94,0.25)] animate-pulse cursor-pointer"
        style={{ background: 'rgba(34,197,94,0.12)' }}
        onClick={() => setShowBanner(false)}
      >
        <Bell className="text-green-400 shrink-0" size={20} />
        <div>
          <span className="text-green-400 text-sm font-black block">{t('customer.orderReadyBanner')}</span>
          <span className="text-green-400/50 text-xs font-semibold">{t('customer.dismiss')}</span>
        </div>
        <X className="text-green-400/40 hover:text-green-400 shrink-0 ms-2" size={16} />
      </div>
    </div>
  )
}
