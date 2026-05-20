import prisma from './src/utils/prismaClient';
import bcrypt from 'bcryptjs';

async function main() {
  const hash = await bcrypt.hash('Nisarg@311', 10);
  const updated = await prisma.user.updateMany({
    where: { email: 'admin@miniguru.in' },
    data: { passwordHash: hash, role: 'ADMIN' }
  });
  if (updated.count === 0) {
    console.log('Not found — creating admin...');
    const u = await prisma.user.create({
      data: {
        email: 'admin@miniguru.in',
        passwordHash: hash,
        name: 'Admin',
        age: 30,
        phoneNumber: '9399999999',
        role: 'ADMIN',
        score: 0,
        isMentor: false,
      }
    });
    console.log('Created:', u.id);
  } else {
    console.log('Updated count:', updated.count);
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
