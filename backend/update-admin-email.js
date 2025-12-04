const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateAdmin() {
  try {
    // Check if old email exists
    const oldAdmin = await prisma.user.findUnique({
      where: { email: 'admin@miniguru.com' }
    });
    
    if (oldAdmin) {
      // Update to new email with domain miniguru.in
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      
      const admin = await prisma.user.update({
        where: { email: 'admin@miniguru.com' },
        data: { 
          email: 'admin@miniguru.in',
          passwordHash: passwordHash,
          role: 'ADMIN'
        }
      });
      
      console.log('✅ Admin email updated successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 Email: admin@miniguru.in');
      console.log('🔑 Password: Admin@123');
      console.log('👤 Role:', admin.role);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.log('Old admin not found, checking for new email...');
      const newAdmin = await prisma.user.findUnique({
        where: { email: 'admin@miniguru.in' }
      });
      
      if (newAdmin) {
        console.log('✅ Admin with miniguru.in already exists!');
        console.log('📧 Email: admin@miniguru.in');
        console.log('🔑 Password: Admin@123');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdmin();
