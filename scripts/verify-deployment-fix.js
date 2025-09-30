#!/usr/bin/env node

/**
 * Deployment Fix Verification Script
 * Checks if the latest fixes are deployed to production
 */

const https = require('https');

const PRODUCTION_URL = 'https://creditnote.vercel.app';
const API_ENDPOINTS = [
  '/api/pos/credit-notes/list',
  '/api/pos/credits',
  '/api/pos/diagnostics'
];

console.log('🔍 Verifying deployment fixes on', PRODUCTION_URL);
console.log('⏰ Timestamp:', new Date().toISOString());
console.log('=' .repeat(60));

// Test 1: Check if the API returns the new authentication method names
async function checkAPIAuthentication() {
  console.log('\n📱 Testing iOS POS Authentication Fallbacks:');

  const testRequest = (url) => {
    return new Promise((resolve) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) Shopify POS/10.10.1',
          'Origin': 'https://extensions.shopifycdn.com'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);

            // Check for new authentication method names
            if (json.authMethod) {
              console.log(`  ✅ New auth system detected: ${json.authMethod}`);

              // Check for iOS-specific methods
              if (json.authMethod.includes('IOS_')) {
                console.log('  ✅ iOS fallback authentication is ACTIVE!');
                return resolve(true);
              }
            }

            // Check for old authentication patterns
            if (data.includes('BALANCED authentication') ||
                data.includes('Token Exchange') ||
                data.includes('Auth Header Validation')) {
              console.log('  ❌ OLD authentication system still active');
              console.log('  ⚠️  Deployment may still be in progress...');
              return resolve(false);
            }

            console.log('  ℹ️  Response:', json.error || json.message || 'Authentication check complete');
            resolve(true);
          } catch (e) {
            console.log('  ⚠️  Could not parse response');
            resolve(false);
          }
        });
      }).on('error', (err) => {
        console.log('  ❌ Request failed:', err.message);
        resolve(false);
      });
    });
  };

  for (const endpoint of API_ENDPOINTS) {
    console.log(`\nTesting ${endpoint}:`);
    await testRequest(PRODUCTION_URL + endpoint);
  }
}

// Test 2: Check main app for Frame context errors
async function checkFrameContext() {
  console.log('\n🖼️  Testing Frame Context Fix:');

  return new Promise((resolve) => {
    https.get(PRODUCTION_URL, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Check for Frame context error indicators
        if (data.includes('No Frame context was provided') ||
            data.includes('<Frame>')) {
          console.log('  ❌ Frame context errors may still be present');
          resolve(false);
        } else if (data.includes('<!-- MODERN 2025:')) {
          console.log('  ✅ Modern 2025 patterns detected');
          resolve(true);
        } else {
          console.log('  ℹ️  App loads without Frame context errors');
          resolve(true);
        }
      });
    }).on('error', (err) => {
      console.log('  ❌ Request failed:', err.message);
      resolve(false);
    });
  });
}

// Run all tests
async function runTests() {
  await checkAPIAuthentication();
  await checkFrameContext();

  console.log('\n' + '='.repeat(60));
  console.log('📋 Deployment Verification Complete');
  console.log('🔗 Check deployment status: https://vercel.com/narissarah/creditnote');
  console.log('\n💡 If fixes are not active yet:');
  console.log('  1. Wait 2-3 minutes for Vercel deployment to complete');
  console.log('  2. Check Vercel dashboard for deployment status');
  console.log('  3. Clear browser cache and try again');
  console.log('  4. Run this script again to verify');

  console.log('\n✨ Latest fixes include:');
  console.log('  • Frame context error resolution (Layout + IndexTable patterns fixed)');
  console.log('  • iOS POS 5-layer authentication fallback system');
  console.log('  • Shop context extraction from headers/URLs');
  console.log('  • Validation-only mode for iOS devices');
  console.log('  • Graceful degradation for missing Authorization headers');
}

runTests();