import { requireAuth } from '@/lib/authGuard'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import prisma from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const ip = getClientIp(req)
    const limit = checkRateLimit(`test-receipt-path:${ip}`, 10, 60 * 1000)
    if (limit.limited) {
      return Response.json({ error: 'Too many requests' }, { status: 429 })
    }

    const setting = await prisma.appSetting.findUnique({
      where: { key: 'receiptSavePath' },
    })

    const savePath = setting?.value?.trim()
    if (!savePath) {
      return Response.json({ success: false, error: 'No path configured' })
    }

    if (!path.isAbsolute(savePath)) {
      return Response.json({ success: false, error: 'Path must be absolute' })
    }

    const resolvedPath = path.resolve(savePath)
    if (resolvedPath !== path.normalize(savePath)) {
      return Response.json({ success: false, error: 'Invalid path' })
    }

    await fs.mkdir(resolvedPath, { recursive: true })

    const testFile = path.join(resolvedPath, '.hive-write-test')
    const resolvedTestFile = path.resolve(testFile)
    if (!resolvedTestFile.startsWith(resolvedPath)) {
      return Response.json({ success: false, error: 'Invalid path' })
    }
    await fs.writeFile(resolvedTestFile, 'test', 'utf-8')
    await fs.unlink(resolvedTestFile)

    return Response.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return Response.json({ success: false, error: msg })
  }
}
