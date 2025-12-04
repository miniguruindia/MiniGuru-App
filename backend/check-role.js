const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRole() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@miniguru.in' }
    });
    
    console.log('User:', user.email);
    console.log('Role:', user.role);
    console.log('ID:', user.id);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRole();
