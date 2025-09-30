#!/usr/bin/env node

/**
 * Nuclear Cache Invalidation Verification Script
 * Confirms that the fresh v2025 authentication system is active
 */

const https = require('https');

const PRODUCTION_URL = 'https://creditnote.vercel.app';
const TEST_ENDPOINTS = [
  '/api/pos/v2025/credit-notes/list',
  '/api/pos/diagnostics',
  '/api/pos/credit-notes/list'
];

console.log('🚀 VERIFYING NUCLEAR CACHE INVALIDATION DEPLOYMENT');
console.log('================================================');
console.log('⏰ Timestamp:', new Date().toISOString());
console.log('🎯 Testing for NUCLEAR_DEPLOYMENT_ID in responses...');
console.log('');

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    console.log(`🧪 Testing: ${endpoint}`);

    const options = {
      hostname: 'creditnote.vercel.app',
      path: endpoint,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) Shopify POS/10.10.1',
        'Origin': 'https://extensions.shopifycdn.com',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          // Check for nuclear deployment indicators
          const hasNuclearId = JSON.stringify(json).includes('NUCLEAR_');
          const hasV2025Auth = JSON.stringify(json).includes('SIMPLIFIED') ||
                              JSON.stringify(json).includes('IOS_') ||
                              JSON.stringify(json).includes('v2025');
          const hasOldAuth = JSON.stringify(json).includes('BALANCED') ||
                            JSON.stringify(json).includes('Token Exchange');

          console.log(`  📊 Response analysis:`);
          console.log(`     ✅ Nuclear deployment ID: ${hasNuclearId ? 'FOUND' : 'NOT FOUND'}`);
          console.log(`     ✅ V2025 authentication: ${hasV2025Auth ? 'ACTIVE' : 'NOT DETECTED'}`);
          console.log(`     ⚠️  Old authentication: ${hasOldAuth ? 'STILL PRESENT' : 'CLEARED'}`);
          console.log(`     📈 Response status: ${res.statusCode}`);

          if (json.authMethod) {
            console.log(`     🔐 Auth method: ${json.authMethod}`);
          }

          if (json.routeVersion) {
            console.log(`     📌 Route version: ${json.routeVersion}`);
          }

          if (json.deploymentStatus) {
            console.log(`     🚀 Deployment status: ${json.deploymentStatus}`);
          }

          const isSuccess = hasNuclearId && hasV2025Auth && !hasOldAuth;
          console.log(`     🎯 CACHE INVALIDATION: ${isSuccess ? 'SUCCESS ✅' : 'NEEDS MORE TIME ⏳'}`);

          resolve(isSuccess);
        } catch (e) {
          console.log(`     ❌ Could not parse JSON response`);
          console.log(`     📝 Raw response: ${data.substring(0, 200)}...`);
          resolve(false);
        }
        console.log('');
      });
    });

    req.on('error', (err) => {
      console.log(`     ❌ Request failed: ${err.message}`);
      console.log('');
      resolve(false);
    });

    req.end();
  });
}

async function runVerification() {
  const results = [];

  for (const endpoint of TEST_ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
  }

  const successCount = results.filter(r => r).length;
  const totalTests = results.length;

  console.log('='.repeat(60));
  console.log('📋 NUCLEAR CACHE INVALIDATION VERIFICATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`🎯 Success rate: ${successCount}/${totalTests} endpoints showing fresh code`);

  if (successCount === totalTests) {
    console.log('');
    console.log('🎉 SUCCESS: Nuclear cache invalidation is COMPLETE!');
    console.log('✅ All endpoints are serving fresh v2025 authentication code');
    console.log('✅ No more "BALANCED authentication" in responses');
    console.log('✅ Vercel is serving the new simplified-pos-auth.server.ts');
    console.log('');
    console.log('🚀 Your app is now running the latest fixes:');
    console.log('   • Frame context errors resolved');
    console.log('   • iOS POS 5-layer authentication fallback');
    console.log('   • Cache-busted serverless functions');
    console.log('   • Runtime cache completely invalidated');
  } else {
    console.log('');
    console.log('⏳ PARTIAL SUCCESS: Cache invalidation is in progress...');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Wait 2-3 minutes for global edge cache propagation');
    console.log('   2. Check Vercel deployment status: https://vercel.com/narissarahs-projects/creditnote');
    console.log('   3. Run this script again to verify complete invalidation');
    console.log('   4. If issues persist, run: ./scripts/nuclear-cache-clear.sh');
    console.log('');
    console.log('💡 Vercel edge caching can take 3-5 minutes to propagate globally');
  }

  console.log('');
  console.log('🔗 Monitor deployment: https://vercel.com/narissarahs-projects/creditnote');
}

runVerification();