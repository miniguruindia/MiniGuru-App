const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAdminRole() {
  try {
    const admin = await prisma.user.update({
      where: { email: 'admin@miniguru.in' },
      data: { role: 'ADMIN' }
    });
    
    console.log('✅ Admin role updated!');
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminRole();
