#!/usr/bin/env node

/**
 * Create sample credit notes for testing POS extensions
 * This ensures POS tiles show real data instead of "0 total credit"
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Sample data for testing
const sampleCredits = [
  {
    customerName: "John Smith",
    customerEmail: "john.smith@example.com",
    customerId: "gid://shopify/Customer/12345",
    amount: 25.00,
    reason: "Product return - damaged item",
    currency: "USD"
  },
  {
    customerName: "Sarah Johnson",
    customerEmail: "sarah.j@example.com",
    customerId: "gid://shopify/Customer/12346",
    amount: 50.00,
    reason: "Order cancellation refund",
    currency: "USD"
  },
  {
    customerName: "Mike Davis",
    customerEmail: "mike.davis@example.com",
    customerId: "gid://shopify/Customer/12347",
    amount: 15.75,
    reason: "Store credit promotion",
    currency: "USD"
  },
  {
    customerName: "Lisa Wilson",
    customerEmail: "lisa.wilson@example.com",
    customerId: "gid://shopify/Customer/12348",
    amount: 100.00,
    reason: "Bulk order adjustment",
    currency: "USD"
  },
  {
    customerName: "Alex Brown",
    customerEmail: "alex.brown@example.com",
    customerId: "gid://shopify/Customer/12349",
    amount: 35.50,
    reason: "Product exchange credit",
    currency: "USD"
  }
];

function generateNoteNumber() {
  return `CN-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

function generateQRCode(noteNumber, amount) {
  const data = `${noteNumber}:${amount}`;
  return crypto.createHash('sha256').update(data).digest('hex').substr(0, 16).toUpperCase();
}

async function createSampleCredits() {
  console.log('🚀 Creating sample credit notes for POS testing...');

  try {
    // Use the shop domain from the test environment
    const shopDomain = 'arts-kardz.myshopify.com';

    for (const sample of sampleCredits) {
      const noteNumber = generateNoteNumber();
      const qrCode = generateQRCode(noteNumber, sample.amount);

      const creditNote = await prisma.creditNote.create({
        data: {
          noteNumber,
          customerName: sample.customerName,
          customerEmail: sample.customerEmail,
          customerId: sample.customerId,
          originalAmount: sample.amount,
          remainingAmount: sample.amount,
          currency: sample.currency,
          status: 'active',
          reason: sample.reason,
          qrCode,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          shopDomain,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`✅ Created credit note: ${noteNumber} for ${sample.customerName} - $${sample.amount}`);
    }

    // Get total count and value
    const stats = await prisma.creditNote.aggregate({
      where: {
        shopDomain,
        status: 'active'
      },
      _count: true,
      _sum: {
        remainingAmount: true
      }
    });

    console.log('\n📊 Credit Note Statistics:');
    console.log(`   Total Active Credits: ${stats._count}`);
    console.log(`   Total Value: $${stats._sum.remainingAmount?.toFixed(2) || '0.00'}`);
    console.log(`   Shop Domain: ${shopDomain}`);

    console.log('\n✅ Sample credit notes created successfully!');
    console.log('🎯 POS extensions should now display real data instead of "0 total credit"');

  } catch (error) {
    console.error('❌ Error creating sample credits:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  createSampleCredits();
}

module.exports = { createSampleCredits };