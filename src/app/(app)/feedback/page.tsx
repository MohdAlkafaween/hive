'use client'
import { useState, useEffect } from 'react'
import { Star, MessageSquare, Loader2, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { PageTransition } from '@/components/animations/PageTransition'

interface FeedbackItem {
  menuItemId: number
  name: string
  nameAr: string | null
  imageUrl: string | null
  category: string | null
  categoryAr: string | null
  avgRating: number
  totalReviews: number
}

interface Review {
  id: number
  rating: number
  comment: string | null
  customerName: string
  customerPhoto: string | null
  createdAt: string
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? 'text-[#F5C518] fill-[#F5C518]' : 'text-white/10'}
        />
      ))}
    </div>
  )
}

export default function FeedbackPage() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch('/api/feedback')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setItems(data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleReviews = async (menuItemId: number) => {
    if (expandedItem === menuItemId) {
      setExpandedItem(null)
      return
    }
    setExpandedItem(menuItemId)
    setLoadingReviews(true)
    try {
      const res = await fetch(`/api/feedback/${menuItemId}`)
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews ?? [])
      }
    } catch {}
    setLoadingReviews(false)
  }

  const handleExport = async () => {
    if (items.length === 0) return
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Sheet 1: Item Summary
      const summaryRows = items.map(item => ({
        'Item Name': item.name,
        'Category': item.category || '-',
        'Average Rating': item.avgRating,
        'Total Reviews': item.totalReviews,
      }))
      const ws1 = XLSX.utils.json_to_sheet(summaryRows)
      ws1['!cols'] = [{ wch: 25 }, { wch: 16 }, { wch: 14 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws1, 'Item Summary')

      // Sheet 2: All Reviews — fetch all reviews for all items
      const allReviews: Record<string, unknown>[] = []
      for (const item of items) {
        try {
          const res = await fetch(`/api/feedback/${item.menuItemId}`)
          if (res.ok) {
            const data = await res.json()
            for (const r of (data.reviews ?? [])) {
              allReviews.push({
                'Item Name': item.name,
                'Rating': r.rating,
                'Comment': r.comment || '-',
                'Customer': r.customerName || 'Anonymous',
                'Date': new Date(r.createdAt).toLocaleDateString('en-JO'),
                'Time': new Date(r.createdAt).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit', hour12: false }),
              })
            }
          }
        } catch {}
      }

      if (allReviews.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(allReviews)
        ws2['!cols'] = [{ wch: 25 }, { wch: 8 }, { wch: 35 }, { wch: 20 }, { wch: 12 }, { wch: 8 }]
        XLSX.utils.book_append_sheet(wb, ws2, 'All Reviews')
      }

      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      XLSX.writeFile(wb, `HIVE-Feedback-${today}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <MessageSquare size={20} className="text-[#F5C518]" />
              {t('feedback.title')}
            </h1>
            <p className="text-xs text-white/30 mt-1">{t('feedback.subtitle')}</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 hover:border-green-500/30 text-xs font-bold transition-all disabled:opacity-40"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? t('export.generating') : t('export.feedback')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-white/25" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare size={40} className="mx-auto text-white/10 mb-3" />
            <p className="text-sm text-white/30">{t('feedback.noFeedback')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.menuItemId} className="hive-card !rounded-2xl">
                <button
                  onClick={() => toggleReviews(item.menuItemId)}
                  className="w-full flex items-center gap-4 text-left"
                >
                  {/* Item image */}
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Star size={18} className="text-white/10" />
                    </div>
                  )}

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {lang === 'ar' && item.nameAr ? item.nameAr : item.name}
                    </h3>
                    <p className="text-[10px] text-white/25">
                      {lang === 'ar' && item.categoryAr ? item.categoryAr : item.category ?? t('feedback.uncategorized')}
                    </p>
                  </div>

                  {/* Rating */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-black text-[#F5C518]">{item.avgRating}</span>
                      <Stars rating={item.avgRating} />
                    </div>
                    <span className="text-[10px] text-white/25">
                      {item.totalReviews} {t('feedback.reviews')}
                    </span>
                  </div>

                  {/* Expand icon */}
                  <div className="flex-shrink-0 text-white/20">
                    {expandedItem === item.menuItemId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Expanded reviews */}
                {expandedItem === item.menuItemId && (
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                    {loadingReviews ? (
                      <div className="flex justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-white/25" />
                      </div>
                    ) : reviews.length === 0 ? (
                      <p className="text-xs text-white/25 text-center py-4">
                        {t('feedback.noReviews')}
                      </p>
                    ) : (
                      reviews.map(review => (
                        <div key={review.id} className="flex gap-3 p-3 rounded-xl bg-white/[0.02]">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-white/70">{review.customerName}</span>
                              <Stars rating={review.rating} size={10} />
                            </div>
                            {review.comment && (
                              <p className="text-xs text-white/40 leading-relaxed">{review.comment}</p>
                            )}
                            <span className="text-[9px] text-white/15 mt-1 block">
                              {new Date(review.createdAt).toLocaleDateString(lang === 'ar' ? 'ar' : 'en', {
                                year: 'numeric', month: 'short', day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  )
}
