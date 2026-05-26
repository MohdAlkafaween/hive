import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/authGuard'
import { readFile, copyFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// GET — download database backup (ADMIN only)
export async function GET() {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const dbPath = join(process.cwd(), 'prisma', 'dev.db')
    if (!existsSync(dbPath)) {
      return Response.json({ error: 'Database file not found' }, { status: 404 })
    }

    // Copy to a temp backup file first to avoid locking issues
    const backupDir = join(process.cwd(), 'prisma', 'backups')
    await mkdir(backupDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = join(backupDir, `hive-backup-${timestamp}.db`)
    await copyFile(dbPath, backupPath)

    const buffer = await readFile(backupPath)

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="hive-backup-${timestamp}.db"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    })
  } catch (e) {
    console.error('[GET /api/backup]', e)
    return Response.json({ error: 'Backup failed' }, { status: 500 })
  }
}

// POST — restore database from upload (ADMIN only)
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const formData = await req.formData()
    const file = formData.get('database') as File | null
    if (!file) return Response.json({ error: 'No database file provided' }, { status: 400 })

    if (file.size > 100 * 1024 * 1024) {
      return Response.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    const dbPath = join(process.cwd(), 'prisma', 'dev.db')

    // Create safety backup of current DB
    const backupDir = join(process.cwd(), 'prisma', 'backups')
    await mkdir(backupDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    if (existsSync(dbPath)) {
      await copyFile(dbPath, join(backupDir, `pre-restore-${timestamp}.db`))
    }

    // Write uploaded file as new DB
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { writeFile: wf } = await import('fs/promises')
    await wf(dbPath, bytes)

    return Response.json({ success: true, message: 'Database restored. Restart the server to apply changes.' })
  } catch (e) {
    console.error('[POST /api/backup]', e)
    return Response.json({ error: 'Restore failed' }, { status: 500 })
  }
}
