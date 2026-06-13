'use client'
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ExcelExportProps {
  date: string
}

// Row shapes returned by /api/logs/today and /api/stats/daily
interface ExportLog {
  date: string
  checkInTime: string
  checkOutTime: string | null
  method?: string | null
  studentName?: string | null
  processedBy?: number | null
  processedByUser?: { name: string } | null
  student?: { fullName?: string; phone?: string; subscriptions?: { planType: string }[] } | null
}

interface ExportTx {
  receiptNumber?: string | null
  studentName?: string | null
  student?: { fullName?: string } | null
  subscription?: { planType: string } | null
  planType: string
  gateway: string
  amountPaid: number
  discountAmount: number
  createdAt: string
  type: string
}

export function ExcelExport({ date }: ExcelExportProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/logs/today?date=${date}`),
        fetch(`/api/stats/daily?date=${date}`),
      ])
      const logsData = await logsRes.json()
      const stats = await statsRes.json()

      const logs = Array.isArray(logsData) ? logsData : (logsData.logs ?? logsData)

      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Sheet 1 — Attendance Log
      const attendanceData = logs.map((l: ExportLog) => ({
        'Name': l.student?.fullName || l.studentName || 'Deleted Student',
        'Phone': l.student?.phone || '',
        'Date': l.date,
        'Check-In': new Date(l.checkInTime).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' }),
        'Check-Out': l.checkOutTime ? new Date(l.checkOutTime).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' }) : '-',
        'Duration': l.checkOutTime
          ? `${Math.round((new Date(l.checkOutTime).getTime() - new Date(l.checkInTime).getTime()) / 60000)} min`
          : 'Still In',
        'Method': l.method || 'MANUAL',
        'Staff': l.processedByUser?.name || l.processedBy || '-',
        'Plan Type': l.student?.subscriptions?.[0]?.planType || '-',
      }))
      const ws1 = XLSX.utils.json_to_sheet(attendanceData)
      ws1['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws1, 'Attendance Log')

      // Sheet 2 — Financial Summary
      const txData = stats.transactions.map((t: ExportTx) => ({
        'Receipt #': t.receiptNumber || '-',
        'Student': t.student?.fullName || t.studentName || 'Deleted Student',
        'Plan': t.subscription?.planType || t.planType,
        'Gateway': t.gateway,
        'Paid (JD)': t.amountPaid,
        'Discount': t.discountAmount,
        'Date': new Date(t.createdAt).toLocaleDateString('en-JO'),
        'Time': new Date(t.createdAt).toLocaleTimeString('en-JO', { hour: '2-digit', minute: '2-digit' }),
        'Type': t.type,
      }))

      // Totals row
      txData.push({
        'Receipt #': '',
        'Student': 'TOTAL',
        'Plan': '',
        'Gateway': '',
        'Paid (JD)': stats.totalRevenue,
        'Discount': stats.totalDiscounts,
        'Date': '',
        'Time': '',
        'Type': '',
      })

      // Revenue by gateway
      txData.push({} as typeof txData[0])
      txData.push({ 'Receipt #': '', 'Student': 'Gateway Breakdown', 'Plan': '', 'Gateway': '', 'Paid (JD)': 0, 'Discount': 0, 'Date': '', 'Time': '', 'Type': '' })
      for (const [gw, amt] of Object.entries(stats.revenueByGateway as Record<string, number>)) {
        txData.push({ 'Receipt #': '', 'Student': gw, 'Plan': '', 'Gateway': '', 'Paid (JD)': amt, 'Discount': 0, 'Date': '', 'Time': '', 'Type': '' })
      }

      const ws2 = XLSX.utils.json_to_sheet(txData)
      ws2['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Financial Summary')

      XLSX.writeFile(wb, `HIVE_Report_${date}.xlsx`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleExport} disabled={loading} variant="secondary">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {loading ? 'Generating…' : `Export ${date} (.xlsx)`}
    </Button>
  )
}
