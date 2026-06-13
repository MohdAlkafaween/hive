import fs from 'fs/promises'
import path from 'path'
import prisma from './prisma'

interface ReceiptData {
  receiptNumber: string
  type: 'barista' | 'customer-order' | 'subscription'
  content: Record<string, unknown>
  date: Date
}

export async function saveReceiptToFile(data: ReceiptData): Promise<void> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'receiptSavePath' },
    })

    const savePath = setting?.value?.trim()
    if (!savePath) return

    if (!path.isAbsolute(savePath)) {
      console.warn('[receipt-writer] receiptSavePath is not absolute, skipping save')
      return
    }

    const resolvedBase = path.resolve(savePath)

    const dateFolder = `${data.date.getFullYear()}-${String(data.date.getMonth() + 1).padStart(2, '0')}`
    const targetDir = path.join(resolvedBase, dateFolder)

    await fs.mkdir(targetDir, { recursive: true })

    const d = data.date
    const timestamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
    const sanitizedReceiptNum = data.receiptNumber.replace(/[^a-zA-Z0-9-]/g, '')
    const filename = `${data.type}_${sanitizedReceiptNum}_${timestamp}.json`
    const filePath = path.join(targetDir, filename)

    // Prevent path traversal
    const resolvedFile = path.resolve(filePath)
    if (!resolvedFile.startsWith(resolvedBase)) {
      console.warn('[receipt-writer] Path traversal attempt detected, skipping')
      return
    }

    const fileContent = JSON.stringify({
      receiptNumber: data.receiptNumber,
      type: data.type,
      savedAt: data.date.toISOString(),
      ...data.content,
    }, null, 2)

    await fs.writeFile(filePath, fileContent, 'utf-8')
  } catch (error) {
    console.error('[receipt-writer] Failed to save receipt:', error instanceof Error ? error.message : error)
  }
}
