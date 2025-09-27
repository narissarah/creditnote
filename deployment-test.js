#!/usr/bin/env node

/**
 * Deployment Test Script
 * Tests the critical endpoints and authentication flow
 */

const BASE_URL = 'https://creditnote.vercel.app';

async function testEndpoint(url, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`📍 URL: ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Deployment-Test/1.0',
        'Accept': 'application/json'
      }
    });

    console.log(`✅ Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const contentType = response.headers.get('Content-Type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        console.log(`📋 Response: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
      } else {
        const text = await response.text();
        console.log(`📄 Response length: ${text.length} characters`);
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Error: ${errorText.substring(0, 200)}...`);
    }

    return response.ok;

  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return false;
  }
}

async function runDeploymentTests() {
  console.log('🚀 Shopify App Deployment Test Suite');
  console.log('=====================================');

  const tests = [
    {
      url: `${BASE_URL}/api/health`,
      description: 'Health Check Endpoint'
    },
    {
      url: `${BASE_URL}/api/pos/diagnostics`,
      description: 'POS Diagnostics Endpoint'
    },
    {
      url: `${BASE_URL}/api/auth/validate`,
      description: 'Auth Validation Endpoint (should fail without token)'
    },
    {
      url: `${BASE_URL}/api/pos/credit-notes/list?shop=arts-kardz.myshopify.com`,
      description: 'POS Credit Notes List (with shop param)'
    },
    {
      url: `${BASE_URL}/`,
      description: 'Root Application (should redirect)'
    }
  ];

  let successCount = 0;
  for (const test of tests) {
    const success = await testEndpoint(test.url, test.description);
    if (success) successCount++;
  }

  console.log('\n📊 Test Results');
  console.log('================');
  console.log(`✅ Passed: ${successCount}/${tests.length}`);
  console.log(`❌ Failed: ${tests.length - successCount}/${tests.length}`);

  if (successCount === tests.length) {
    console.log('\n🎉 All tests passed! Deployment looks healthy.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }

  console.log('\n🔍 Next Steps:');
  console.log('1. Test in Shopify Admin: Install/access the app through Shopify Admin');
  console.log('2. Test POS Integration: Verify POS extension functionality');
  console.log('3. Monitor logs: Check Vercel logs for any runtime errors');
  console.log('4. Database connection: Verify Prisma operations work correctly');
}

// Run the tests
runDeploymentTests().catch(console.error);