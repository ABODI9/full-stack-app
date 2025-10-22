import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      password: passwordHash,
      role: 'admin',
    },
  });

  await prisma.record.createMany({
    data: [
      { title: 'Sales', value: 10.5, userId: admin.id },
      { title: 'Sales', value: 20.0, userId: admin.id },
      { title: 'Marketing', value: 15.7, userId: admin.id },
      { title: 'Ops', value: 30.2, userId: admin.id },
    ],
    skipDuplicates: true,
  });

  const today = new Date();
  const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const hours = [10, 11, 12, 13, 17, 18, 19, 20];

  await prisma.order.createMany({
    data: hours.flatMap(h => ([
      {
        insertdate: new Date(base.getTime() + h * 3600 * 1000),
        ordertotal: 150.25,
        externalappname: 'Yemeksepeti',
        customerid: 101,
        lat: 41.01, lng: 28.97, userId: admin.id,
      },
      {
        insertdate: new Date(base.getTime() + h * 3600 * 1000 + 15 * 60000),
        ordertotal: 320.10,
        externalappname: 'Getir',
        customerid: 202,
        lat: 41.03, lng: 28.99, userId: admin.id,
      },
    ])),
    skipDuplicates: true
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
