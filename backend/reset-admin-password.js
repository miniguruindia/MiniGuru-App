const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    
    const admin = await prisma.user.update({
      where: { email: 'admin@miniguru.com' },
      data: { 
        passwordHash: passwordHash,
        role: 'ADMIN'  // Ensure role is ADMIN
      }
    });
    
    console.log('✅ Admin password reset successfully!');
    console.log('Email: admin@miniguru.com');
    console.log('Password: Admin@123');
    console.log('Role:', admin.role);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
