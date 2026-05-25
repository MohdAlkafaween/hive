import { PrismaClient } from './src/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbUrl = path.join(process.cwd(), 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash('uni.study@2000.house', 10);
  const user = await prisma.user.upsert({
    where: { email: 'Hive.study@admin.jordan' },
    update: {
      password: passwordHash,
      role: 'ADMIN',
    },
    create: {
      email: 'Hive.study@admin.jordan',
      password: passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('Seeded admin:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
