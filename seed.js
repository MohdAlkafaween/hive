const { PrismaClient } = require('./src/generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

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
