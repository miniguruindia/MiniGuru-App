// Create or reset an ADMIN account. Nothing secret is stored in this file.
// Usage (from backend/, with DATABASE_URL exported):
//   ADMIN_EMAIL=second.admin@yourdomain.com ADMIN_NEW_PASSWORD='choose-a-strong-one' ADMIN_NAME='Second Admin' npx ts-node reset_admin.ts
// If the account exists its password is reset and role set to ADMIN; otherwise it is created.
import prisma from './src/utils/prismaClient';
import bcrypt from 'bcryptjs';

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_NEW_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!email || password.length < 8) {
    console.error('Set ADMIN_EMAIL and ADMIN_NEW_PASSWORD (min 8 chars) first.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const updated = await prisma.user.updateMany({
    where: { email },
    data: { passwordHash: hash, role: 'ADMIN' },
  });
  if (updated.count === 0) {
    const u = await prisma.user.create({
      data: {
        email, passwordHash: hash, name, age: 30,
        phoneNumber: 'admin_' + Date.now(),
        role: 'ADMIN', score: 0, isMentor: false,
      },
    });
    console.log('Created admin:', u.email);
  } else {
    console.log('Reset admin:', email);
  }
}

main()
  .catch((e) => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
