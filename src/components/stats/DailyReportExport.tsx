'use client'
import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface DailyReportExportProps {
  date: string
}

// Row shapes returned by /api/reports/daily
interface ReportTx {
  receiptNumber: string | null
  studentName: string | null
  studentPhone: string | null
  planType: string
  amountPaid: number
  discountAmount: number
  netAmount: number
  gateway: string
  type: string
  time: string
  startDate?: string | null
  expiryDate?: string | null
  visitsUsed: number | null
  totalVisitsAllowed: number | null
  subStatus?: string | null
  createdBy?: string | null
}

interface ReportLog {
  studentName: string | null
  studentPhone: string | null
  subscriptionType: string | null
  checkInTime: string
  checkOutTime: string | null
  method: string | null
  processedBy?: string | null
}

interface ReportOrder {
  receiptNumber: string | null
  itemName: string
  quantity: number
  unitPrice: number
  selectedOptions: string
  totalPrice: number
  paymentMethod: string | null
  studentName?: string | null
  time: string
}

interface ReportExpense {
  description: string
  category: string | null
  amount: number
  addedBy: string | null
  time: string
}

export function DailyReportExport({ date }: DailyReportExportProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fmtVisits = (used: number | null, allowed: number | null) => {
    if (used === null || allowed === null) return '-'
    return allowed === -1 ? `${used} / Unlimited` : `${used} / ${allowed}`
  }

  const handleExport = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/daily?date=${date}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('report.exportFailed'))
        return
      }
      const report = await res.json()
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // ── Sheet 1: Summary ──
      const summaryData = [
        [t('report.dailyReport')],
        [t('report.date'), report.date],
        [''],
        [t('report.subscriptionRevenue'), `${report.summary.subscriptionRevenue.toFixed(2)} JD`],
        [t('report.cafeRevenue'), `${report.summary.cafeRevenue.toFixed(2)} JD`],
        [t('report.totalExpenses'), `${report.summary.totalExpenses.toFixed(2)} JD`],
        [t('report.netRevenue'), `${report.summary.netRevenue.toFixed(2)} JD`],
        [t('report.totalDiscounts'), `${report.summary.totalDiscounts.toFixed(2)} JD`],
        [''],
        [t('report.totalCheckIns'), report.summary.totalCheckIns],
        [t('report.uniqueStudents'), report.summary.uniqueStudents],
        [t('report.newSubscriptions'), report.summary.newSubscriptions],
        [t('report.cafeProfit'), `${report.summary.cafeProfit.toFixed(2)} JD`],
      ]
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
      wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, t('report.summary'))

      // ── Sheet 2: Subscriptions ──
      const txHeaders = [
        t('report.receipt'), t('report.studentName'), t('report.phone'),
        t('report.plan'), t('report.amountPaid'), t('report.discount'),
        t('report.netAmount'), t('report.paymentMethod'), t('report.type'), t('report.time'),
        'Start Date', 'Expiry Date', 'Visits', 'Status', 'Created By',
      ]
      const txRows = report.transactions.map((tx: ReportTx) => [
        tx.receiptNumber,
        tx.studentName,
        tx.studentPhone,
        tx.planType,
        tx.amountPaid,
        tx.discountAmount,
        tx.netAmount,
        tx.gateway,
        tx.type,
        new Date(tx.time).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' }),
        tx.startDate ? new Date(tx.startDate).toLocaleDateString('en-JO') : '-',
        tx.expiryDate ? new Date(tx.expiryDate).toLocaleDateString('en-JO') : '-',
        fmtVisits(tx.visitsUsed, tx.totalVisitsAllowed),
        tx.subStatus || '-',
        tx.createdBy || '-',
      ])
      // Subtotal row
      const txSubRevenue = report.transactions.reduce((s: number, t: ReportTx) => s + t.amountPaid, 0)
      const txSubDiscount = report.transactions.reduce((s: number, t: ReportTx) => s + t.discountAmount, 0)
      txRows.push([
        '', t('report.total'), '', '',
        Math.round(txSubRevenue * 100) / 100,
        Math.round(txSubDiscount * 100) / 100,
        Math.round((txSubRevenue - txSubDiscount) * 100) / 100,
        '', '', '', '', '', '', '', '',
      ])
      const wsTx = XLSX.utils.aoa_to_sheet([[`${t('report.subscriptions')} — ${report.date}`], txHeaders, ...txRows])
      wsTx['!cols'] = [
        { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 10 },
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 8 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 14 },
      ]
      XLSX.utils.book_append_sheet(wb, wsTx, t('report.subscriptions'))

      // ── Sheet 3: Check-Ins ──
      const logHeaders = [
        t('report.studentName'), t('report.phone'), t('report.subscriptionType'),
        t('report.checkIn'), t('report.checkOut'), t('report.duration'), t('report.method'),
        'Staff',
      ]
      const logRows = report.logs.map((l: ReportLog) => {
        const inTime = new Date(l.checkInTime)
        const outTime = l.checkOutTime ? new Date(l.checkOutTime) : null
        let duration = t('report.stillInside')
        if (outTime) {
          const diffMin = Math.round((outTime.getTime() - inTime.getTime()) / 60000)
          const h = Math.floor(diffMin / 60)
          const m = diffMin % 60
          duration = `${h}:${String(m).padStart(2, '0')}`
        }
        return [
          l.studentName,
          l.studentPhone,
          l.subscriptionType,
          inTime.toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' }),
          outTime ? outTime.toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' }) : t('report.stillInside'),
          duration,
          l.method,
          l.processedBy || '-',
        ]
      })
      // Summary row
      const uniqueNames = new Set(report.logs.map((l: ReportLog) => l.studentName))
      logRows.push([
        `${t('report.total')}: ${report.logs.length} ${t('report.checkIns')}`,
        `${t('report.uniqueStudents')}: ${uniqueNames.size}`,
        '', '', '', '', '', '',
      ])
      const wsLogs = XLSX.utils.aoa_to_sheet([[`${t('report.checkIns')} — ${report.date}`], logHeaders, ...logRows])
      wsLogs['!cols'] = [
        { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
      ]
      XLSX.utils.book_append_sheet(wb, wsLogs, t('report.checkIns'))

      // ── Sheet 4: Cafe Sales (skip if empty) ──
      if (report.baristaOrders.length > 0) {
        const cafeHeaders = [
          t('report.receipt'), t('report.item'), t('report.quantity'),
          t('report.unitPrice'), t('report.options'), t('report.totalPrice'),
          t('report.paymentMethod'), t('report.student'), 'Date', t('report.time'),
          'Order Type',
        ]
        const cafeRows = report.baristaOrders.map((o: ReportOrder) => {
          let options = '-'
          try {
            const parsed = JSON.parse(o.selectedOptions)
            if (Array.isArray(parsed) && parsed.length > 0) {
              options = parsed.map((opt: { label?: string; name?: string } | string) => typeof opt === 'string' ? opt : (opt.label || opt.name || '')).join(', ')
            }
          } catch { /* keep default */ }
          return [
            o.receiptNumber,
            o.itemName,
            o.quantity,
            o.unitPrice,
            options,
            o.totalPrice,
            o.paymentMethod,
            o.studentName || '-',
            report.date,
            new Date(o.time).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' }),
            o.studentName ? 'Customer' : 'Walk-in',
          ]
        })
        const cafeTotal = report.baristaOrders.reduce((s: number, o: ReportOrder) => s + o.totalPrice, 0)
        cafeRows.push([
          '', t('report.total'), '', '', '', Math.round(cafeTotal * 100) / 100, '', '', '', '', '',
        ])
        const wsCafe = XLSX.utils.aoa_to_sheet([[`${t('report.cafeSales')} — ${report.date}`], cafeHeaders, ...cafeRows])
        wsCafe['!cols'] = [
          { wch: 14 }, { wch: 20 }, { wch: 8 }, { wch: 10 },
          { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
        ]
        XLSX.utils.book_append_sheet(wb, wsCafe, t('report.cafeSales'))
      }

      // ── Sheet 5: Expenses (skip if empty) ──
      if (report.expenses.length > 0) {
        const expHeaders = [
          t('report.description'), t('report.category'), t('report.amount'), t('report.addedBy'), t('report.time'),
        ]
        const expRows = report.expenses.map((e: ReportExpense) => [
          e.description, e.category, e.amount, e.addedBy,
          new Date(e.time).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' }),
        ])
        const expTotal = report.expenses.reduce((s: number, e: ReportExpense) => s + e.amount, 0)
        expRows.push([t('report.total'), '', Math.round(expTotal * 100) / 100, '', ''])
        const wsExp = XLSX.utils.aoa_to_sheet([[`${t('report.expenses')} — ${report.date}`], expHeaders, ...expRows])
        wsExp['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 8 }]
        XLSX.utils.book_append_sheet(wb, wsExp, t('report.expenses'))
      }

      XLSX.writeFile(wb, `Hive-Daily-Report-${report.date}.xlsx`)
    } catch {
      setError(t('report.exportFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 hover:border-green-500/30 text-xs font-bold transition-all disabled:opacity-40"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
        {loading ? t('report.generating') : t('report.exportDaily')}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
