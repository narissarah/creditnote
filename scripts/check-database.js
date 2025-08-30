import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function checkDatabase() {
  console.log('Checking database connection and tables...\n');
  
  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Check if Session table exists
    const sessionCount = await prisma.session.count();
    console.log(`✅ Session table exists with ${sessionCount} records`);
    
    // Check if CreditNote table exists
    const creditNoteCount = await prisma.creditNote.count();
    console.log(`✅ CreditNote table exists with ${creditNoteCount} records`);
    
    // Check other tables
    const tables = [
      'CreditTransaction',
      'CustomerCache',
      'OfflineSyncQueue',
      'AuditLog',
      'ShopSettings'
    ];
    
    for (const table of tables) {
      const model = table.charAt(0).toLowerCase() + table.slice(1);
      const count = await prisma[model].count();
      console.log(`✅ ${table} table exists with ${count} records`);
    }
    
    console.log('\n✅ All tables are properly set up!');
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    
    if (error.message.includes('P2021')) {
      console.error('\n⚠️  Table does not exist in the database');
      console.error('Run: npx prisma db push');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();