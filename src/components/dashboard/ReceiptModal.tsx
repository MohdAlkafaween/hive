'use client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, Calendar, Printer } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export interface ReceiptData {
  studentName: string
  plan: string
  amountPaid: number
  discount: number
  expiryDate: string
  receiptNumber?: string // linked receipt number for printing
}

interface ReceiptModalProps {
  open: boolean
  onClose: () => void
  data: ReceiptData | null
}

export function ReceiptModal({ open, onClose, data }: ReceiptModalProps) {
  const { t } = useI18n()
  if (!data) return null

  const handlePrint = async () => {
    if (data.receiptNumber) {
      // Open the unified receipt print page
      window.open(`/barista/receipt/${data.receiptNumber}`, '_blank')
      return
    }
    // Fallback: old inline print for receipts without a number
    // Fetch business settings for the receipt
    let businessName = 'HIVE Study House'
    let receiptFooter = 'Thank you for your visit!'
    try {
      const settingsRes = await fetch('/api/settings')
      if (settingsRes.ok) {
        const s = await settingsRes.json() as Record<string, string>
        if (s.businessName) businessName = s.businessName
        if (s.receiptFooter) receiptFooter = s.receiptFooter
      }
    } catch {}
    const today = new Date().toLocaleDateString('en-JO', { year: 'numeric', month: 'long', day: 'numeric' })
    const html = `<!DOCTYPE html><html><head><title>${businessName} Receipt</title><style>
      body{font-family:system-ui,sans-serif;max-width:320px;margin:20px auto;padding:20px;color:#111}
      .logo{text-align:center;font-size:28px;font-weight:900;letter-spacing:4px;margin-bottom:4px}
      .sub{text-align:center;font-size:10px;color:#888;margin-bottom:20px}
      .line{border-top:1px dashed #ccc;margin:12px 0}
      .row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
      .row .label{color:#666}.row .val{font-weight:600}
      .total{font-size:16px;font-weight:800}
      .footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px}
      @media print{body{margin:0}}
    </style></head><body>
      <img src="/logo.png" alt="${businessName}" style="width:50px;height:50px;object-fit:contain;display:block;margin:0 auto 4px" />
      <div class="logo">${businessName}</div>
      <div class="sub">Coworking Management System</div>
      <div class="line"></div>
      <div class="row"><span class="label">Date</span><span class="val">${today}</span></div>
      <div class="row"><span class="label">Student</span><span class="val">${data.studentName}</span></div>
      <div class="row"><span class="label">Plan</span><span class="val">${data.plan}</span></div>
      <div class="line"></div>
      ${data.discount > 0 ? `<div class="row"><span class="label">Discount</span><span class="val">-${data.discount.toFixed(2)} JD</span></div>` : ''}
      <div class="row total"><span class="label">Amount Paid</span><span class="val">${data.amountPaid.toFixed(2)} JD</span></div>
      <div class="line"></div>
      <div class="row"><span class="label">Expires</span><span class="val">${new Date(data.expiryDate).toLocaleDateString('en-JO')}</span></div>
      <div class="footer">${receiptFooter}</div>
    </body></html>`
    const w = window.open('', '_blank', 'width=400,height=600')
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print() }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('receipt.title')} maxWidth="max-w-sm">
      <div className="flex flex-col items-center gap-5 pb-2 pt-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-2 shadow-sm border border-green-100">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>

        <div className="text-center space-y-1 w-full">
          <p className="text-xl font-bold text-[#171717]">{data.studentName}</p>
          <p className="text-[#737373] text-sm">{t('receipt.renewed')}</p>
          {data.receiptNumber && (
            <p className="text-xs text-[#999] font-mono">{data.receiptNumber}</p>
          )}
        </div>

        <div className="w-full bg-[#FDFCF8] border border-[#E5E7EB] rounded-lg p-4 space-y-3 shadow-sm">
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#52525B]">{t('receipt.plan')}</span>
            <span className="font-semibold text-[#F5C518]">{data.plan}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#52525B]">{t('receipt.amountPaid')}</span>
            <span className="font-semibold text-[#171717]">{data.amountPaid.toFixed(2)} JD</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#52525B]">{t('receipt.discount')}</span>
              <span className="font-semibold text-[#F5C518]">{data.discount.toFixed(2)} JD</span>
            </div>
          )}
          <div className="h-px bg-[#E5E7EB] my-2 w-full" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-[#52525B] flex items-center gap-1.5"><Calendar size={14} /> {t('receipt.expiry')}</span>
            <span className="font-medium text-[#171717]">{new Date(data.expiryDate).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex gap-2 w-full">
          <Button onClick={handlePrint} variant="secondary" className="flex-1 shadow-md" size="lg">
            <Printer size={16} className="mr-1.5" />
            {t('receipt.print')}
          </Button>
          <Button onClick={onClose} className="flex-1 shadow-md" size="lg">
            {t('common.done')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
