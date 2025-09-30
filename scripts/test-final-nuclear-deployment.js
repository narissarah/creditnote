#!/usr/bin/env node

/**
 * Final Nuclear Deployment Test
 * Tests if Vercel Edge Runtime restart successfully cleared all caches
 */

const https = require('https');

const PRODUCTION_URL = 'https://creditnote.vercel.app';

console.log('🎯 TESTING FINAL NUCLEAR CACHE CLEARED DEPLOYMENT');
console.log('=================================================');
console.log('Target:', PRODUCTION_URL);
console.log('Timestamp:', new Date().toISOString());
console.log('');

async function testNuclearDeployment() {
  console.log('📱 Testing iOS POS Authentication - Final Nuclear Clear:');

  const testRequest = (endpoint) => {
    return new Promise((resolve) => {
      const url = PRODUCTION_URL + endpoint;
      console.log(`\nTesting: ${endpoint}`);

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

            // Check for nuclear deployment indicators
            if (json.nuclearDeploymentId) {
              console.log(`  ✅ Nuclear Deployment ID: ${json.nuclearDeploymentId}`);
            }

            if (json.cacheStatus) {
              console.log(`  ✅ Cache Status: ${json.cacheStatus}`);
            }

            if (json.routeIdentifier) {
              console.log(`  ✅ Route Identifier: ${json.routeIdentifier}`);
            }

            if (json.authMethod) {
              console.log(`  ✅ Auth Method: ${json.authMethod}`);
              if (json.authMethod.startsWith('IOS_')) {
                console.log('  🎉 iOS FALLBACK AUTHENTICATION WORKING!');
              }
            }

            // Check for old cached responses
            if (JSON.stringify(json).includes('BALANCED')) {
              console.log('  ❌ Old "BALANCED" authentication still present');
              console.log('  ⚠️  Cache may still be active - wait 2-3 minutes');
            } else {
              console.log('  ✅ No old authentication patterns detected');
            }

            // Check for diagnostics (old system indicator)
            if (json.diagnostics && !json.routeIdentifier) {
              console.log('  ⚠️  Old diagnostics system still responding');
            } else if (json.routeIdentifier) {
              console.log('  ✅ New authentication system confirmed');
            }

            resolve(true);
          } catch (e) {
            console.log(`  ❌ JSON parsing error: ${e.message}`);
            console.log(`  Response: ${data.substring(0, 200)}...`);
            resolve(false);
          }
        });
      }).on('error', (err) => {
        console.log(`  ❌ Request failed: ${err.message}`);
        resolve(false);
      });
    });
  };

  // Test main endpoints
  await testRequest('/api/pos/credit-notes/list');
  await testRequest('/api/pos/diagnostics');

  console.log('\n=================================================');
  console.log('🔍 NUCLEAR DEPLOYMENT VERIFICATION COMPLETE');
  console.log('');
  console.log('Expected indicators of successful cache clear:');
  console.log('✅ Nuclear Deployment ID: NUCLEAR_20250930_FINAL');
  console.log('✅ Cache Status: VERCEL_EDGE_RESTARTED');
  console.log('✅ Auth Method: IOS_* (for iOS requests)');
  console.log('✅ Route Identifier: 🎯 SIMPLIFIED_POS_AUTH_2025 🎯');
  console.log('✅ No "BALANCED" authentication references');
  console.log('');
  console.log('If old responses persist:');
  console.log('1. Wait 5-10 minutes for complete edge propagation');
  console.log('2. Clear browser/POS app cache');
  console.log('3. Test in incognito mode');
  console.log('4. Run this script again');
}

testNuclearDeployment();