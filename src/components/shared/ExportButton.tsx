'use client'
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface ExportButtonProps {
  label?: string
  fetchData: () => Promise<Record<string, unknown>[]>
  fileName: string
  sheetName?: string
}

export function ExportButton({ label = 'Export', fetchData, fileName, sheetName = 'Data' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const data = await fetchData()
      if (!data.length) return

      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
      XLSX.writeFile(wb, `${fileName}.xlsx`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-[#F5C518] hover:border-[#F5C518]/30 text-xs font-bold transition-all disabled:opacity-40"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {label}
    </button>
  )
}
