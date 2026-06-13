import { copyFile, mkdir, readdir, stat, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const DB_PATH = join(process.cwd(), 'dev.db')
const BACKUP_DIR = join(process.cwd(), 'backups')

export async function runScheduledBackup(trigger: 'SCHEDULED' | 'STARTUP' | 'MANUAL' = 'SCHEDULED'): Promise<{ success: boolean; fileName?: string; fileSize?: number; error?: string }> {
  const { default: prisma } = await import('@/lib/prisma')

  try {
    if (!existsSync(DB_PATH)) {
      const err = 'Database file not found'
      await prisma.backupLog.create({ data: { fileName: '', fileSize: 0, success: false, error: err, trigger } })
      return { success: false, error: err }
    }

    await mkdir(BACKUP_DIR, { recursive: true })
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `hive-backup-${timestamp}.db`
    const backupPath = join(BACKUP_DIR, fileName)

    await copyFile(DB_PATH, backupPath)
    const stats = await stat(backupPath)

    await prisma.backupLog.create({
      data: { fileName, fileSize: stats.size, success: true, trigger },
    })

    return { success: true, fileName, fileSize: stats.size }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown backup error'
    try {
      await prisma.backupLog.create({ data: { fileName: '', fileSize: 0, success: false, error: err, trigger } })
    } catch {}
    return { success: false, error: err }
  }
}

export async function pruneOldBackups(retentionDays: number): Promise<number> {
  if (!existsSync(BACKUP_DIR)) return 0

  const files = await readdir(BACKUP_DIR)
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  let deleted = 0

  for (const file of files) {
    if (!file.startsWith('hive-backup-')) continue
    const filePath = join(BACKUP_DIR, file)
    const stats = await stat(filePath)
    if (stats.mtimeMs < cutoff) {
      await unlink(filePath)
      deleted++
    }
  }

  return deleted
}
