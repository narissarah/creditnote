import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Checking database for credit notes...\n');

    const totalCount = await prisma.creditNote.count({
      where: { deletedAt: null }
    });

    console.log(`📊 Total credit notes (non-deleted): ${totalCount}`);

    if (totalCount > 0) {
      const creditNotes = await prisma.creditNote.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          noteNumber: true,
          shopDomain: true,
          shop: true,
          customerName: true,
          originalAmount: true,
          remainingAmount: true,
          status: true,
          createdAt: true
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      console.log('\n📝 Sample credit notes:');
      creditNotes.forEach((note, index) => {
        console.log(`\n${index + 1}. ${note.noteNumber || note.id}`);
        console.log(`   Shop: ${note.shopDomain || note.shop || 'N/A'}`);
        console.log(`   Customer: ${note.customerName || 'N/A'}`);
        console.log(`   Amount: ${note.originalAmount} (Remaining: ${note.remainingAmount})`);
        console.log(`   Status: ${note.status}`);
        console.log(`   Created: ${note.createdAt}`);
      });
    } else {
      console.log('\n⚠️ No credit notes found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
