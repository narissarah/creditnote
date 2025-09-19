// Clear corrupted sessions from database
import { PrismaClient } from '@prisma/client';

async function clearSessions() {
  const prisma = new PrismaClient();

  try {
    console.log('🧹 Clearing corrupted sessions...');

    // Delete all sessions to force re-authentication
    const result = await prisma.session.deleteMany({});
    console.log(`✅ Cleared ${result.count} sessions`);

    console.log('🔄 Sessions cleared. Restart app to force fresh authentication.');

  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearSessions();