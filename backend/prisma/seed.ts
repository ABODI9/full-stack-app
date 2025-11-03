import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { makePasswordSig } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const rounds = Number(process.env.BCRYPT_COST ?? 10);
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPass  = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

  const hash = await bcrypt.hash(adminPass, rounds);
  const sig  = makePasswordSig(adminPass);

  // تأكد من وجود الأدمن بكلمة مرور مشفّرة وبصمتها
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: 'Admin', role: 'admin', password: hash, passwordSig: sig },
    create: { name: 'Admin', email: adminEmail, role: 'admin', password: hash, passwordSig: sig }
  });

  // بيانات تجريبية (اختياري)
  await prisma.record.createMany({
    data: [
      { title: 'Sales',      value: 10.5, userId: admin.id },
      { title: 'Sales',      value: 20.0, userId: admin.id },
      { title: 'Marketing',  value: 15.7, userId: admin.id },
      { title: 'Ops',        value: 30.2, userId: admin.id },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
