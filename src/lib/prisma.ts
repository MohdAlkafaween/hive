import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'
import path from 'path'

function createPrismaClient() {
  const dbPath = path.join(process.cwd(), 'dev.db')

  // Ensure WAL mode and busy_timeout are set for crash safety and concurrent access
  try {
    const rawDb = new Database(dbPath)
    const { journal_mode } = rawDb.pragma('journal_mode') as unknown as { journal_mode: string }
    if (journal_mode !== 'wal') {
      rawDb.pragma('journal_mode = WAL')
      console.log('[prisma] SQLite WAL mode enabled')
    }
    // Wait up to 5 seconds for write locks to release instead of failing immediately
    rawDb.pragma('busy_timeout = 5000')
    rawDb.close()
  } catch (e) {
    console.warn('[prisma] Could not verify WAL mode:', e)
  }

  const adapter = new PrismaBetterSqlite3({ url: dbPath })
  // SECURITY: globally omit the customer password hash from every Student query.
  // Routes that genuinely need it (customer login/register/password-change) must
  // re-include it explicitly via `omit: { password: false }` or a `select`.
  return new PrismaClient({
    adapter,
    omit: {
      student: { password: true },
    },
  })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
