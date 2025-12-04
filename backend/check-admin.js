const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@miniguru.in' }
    });
    
    if (admin) {
      console.log('✅ Admin found!');
      console.log('Email:', admin.email);
      console.log('Role:', admin.role);
      console.log('Phone:', admin.phoneNumber);
    } else {
      console.log('❌ Admin not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();
