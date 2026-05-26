import { PrismaClient } from '../src/generated/prisma'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'

const dbPath = path.join(process.cwd(), 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding HIVE database...\n')

  // ─── Clear existing data (order matters for FK constraints) ───
  await prisma.promoUsage.deleteMany()
  await prisma.baristaOrder.deleteMany()
  await prisma.studentNote.deleteMany()
  await prisma.waitlistEntry.deleteMany()
  await prisma.log.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.promoCode.deleteMany()
  await prisma.staffShift.deleteMany()
  await prisma.staffAuditLog.deleteMany()
  await prisma.student.deleteMany()
  await prisma.appSetting.deleteMany()
  await prisma.user.deleteMany()

  console.log('  ✓ Cleared old data')

  // ─── 1. STAFF USERS ───
  const pw = await bcrypt.hash('Admin@1234', 12)

  const admin = await prisma.user.create({
    data: { email: 'admin@hive.study', password: pw, name: 'Mohammad Al-Khalidi', phone: '0791234567', role: 'ADMIN' },
  })
  const barista = await prisma.user.create({
    data: { email: 'barista@hive.study', password: pw, name: 'Sara Haddad', phone: '0797654321', role: 'BARISTA', createdById: admin.id },
  })
  const counter = await prisma.user.create({
    data: { email: 'front@hive.study', password: pw, name: 'Omar Nasser', phone: '0781112233', role: 'REGISTERATION_COUNTER', createdById: admin.id },
  })
  const manager = await prisma.user.create({
    data: { email: 'manager@hive.study', password: pw, name: 'Lina Barakat', phone: '0789998877', role: 'MANAGER', permissions: JSON.stringify(['/', '/directory', '/stats', '/logs']), createdById: admin.id },
  })

  console.log('  ✓ 4 staff users (all password: Admin@1234)')
  console.log('    admin@hive.study  | barista@hive.study | front@hive.study | manager@hive.study')

  // ─── 2. STUDENTS ───
  const studentData = [
    { fullName: 'Ahmad Jaradat',      phone: '0791000001', major: 'Computer Science',       rfidUuid: 'RFID-A1B2C3D4' },
    { fullName: 'Rania Masri',        phone: '0791000002', major: 'Business Administration', rfidUuid: 'RFID-E5F6G7H8' },
    { fullName: 'Khaled Obeidat',     phone: '0791000003', major: 'Mechanical Engineering',  rfidUuid: 'RFID-I9J0K1L2' },
    { fullName: 'Nour Sabbagh',       phone: '0791000004', major: 'Graphic Design',          rfidUuid: 'RFID-M3N4O5P6' },
    { fullName: 'Tariq Hamdan',       phone: '0791000005', major: 'Medicine',                rfidUuid: 'RFID-Q7R8S9T0' },
    { fullName: 'Layla Aqrabawi',     phone: '0791000006', major: 'Architecture',            rfidUuid: null },
    { fullName: 'Sami Khatib',        phone: '0791000007', major: 'Pharmacy',                rfidUuid: 'RFID-U1V2W3X4' },
    { fullName: 'Dina Tarawneh',      phone: '0791000008', major: 'Law',                     rfidUuid: null },
    { fullName: 'Yousef Qasem',       phone: '0791000009', major: 'Electrical Engineering',  rfidUuid: 'RFID-Y5Z6A7B8' },
    { fullName: 'Haya Zubaidi',       phone: '0791000010', major: 'Dentistry',               rfidUuid: null },
    { fullName: 'Faris Al-Bakri',     phone: '0791000011', major: 'Computer Science',        rfidUuid: 'RFID-C9D0E1F2' },
    { fullName: 'Mira Salman',        phone: '0791000012', major: 'Marketing',               rfidUuid: null },
    { fullName: 'Zaid Halawani',      phone: '0791000013', major: 'Civil Engineering',       rfidUuid: 'RFID-G3H4I5J6' },
    { fullName: 'Lana Rasheed',       phone: '0791000014', major: 'Psychology',              rfidUuid: null },
    { fullName: 'Bashar Natsheh',     phone: '0791000015', major: 'Accounting',              rfidUuid: 'RFID-K7L8M9N0' },
    { fullName: 'Reem Abu-Ghazaleh',  phone: '0791000016', major: 'Interior Design',        rfidUuid: null },
    { fullName: 'Mohannad Taha',      phone: '0791000017', major: 'IT',                      rfidUuid: 'RFID-O1P2Q3R4' },
    { fullName: 'Jana Qudsi',         phone: '0791000018', major: 'Nursing',                 rfidUuid: null },
    { fullName: 'Aws Ghazawi',        phone: '0791000019', major: 'Finance',                 rfidUuid: 'RFID-S5T6U7V8' },
    { fullName: 'Tala Khoury',        phone: '0791000020', major: 'English Literature',      rfidUuid: null },
  ]

  const students = []
  for (const s of studentData) {
    const student = await prisma.student.create({
      data: {
        ...s,
        qrToken: `QR-${s.phone.slice(-4)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        lifetimeCheckIns: Math.floor(Math.random() * 60) + 5,
        createdAt: randomDate(45),
      },
    })
    students.push(student)
  }
  console.log(`  ✓ ${students.length} students`)

  // ─── 3. SUBSCRIPTIONS ───
  const now = new Date()
  const plans: Array<{ type: string; price: number; visits: number; days: number }> = [
    { type: 'Monthly', price: 50, visits: 30, days: 40 },
    { type: 'Weekly',  price: 15, visits: 7,  days: 10 },
    { type: 'Daily',   price: 3,  visits: 999, days: 1 },
  ]

  // Active monthly subscriptions
  for (let i = 0; i < 10; i++) {
    const plan = plans[i < 7 ? 0 : 1] // 7 monthly, 3 weekly
    const startDate = randomDate(plan.days - 5) // started within plan duration
    const expiry = new Date(startDate)
    expiry.setDate(expiry.getDate() + plan.days)
    await prisma.subscription.create({
      data: {
        studentId: students[i].id,
        studentName: students[i].fullName,
        planType: plan.type,
        startDate,
        expiryDate: expiry,
        totalVisitsAllowed: plan.visits,
        visitsUsed: Math.floor(Math.random() * Math.min(plan.visits, 15)),
        isActive: true,
      },
    })
  }

  // Expired subscriptions
  for (let i = 10; i < 14; i++) {
    const plan = plans[Math.floor(Math.random() * 2)]
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 50)
    const expiry = new Date(startDate)
    expiry.setDate(expiry.getDate() + plan.days)
    await prisma.subscription.create({
      data: {
        studentId: students[i].id,
        studentName: students[i].fullName,
        planType: plan.type,
        startDate,
        expiryDate: expiry,
        totalVisitsAllowed: plan.visits,
        visitsUsed: plan.visits,
        isActive: false,
      },
    })
  }

  // Frozen subscription
  await prisma.subscription.create({
    data: {
      studentId: students[14].id,
      studentName: students[14].fullName,
      planType: 'Monthly',
      startDate: randomDate(20),
      expiryDate: futureDate(15),
      totalVisitsAllowed: 30,
      visitsUsed: 8,
      isActive: true,
      isFrozen: true,
      frozenAt: randomDate(3),
      freezeDays: 3,
    },
  })

  // Expiring soon (within 3 days)
  for (let i = 15; i < 18; i++) {
    const expiry = new Date(now)
    expiry.setDate(expiry.getDate() + Math.floor(Math.random() * 3) + 1) // 1-3 days left
    await prisma.subscription.create({
      data: {
        studentId: students[i].id,
        studentName: students[i].fullName,
        planType: 'Monthly',
        startDate: randomDate(35),
        expiryDate: expiry,
        totalVisitsAllowed: 30,
        visitsUsed: Math.floor(Math.random() * 25) + 5,
        isActive: true,
      },
    })
  }

  console.log('  ✓ 18 subscriptions (10 active, 4 expired, 1 frozen, 3 expiring soon)')

  // ─── 4. CHECK-IN LOGS ───
  const today = now.toISOString().slice(0, 10)

  // Today's logs — some checked in, some checked out
  for (let i = 0; i < 8; i++) {
    const checkIn = new Date(now)
    checkIn.setHours(8 + i, Math.floor(Math.random() * 60), 0)
    const checkedOut = i < 5 // first 5 have checked out
    await prisma.log.create({
      data: {
        studentId: students[i].id,
        studentName: students[i].fullName,
        checkInTime: checkIn,
        checkOutTime: checkedOut ? (() => { const co = new Date(checkIn); co.setHours(co.getHours() + 2 + Math.floor(Math.random() * 4)); return co })() : null,
        date: today,
      },
    })
  }

  // Past 30 days of logs for chart data
  for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
    const d = new Date(now)
    d.setDate(d.getDate() - dayOffset)
    const dateStr = d.toISOString().slice(0, 10)
    const numLogs = Math.floor(Math.random() * 12) + 3 // 3-14 per day

    for (let j = 0; j < numLogs; j++) {
      const sid = students[Math.floor(Math.random() * students.length)]
      const checkIn = new Date(d)
      checkIn.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0)
      const checkOut = new Date(checkIn)
      checkOut.setHours(checkOut.getHours() + 1 + Math.floor(Math.random() * 5))

      await prisma.log.create({
        data: {
          studentId: sid.id,
          studentName: sid.fullName,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          date: dateStr,
        },
      })
    }
  }

  console.log('  ✓ ~250+ check-in logs (today + 30 days history)')

  // ─── 5. TRANSACTIONS ───
  const gateways = ['Cash', 'CliQ', 'eFAWATEERcom', 'Credit Card']

  // Today's transactions
  for (let i = 0; i < 5; i++) {
    const plan = plans[Math.floor(Math.random() * 2)]
    const discount = Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 2 : 0
    const txTime = new Date(now)
    txTime.setHours(9 + i * 2, Math.floor(Math.random() * 60), 0)
    await prisma.transaction.create({
      data: {
        studentId: students[i].id,
        studentName: students[i].fullName,
        amountPaid: plan.price - discount,
        planType: plan.type,
        gateway: gateways[Math.floor(Math.random() * gateways.length)],
        discountAmount: discount,
        createdAt: txTime,
      },
    })
  }

  // Past 30 days of transactions
  for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
    const d = new Date(now)
    d.setDate(d.getDate() - dayOffset)
    const numTx = Math.floor(Math.random() * 4) + 1 // 1-4 per day

    for (let j = 0; j < numTx; j++) {
      const plan = plans[Math.floor(Math.random() * 3)]
      const sid = students[Math.floor(Math.random() * students.length)]
      const discount = Math.random() > 0.8 ? Math.floor(Math.random() * 5) + 1 : 0
      const txTime = new Date(d)
      txTime.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0)

      await prisma.transaction.create({
        data: {
          studentId: sid.id,
          studentName: sid.fullName,
          amountPaid: plan.price - discount,
          planType: plan.type,
          gateway: gateways[Math.floor(Math.random() * gateways.length)],
          discountAmount: discount,
          createdAt: txTime,
        },
      })
    }
  }

  console.log('  ✓ ~80+ transactions (today + 30 days)')

  // ─── 6. MENU ITEMS ───
  const menuItems = await Promise.all([
    prisma.menuItem.create({ data: { name: 'Espresso',        price: 1.50, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Cappuccino',      price: 2.50, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Latte',           price: 2.50, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Americano',       price: 2.00, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Mocha',           price: 3.00, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Iced Coffee',     price: 2.75, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Hot Chocolate',   price: 2.50, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Green Tea',       price: 1.50, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Croissant',       price: 1.75, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Muffin',          price: 2.00, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Sandwich (Club)', price: 3.50, imageUrl: null } }),
    prisma.menuItem.create({ data: { name: 'Water Bottle',    price: 0.50, imageUrl: null, isOutOfStock: true } }),
  ])

  console.log(`  ✓ ${menuItems.length} menu items (1 out of stock)`)

  // ─── 7. BARISTA ORDERS ───
  // Today's orders
  for (let i = 0; i < 12; i++) {
    const item = menuItems[Math.floor(Math.random() * (menuItems.length - 1))] // skip out-of-stock
    const qty = Math.random() > 0.7 ? 2 : 1
    const orderTime = new Date(now)
    orderTime.setHours(8 + Math.floor(i * 0.8), Math.floor(Math.random() * 60), 0)

    await prisma.baristaOrder.create({
      data: {
        menuItemId: item.id,
        quantity: qty,
        totalPrice: item.price * qty,
        studentId: Math.random() > 0.5 ? students[Math.floor(Math.random() * 10)].id : null,
        createdAt: orderTime,
      },
    })
  }

  // Past 14 days of orders
  for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
    const d = new Date(now)
    d.setDate(d.getDate() - dayOffset)
    const numOrders = Math.floor(Math.random() * 8) + 3

    for (let j = 0; j < numOrders; j++) {
      const item = menuItems[Math.floor(Math.random() * (menuItems.length - 1))]
      const qty = Math.random() > 0.8 ? 2 : 1
      const orderTime = new Date(d)
      orderTime.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0)

      await prisma.baristaOrder.create({
        data: {
          menuItemId: item.id,
          quantity: qty,
          totalPrice: item.price * qty,
          studentId: Math.random() > 0.6 ? students[Math.floor(Math.random() * students.length)].id : null,
          createdAt: orderTime,
        },
      })
    }
  }

  console.log('  ✓ ~100+ barista orders (today + 14 days)')

  // ─── 8. PROMO CODES ───
  await prisma.promoCode.create({
    data: { code: 'WELCOME10', discountType: 'PERCENTAGE', discountAmount: 10, isActive: true, maxUses: 50, timesUsed: 12 },
  })
  await prisma.promoCode.create({
    data: { code: 'HIVE5JD', discountType: 'AMOUNT', discountAmount: 5, isActive: true, maxUses: 20, timesUsed: 3 },
  })
  await prisma.promoCode.create({
    data: { code: 'BONUS3', discountType: 'BONUS_ENTRIES', discountAmount: 0, bonusEntries: 3, isActive: true, maxUses: 10, timesUsed: 1 },
  })
  await prisma.promoCode.create({
    data: { code: 'EXPIRED20', discountType: 'PERCENTAGE', discountAmount: 20, isActive: false, maxUses: 5, timesUsed: 5, expiresAt: new Date('2025-12-31') },
  })
  await prisma.promoCode.create({
    data: { code: 'SUMMER25', discountType: 'PERCENTAGE', discountAmount: 25, isActive: true, maxUses: 100, timesUsed: 0, expiresAt: futureDate(60) },
  })

  // Promo usages
  const promos = await prisma.promoCode.findMany()
  for (let i = 0; i < 8; i++) {
    const promo = promos[Math.floor(Math.random() * 3)] // only use active ones
    await prisma.promoUsage.create({
      data: {
        promoCodeId: promo.id,
        studentId: students[i].id,
        studentName: students[i].fullName,
        discount: promo.discountType === 'PERCENTAGE' ? (50 * promo.discountAmount / 100) : promo.discountAmount,
        createdAt: randomDate(20),
      },
    })
  }

  console.log('  ✓ 5 promo codes (3 active, 1 expired, 1 future) + 8 usages')

  // ─── 9. STAFF SHIFTS ───
  const staffMembers = [
    { userId: admin.id,   email: admin.email,   role: admin.role },
    { userId: barista.id, email: barista.email,  role: barista.role },
    { userId: counter.id, email: counter.email,  role: counter.role },
    { userId: manager.id, email: manager.email,  role: manager.role },
  ]

  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const d = new Date(now)
    d.setDate(d.getDate() - dayOffset)
    const dateStr = d.toISOString().slice(0, 10)

    // 2-3 staff per day
    const numStaff = Math.floor(Math.random() * 2) + 2
    const shuffled = [...staffMembers].sort(() => Math.random() - 0.5).slice(0, numStaff)

    for (const staff of shuffled) {
      const clockIn = new Date(d)
      clockIn.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0)
      const clockOut = dayOffset === 0 && Math.random() > 0.5 ? null : (() => {
        const co = new Date(clockIn)
        co.setHours(co.getHours() + 6 + Math.floor(Math.random() * 4))
        return co
      })()

      await prisma.staffShift.create({
        data: {
          userId: staff.userId,
          email: staff.email,
          role: staff.role,
          clockIn,
          clockOut,
          date: dateStr,
        },
      })
    }
  }

  console.log('  ✓ ~40+ staff shifts (today + 14 days)')

  // ─── 10. STUDENT NOTES ───
  const noteTexts = [
    'Very consistent student, always arrives on time.',
    'Requested quiet zone seating preference.',
    'Medical exemption — needs periodic breaks.',
    'Group study regular, usually books with 3 friends.',
    'Wants to switch to monthly plan next renewal.',
    'Phone number updated. Old number was 079-xxx-xxxx.',
    'Interested in becoming a student ambassador.',
    'Prefers morning sessions. Rarely comes after 3 PM.',
  ]

  for (let i = 0; i < 8; i++) {
    await prisma.studentNote.create({
      data: {
        studentId: students[i].id,
        content: noteTexts[i],
        authorId: admin.id,
        authorName: admin.name,
        createdAt: randomDate(10),
      },
    })
  }

  console.log('  ✓ 8 student notes')

  // ─── 11. AUDIT LOGS ───
  const auditEvents = [
    { email: admin.email,   role: 'ADMIN',                 event: 'LOGIN',          details: null },
    { email: barista.email, role: 'BARISTA',                event: 'LOGIN',          details: null },
    { email: counter.email, role: 'REGISTERATION_COUNTER',  event: 'LOGIN',          details: null },
    { email: admin.email,   role: 'ADMIN',                 event: 'LOGOUT',         details: null },
    { email: barista.email, role: 'BARISTA',                event: 'LOGIN',          details: null },
    { email: admin.email,   role: 'ADMIN',                 event: 'PASSWORD_RESET_BY_ADMIN', details: `Reset password for ${barista.email}` },
    { email: manager.email, role: 'MANAGER',                event: 'LOGIN',          details: null },
    { email: counter.email, role: 'REGISTERATION_COUNTER',  event: 'LOGOUT',         details: null },
  ]

  for (let i = 0; i < auditEvents.length; i++) {
    const ae = auditEvents[i]
    await prisma.staffAuditLog.create({
      data: {
        userId: staffMembers.find(s => s.email === ae.email)?.userId,
        email: ae.email,
        role: ae.role,
        event: ae.event,
        ip: `192.168.1.${100 + i}`,
        details: ae.details,
        createdAt: randomDate(7),
      },
    })
  }

  console.log('  ✓ 8 audit log entries')

  // ─── 12. APP SETTINGS ───
  await prisma.appSetting.createMany({
    data: [
      { key: 'maxCapacity',        value: '30' },
      { key: 'displayEnabled',     value: 'true' },
      { key: 'displayConnection',  value: 'browser' },
      { key: 'plan_Daily_price',   value: '3' },
      { key: 'plan_Daily_visits',  value: '999' },
      { key: 'plan_Daily_days',    value: '1' },
      { key: 'plan_Weekly_price',  value: '15' },
      { key: 'plan_Weekly_visits', value: '7' },
      { key: 'plan_Weekly_days',   value: '10' },
      { key: 'plan_Monthly_price', value: '50' },
      { key: 'plan_Monthly_visits',value: '30' },
      { key: 'plan_Monthly_days',  value: '40' },
    ],
  })

  console.log('  ✓ 12 app settings')

  // ─── 13. WAITLIST ───
  for (let i = 0; i < 3; i++) {
    await prisma.waitlistEntry.create({
      data: {
        studentId: students[18 + i > 19 ? 19 : 18 + i].id,
        date: today,
        position: i + 1,
        status: i === 0 ? 'ADMITTED' : 'WAITING',
      },
    })
  }

  console.log('  ✓ 3 waitlist entries\n')

  // ─── SUMMARY ───
  console.log('═══════════════════════════════════════════')
  console.log('  🐝 HIVE seed complete!')
  console.log('═══════════════════════════════════════════')
  console.log('')
  console.log('  Login credentials (all same password):')
  console.log('  ┌──────────────────────┬────────────────────────┐')
  console.log('  │ Email                │ Role                   │')
  console.log('  ├──────────────────────┼────────────────────────┤')
  console.log('  │ admin@hive.study     │ ADMIN                  │')
  console.log('  │ barista@hive.study   │ BARISTA                │')
  console.log('  │ front@hive.study     │ REGISTERATION_COUNTER  │')
  console.log('  │ manager@hive.study   │ MANAGER                │')
  console.log('  ├──────────────────────┼────────────────────────┤')
  console.log('  │ Password (all)       │ Admin@1234             │')
  console.log('  └──────────────────────┴────────────────────────┘')
  console.log('')
  console.log('  Data summary:')
  console.log('  • 20 students (7 with RFID cards)')
  console.log('  • 18 subscriptions (10 active, 4 expired, 1 frozen, 3 expiring soon)')
  console.log('  • 30 days of check-in logs + today')
  console.log('  • 30 days of transactions + today')
  console.log('  • 12 menu items (1 out of stock)')
  console.log('  • 14 days of barista orders + today')
  console.log('  • 5 promo codes (try: WELCOME10, HIVE5JD, BONUS3, SUMMER25)')
  console.log('  • Staff shifts for 15 days')
  console.log('  • Public display enabled at /display')
  console.log('')
}

// ─── Helpers ───
function randomDate(maxDaysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo))
  d.setHours(Math.floor(Math.random() * 14) + 7, Math.floor(Math.random() * 60), 0)
  return d
}

function futureDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
