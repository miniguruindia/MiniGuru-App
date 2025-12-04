const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔄 Creating admin user...');
    
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@miniguru.com' }
    });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('Email: admin@miniguru.com');
      console.log('You may need to reset the password or use a different email.');
      return;
    }
    
    // Hash the password
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    
    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@miniguru.com',
        passwordHash: passwordHash,
        name: 'Admin User',
        age: 30,
        phoneNumber: '9876543210',
        role: 'ADMIN'
      }
    });
    
    // Create wallet for admin
    const wallet = await prisma.wallet.create({
      data: {
        balance: 0.0,
        userId: admin.id
      }
    });
    
    // Update user with wallet ID
    await prisma.user.update({
      where: { id: admin.id },
      data: { walletId: wallet.id }
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email: admin@miniguru.com');
    console.log('🔑 Password: Admin@123');
    console.log('👤 Role:', admin.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nYou can now login at:');
    console.log('https://studious-acorn-x5gxwwvjx6xv26975-3000.app.github.dev/login');
    
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    if (error.code === 'P2002') {
      console.log('\n⚠️  This email or phone number is already in use.');
      console.log('Try a different email or phone number.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
