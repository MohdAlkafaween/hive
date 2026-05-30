'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

interface ReceiptOption {
  name: string
  price: number
}

interface ReceiptItem {
  name: string
  basePrice: number
  options: ReceiptOption[]
  finalPrice: number
  quantity: number
}

interface ReceiptData {
  receiptNumber: string
  date: string
  staffName: string
  studentName: string | null
  studentId: string | null
  items: ReceiptItem[]
  total: number
  paymentMethod: string
  businessName: string
  receiptFooter: string
}

export default function ReceiptPrintPage() {
  const params = useParams()
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [error, setError] = useState('')
  const hasPrinted = useRef(false)

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        const res = await fetch(`/api/barista/orders/${params.id}/receipt`)
        if (!res.ok) throw new Error('Failed to load receipt')
        const data = await res.json()
        setReceipt(data)
      } catch {
        setError('Failed to load receipt')
      }
    }
    if (params.id) fetchReceipt()
  }, [params.id])

  useEffect(() => {
    if (receipt && !hasPrinted.current) {
      hasPrinted.current = true
      setTimeout(() => window.print(), 400)
    }
  }, [receipt])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#ef4444', fontSize: '16px' }}>{error}</p>
      </div>
    )
  }

  if (!receipt) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#666', fontSize: '14px' }}>Loading receipt...</p>
      </div>
    )
  }

  const formattedDate = new Date(receipt.date).toLocaleDateString('en-JO', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: 80mm;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
        @media screen {
          body {
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            padding: 20px;
          }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .receipt {
          font-family: 'Courier New', Courier, monospace;
          width: 80mm;
          max-width: 100%;
          padding: 8mm 4mm;
          background: white;
          color: #000;
          font-size: 12px;
          line-height: 1.5;
        }
        @media screen {
          .receipt {
            box-shadow: 0 2px 12px rgba(0,0,0,0.12);
            border-radius: 4px;
          }
        }
        .receipt-center {
          text-align: center;
        }
        .receipt-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
          display: block;
          margin: 0 auto 4px;
        }
        .receipt-title {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 4px;
        }
        .receipt-subtitle {
          font-size: 9px;
          color: #888;
          margin-bottom: 2px;
        }
        .divider {
          border: none;
          border-top: 1px dashed #ccc;
          margin: 8px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          font-size: 11px;
        }
        .row .label {
          color: #666;
        }
        .row .val {
          font-weight: 700;
          text-align: right;
          max-width: 55%;
          word-break: break-word;
        }
        .item-row {
          padding: 3px 0;
        }
        .item-name {
          font-weight: 700;
          font-size: 12px;
        }
        .item-option {
          font-size: 10px;
          color: #666;
          padding-left: 8px;
        }
        .total-row {
          font-size: 15px;
          font-weight: 900;
          padding: 4px 0;
        }
        .footer {
          text-align: center;
          font-size: 9px;
          color: #aaa;
          margin-top: 8px;
        }
        .screen-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          padding: 0 4mm;
          width: 80mm;
          max-width: 100%;
        }
        .screen-actions button {
          flex: 1;
          padding: 10px 0;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .screen-actions button:hover {
          opacity: 0.85;
        }
        .btn-print {
          background: #F5C518;
          color: #000;
        }
        .btn-close {
          background: #333;
          color: #fff;
        }
      `}</style>

      <div className="receipt">
        {/* Header */}
        <div className="receipt-center">
          <img src="/logo.png" alt="HIVE" className="receipt-logo" />
          <div className="receipt-title">{receipt.businessName}</div>
          <div className="receipt-subtitle">Coworking Management System</div>
        </div>

        <hr className="divider" />

        {/* Meta */}
        <div className="row">
          <span className="label">Receipt #</span>
          <span className="val">{receipt.receiptNumber}</span>
        </div>
        <div className="row">
          <span className="label">Date</span>
          <span className="val">{formattedDate}</span>
        </div>
        <div className="row">
          <span className="label">Cashier</span>
          <span className="val">{receipt.staffName}</span>
        </div>
        {receipt.studentName && (
          <div className="row">
            <span className="label">Customer</span>
            <span className="val">{receipt.studentName}</span>
          </div>
        )}

        <hr className="divider" />

        {/* Items */}
        {receipt.items.map((item, i) => (
          <div key={i} className="item-row">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="item-name">{item.quantity}x {item.name}</span>
              <span className="item-name">{item.finalPrice.toFixed(2)}</span>
            </div>
            {item.options.length > 0 && item.options.map((opt, j) => (
              <div key={j} className="item-option">
                + {opt.name} {opt.price > 0 ? `(+${opt.price.toFixed(2)})` : ''}
              </div>
            ))}
          </div>
        ))}

        <hr className="divider" />

        {/* Total */}
        <div className="row total-row">
          <span>TOTAL</span>
          <span>{receipt.total.toFixed(2)} JD</span>
        </div>

        <div className="row">
          <span className="label">Payment</span>
          <span className="val">{receipt.paymentMethod === 'CASH' ? 'Cash' : 'Card'}</span>
        </div>

        <hr className="divider" />

        {/* Footer */}
        <div className="footer">
          {receipt.receiptFooter}
          <br />
          {receipt.receiptNumber}
        </div>
      </div>

      {/* Screen-only actions */}
      <div className="screen-actions no-print">
        <button className="btn-print" onClick={() => window.print()}>Print Again</button>
        <button className="btn-close" onClick={() => window.close()}>Close</button>
      </div>
    </>
  )
}
