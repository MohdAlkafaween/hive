import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/authGuard'
import { readFile, copyFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import prisma from '@/lib/prisma'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    const ip = getClientIp(req)
    const limit = checkRateLimit(`backup:${ip}`, 5, 60 * 60 * 1000)
    if (limit.limited) {
      return Response.json({ error: 'Too many backup requests' }, { status: 429 })
    }

    const dbPath = join(process.cwd(), 'dev.db')
    if (!existsSync(dbPath)) {
      return Response.json({ error: 'Database file not found' }, { status: 404 })
    }

    // Copy to a temp backup file first to avoid locking issues
    const backupDir = join(process.cwd(), 'backups')
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
// Requires X-Confirm-Restore: "true" header as a safety gate
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth('ADMIN')
    if (session instanceof Response) return session

    // Safety gate — require explicit confirmation header
    if (req.headers.get('X-Confirm-Restore') !== 'true') {
      return Response.json(
        { error: 'Restore requires X-Confirm-Restore: true header' },
        { status: 400 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('database') as File | null
    if (!file) return Response.json({ error: 'No database file provided' }, { status: 400 })

    if (file.size > 100 * 1024 * 1024) {
      return Response.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    const dbPath = join(process.cwd(), 'dev.db')

    // Create safety backup of current DB
    const backupDir = join(process.cwd(), 'backups')
    await mkdir(backupDir, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    if (existsSync(dbPath)) {
      await copyFile(dbPath, join(backupDir, `pre-restore-${timestamp}.db`))
    }

    // Validate uploaded file is a valid SQLite database
    const bytes = new Uint8Array(await file.arrayBuffer())
    const SQLITE_MAGIC = 'SQLite format 3\0'
    const header = new TextDecoder('ascii').decode(bytes.slice(0, 16))
    if (header !== SQLITE_MAGIC) {
      return Response.json({ error: 'Invalid SQLite database file' }, { status: 400 })
    }

    // Audit trail (log BEFORE overwriting, since DB will be replaced)
    const ip = getClientIp(req)
    await prisma.staffAuditLog.create({
      data: {
        userId: session.userId as number,
        email: session.email as string,
        role: session.role as string,
        event: 'DB_RESTORE',
        ip,
        details: `Restored database from upload (${file.name}, ${(file.size / 1024).toFixed(1)} KB). Pre-restore backup: pre-restore-${timestamp}.db`,
      },
    })

    // Write validated file as new DB
    const { writeFile: wf, unlink } = await import('fs/promises')

    // Critical: SQLite WAL mode keeps -wal and -shm sidecar files. If we
    // overwrite the main DB but leave them in place, SQLite consults the
    // stale WAL on next open and reads pre-restore data on top of the new
    // file. Remove them so SQLite re-initializes against the restored DB.
    for (const ext of ['-wal', '-shm']) {
      if (existsSync(dbPath + ext)) {
        await unlink(dbPath + ext).catch(() => {})
      }
    }

    await wf(dbPath, bytes)

    // The currently-running Prisma client holds an open connection to the
    // old DB and won't see the swap. In production (Docker with
    // restart: unless-stopped), exit the process so the orchestrator
    // restarts the container against the restored file. In dev, the user
    // restarts the dev server manually.
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => process.exit(0), 500)
      return Response.json({
        success: true,
        message: 'Database restored. The server is restarting — refresh in ~15 seconds.',
      })
    }

    return Response.json({
      success: true,
      message: 'Database restored. Restart the server to apply changes.',
    })
  } catch (e) {
    console.error('[POST /api/backup]', e)
    return Response.json({ error: 'Restore failed' }, { status: 500 })
  }
}
