#!/usr/bin/env node

/**
 * Fix Data Consistency Script
 * Synchronizes shopDomain and shop fields in CreditNote records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDataConsistency() {
  console.log('🔧 Starting data consistency fix...');

  try {
    // Step 1: Get all non-deleted records
    const allRecords = await prisma.creditNote.findMany({
      where: {
        deletedAt: null
      },
      select: {
        id: true,
        shopDomain: true,
        shop: true
      }
    });

    console.log(`📊 Found ${allRecords.length} total records to check`);

    // Step 2: Find records that need shopDomain -> shop sync
    const needShopUpdate = allRecords.filter(record =>
      record.shopDomain && !record.shop
    );

    // Step 3: Find records that need shop -> shopDomain sync
    const needShopDomainUpdate = allRecords.filter(record =>
      record.shop && !record.shopDomain
    );

    console.log(`📋 Analysis results:`);
    console.log(`   - Records needing shop field update: ${needShopUpdate.length}`);
    console.log(`   - Records needing shopDomain field update: ${needShopDomainUpdate.length}`);

    if (needShopUpdate.length === 0 && needShopDomainUpdate.length === 0) {
      console.log('✅ No records need updating - data is already consistent');
      return;
    }

    // Step 4: Update records that need shop field populated from shopDomain
    let updatedCount = 0;
    for (const record of needShopUpdate) {
      try {
        await prisma.creditNote.update({
          where: { id: record.id },
          data: { shop: record.shopDomain }
        });
        updatedCount++;
        console.log(`   ✓ Updated record ${record.id}: shop = "${record.shopDomain}"`);
      } catch (error) {
        console.error(`   ❌ Failed to update record ${record.id}:`, error.message);
      }
    }

    // Step 5: Update records that need shopDomain field populated from shop
    for (const record of needShopDomainUpdate) {
      try {
        await prisma.creditNote.update({
          where: { id: record.id },
          data: { shopDomain: record.shop }
        });
        updatedCount++;
        console.log(`   ✓ Updated record ${record.id}: shopDomain = "${record.shop}"`);
      } catch (error) {
        console.error(`   ❌ Failed to update record ${record.id}:`, error.message);
      }
    }

    console.log(`🎯 Successfully updated ${updatedCount} out of ${needShopUpdate.length + needShopDomainUpdate.length} records`);

    // Step 6: Verify consistency after update
    const finalRecords = await prisma.creditNote.findMany({
      where: {
        deletedAt: null
      },
      select: {
        shopDomain: true,
        shop: true
      }
    });

    const shopDomainCount = finalRecords.filter(r => r.shopDomain).length;
    const shopCount = finalRecords.filter(r => r.shop).length;
    const totalCount = finalRecords.length;

    console.log('📈 Post-fix statistics:');
    console.log(`   - Records with shopDomain: ${shopDomainCount}`);
    console.log(`   - Records with shop: ${shopCount}`);
    console.log(`   - Total records: ${totalCount}`);
    console.log(`   - Data consistency: ${shopDomainCount === shopCount ? 'CONSISTENT ✅' : 'STILL INCONSISTENT ❌'}`);

    console.log('✅ Data consistency fix completed successfully');

  } catch (error) {
    console.error('❌ Data consistency fix failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixDataConsistency()
  .catch((error) => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });