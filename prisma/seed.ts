import { PrismaClient } from '../src/generated/prisma'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'

const dbPath = path.join(process.cwd(), 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding HIVE database (clean production seed)...\n')

  // ─── Clear existing data (order matters for FK constraints) ───
  await prisma.promoUsage.deleteMany()
  await prisma.baristaOrder.deleteMany()
  await prisma.studentNote.deleteMany()
  await prisma.waitlistEntry.deleteMany()
  await prisma.log.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.menuItemOptionValue.deleteMany()
  await prisma.menuItemOption.deleteMany()
  await prisma.menuCategory.deleteMany()
  await prisma.promoCode.deleteMany()
  await prisma.cafeExpense.deleteMany()
  await prisma.cashRegister.deleteMany()
  await prisma.staffShift.deleteMany()
  await prisma.staffAuditLog.deleteMany()
  await prisma.backupLog.deleteMany()
  await prisma.student.deleteMany()
  await prisma.subscriptionPlan.deleteMany()
  await prisma.appSetting.deleteMany()
  await prisma.user.deleteMany()

  console.log('  ✓ Cleared all data')

  // ─── 1. ADMIN ACCOUNT ───
  const SEED_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@hive.study'
  const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234'
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn('  ⚠ SEED_ADMIN_PASSWORD not set — using default. Change it after first login!')
  }
  const pw = await bcrypt.hash(SEED_PASSWORD, 12)

  await prisma.user.create({
    data: {
      email: SEED_EMAIL,
      password: pw,
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log(`  ✓ Admin account created: ${SEED_EMAIL}`)

  // ─── 2. DEFAULT APP SETTINGS ───
  await prisma.appSetting.createMany({
    data: [
      { key: 'maxCapacity',          value: '30' },
      { key: 'displayEnabled',       value: 'true' },
      { key: 'displayConnection',    value: 'browser' },
      { key: 'businessName',         value: 'HIVE Study House' },
      { key: 'receiptFooter',        value: 'Thank you for visiting!' },
      { key: 'autoCheckoutTime',     value: '23:00' },
      { key: 'maxSessionHours',      value: '12' },
      { key: 'maxFreezeDays',        value: '14' },
      { key: 'backupFrequencyHours', value: '6' },
      { key: 'backupRetentionDays',  value: '30' },
      { key: 'nextReceiptNumber',    value: '1' },
      { key: 'nextStudentNumber',    value: '1' },
    ],
  })

  console.log('  ✓ Default app settings created')

  // ─── 3. DEFAULT SUBSCRIPTION PLANS ───
  await prisma.subscriptionPlan.createMany({
    data: [
      { name: 'Daily',   nameAr: 'يومي',   durationDays: 1,  totalVisits: 999, price: 3,  sortOrder: 1, isActive: true },
      { name: 'Weekly',  nameAr: 'أسبوعي', durationDays: 10, totalVisits: 7,   price: 15, sortOrder: 2, isActive: true },
      { name: 'Monthly', nameAr: 'شهري',   durationDays: 40, totalVisits: 30,  price: 50, sortOrder: 3, isActive: true },
    ],
  })

  console.log('  ✓ Default subscription plans created (Daily, Weekly, Monthly)')

  // ─── SUMMARY ───
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('  🐝 HIVE seed complete!')
  console.log('═══════════════════════════════════════════')
  console.log('')
  console.log(`  Admin: ${SEED_EMAIL}`)
  console.log(`  Password: ${process.env.SEED_ADMIN_PASSWORD ? '(from env)' : SEED_PASSWORD}`)
  console.log('')
  console.log('  The database is clean and ready for production.')
  console.log('  Create staff accounts, students, and menu items')
  console.log('  through the admin panel after logging in.')
  console.log('')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
