/**
 * Script to clear all Shopify sessions from database
 * Run this before reinstalling the app to ensure clean OAuth flow
 *
 * Usage: npx tsx scripts/clear-sessions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearSessions() {
  console.log('🧹 Clearing all Shopify sessions...');

  try {
    // Count existing sessions
    const count = await prisma.session.count();
    console.log(`📊 Found ${count} existing sessions`);

    if (count === 0) {
      console.log('✅ No sessions to clear');
      return;
    }

    // Delete all sessions
    const result = await prisma.session.deleteMany({});
    console.log(`✅ Deleted ${result.count} sessions`);

    console.log('\n✅ Session cleanup complete!');
    console.log('👉 Now uninstall and reinstall the app from Shopify admin');

  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearSessions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
