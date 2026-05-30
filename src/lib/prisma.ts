import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'
import path from 'path'

function createPrismaClient() {
  const dbPath = path.join(process.cwd(), 'dev.db')

  // Ensure WAL mode is enabled for crash safety and concurrent read performance
  try {
    const rawDb = new Database(dbPath)
    const { journal_mode } = rawDb.pragma('journal_mode') as unknown as { journal_mode: string }
    if (journal_mode !== 'wal') {
      rawDb.pragma('journal_mode = WAL')
      console.log('[prisma] SQLite WAL mode enabled')
    }
    rawDb.close()
  } catch (e) {
    console.warn('[prisma] Could not verify WAL mode:', e)
  }

  const adapter = new PrismaBetterSqlite3({ url: dbPath })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
