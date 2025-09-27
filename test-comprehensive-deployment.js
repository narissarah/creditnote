#!/usr/bin/env node

/**
 * Comprehensive Deployment Test Suite for Shopify 2025-07 App
 * Tests all critical endpoints and authentication flows
 */

import https from 'https';
import crypto from 'crypto';

const BASE_URL = 'https://creditnote.vercel.app';
const USER_AGENT = 'CreditNote-Test-Suite/1.0';

let testResults = [];
let totalTests = 0;
let passedTests = 0;

function logTest(name, success, details = '') {
    totalTests++;
    if (success) passedTests++;

    const status = success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${name}${details ? ` - ${details}` : ''}`);

    testResults.push({
        name,
        success,
        details
    });
}

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': USER_AGENT,
                ...options.headers
            },
            timeout: 10000
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.abort();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function testHealthEndpoint() {
    try {
        const response = await makeRequest(`${BASE_URL}/api/health`);

        if (response.status === 200) {
            const health = JSON.parse(response.body);
            logTest('Health Endpoint', health.status === 'healthy', `Database: ${health.database?.connected ? 'Connected' : 'Disconnected'}`);
            return health;
        } else {
            logTest('Health Endpoint', false, `Status: ${response.status}`);
            return null;
        }
    } catch (error) {
        logTest('Health Endpoint', false, error.message);
        return null;
    }
}

async function testSessionTokenBounce() {
    try {
        const response = await makeRequest(`${BASE_URL}/session-token-bounce?shop=test.myshopify.com`);

        // Should return 200 with HTML page for session recovery
        const success = response.status === 200 && response.body.includes('App Bridge');
        logTest('Session Token Bounce Route', success, `Status: ${response.status}`);

        return success;
    } catch (error) {
        logTest('Session Token Bounce Route', false, error.message);
        return false;
    }
}

async function testAuthValidationEndpoint() {
    try {
        // Test without authentication - should return 401
        const response = await makeRequest(`${BASE_URL}/api/auth/validate`);

        const success = response.status === 401;
        logTest('Auth Validation (Unauthenticated)', success, `Status: ${response.status}`);

        return success;
    } catch (error) {
        logTest('Auth Validation (Unauthenticated)', false, error.message);
        return false;
    }
}

async function testCORSSupport() {
    try {
        const response = await makeRequest(`${BASE_URL}/api/auth/validate`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://admin.shopify.com',
                'Access-Control-Request-Method': 'POST'
            }
        });

        const success = response.status === 200 &&
                       response.headers['access-control-allow-origin'] === '*';

        logTest('CORS Support', success, `Status: ${response.status}`);

        return success;
    } catch (error) {
        logTest('CORS Support', false, error.message);
        return false;
    }
}

async function testBotDetection() {
    try {
        // Test with bot user agent
        const response = await makeRequest(`${BASE_URL}/api/auth/validate`, {
            headers: {
                'User-Agent': 'vercel-screenshot/1.0'
            }
        });

        // Bot requests should get 404, not 401
        const success = response.status === 404;
        logTest('Bot Detection', success, `Status: ${response.status} (should be 404 for bots)`);

        return success;
    } catch (error) {
        logTest('Bot Detection', false, error.message);
        return false;
    }
}

async function testStaticAssetHandling() {
    try {
        const response = await makeRequest(`${BASE_URL}/favicon.ico`);

        // Should not trigger authentication, should return 404 or proper static file
        const success = response.status === 404 || response.status === 200;
        logTest('Static Asset Handling', success, `Status: ${response.status}`);

        return success;
    } catch (error) {
        logTest('Static Asset Handling', false, error.message);
        return false;
    }
}

async function testAppRoute() {
    try {
        const response = await makeRequest(`${BASE_URL}/app`);

        // App route should either redirect to auth or return the app page
        const success = response.status === 302 || response.status === 200;
        logTest('App Root Route', success, `Status: ${response.status}`);

        return success;
    } catch (error) {
        logTest('App Root Route', false, error.message);
        return false;
    }
}

async function testWebhooksEndpoint() {
    try {
        // Test webhook endpoint with invalid signature
        const response = await makeRequest(`${BASE_URL}/api/webhooks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Topic': 'app/uninstalled',
                'X-Shopify-Hmac-Sha256': 'invalid'
            },
            body: JSON.stringify({ test: 'data' })
        });

        // Should reject invalid webhooks
        const success = response.status === 401 || response.status === 403;
        logTest('Webhooks Security', success, `Status: ${response.status}`);

        return success;
    } catch (error) {
        logTest('Webhooks Security', false, error.message);
        return false;
    }
}

async function testPOSAuthentication() {
    try {
        // Test POS authentication with invalid token
        const response = await makeRequest(`${BASE_URL}/api/auth/validate`, {
            headers: {
                'Authorization': 'Bearer invalid-token'
            }
        });

        // Should handle POS tokens properly and return 401 for invalid ones
        const success = response.status === 401;
        logTest('POS Authentication Handling', success, `Status: ${response.status}`);

        return success;
    } catch (error) {
        logTest('POS Authentication Handling', false, error.message);
        return false;
    }
}

async function testErrorHandling() {
    try {
        // Test non-existent route
        const response = await makeRequest(`${BASE_URL}/non-existent-route`);

        // Should return 404, not 500
        const success = response.status === 404;
        logTest('Error Handling (404)', success, `Status: ${response.status}`);

        return success;
    } catch (error) {
        logTest('Error Handling (404)', false, error.message);
        return false;
    }
}

async function testSecurityHeaders() {
    try {
        const response = await makeRequest(`${BASE_URL}/app`);

        // Check for proper security headers
        const hasCSP = response.headers['content-security-policy']?.includes('frame-ancestors');
        const hasXFrame = response.headers['x-frame-options'];

        const success = hasCSP || hasXFrame;
        logTest('Security Headers', success, `CSP: ${!!hasCSP}, X-Frame: ${!!hasXFrame}`);

        return success;
    } catch (error) {
        logTest('Security Headers', false, error.message);
        return false;
    }
}

async function runComprehensiveTests() {
    console.log('🚀 Running Comprehensive Deployment Tests...\n');

    // Core functionality tests
    await testHealthEndpoint();
    await testSessionTokenBounce();
    await testAuthValidationEndpoint();

    // Security and authentication tests
    await testCORSSupport();
    await testBotDetection();
    await testPOSAuthentication();
    await testWebhooksEndpoint();

    // Infrastructure tests
    await testStaticAssetHandling();
    await testAppRoute();
    await testErrorHandling();
    await testSecurityHeaders();

    // Results summary
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} passed (${Math.round(passedTests/totalTests*100)}%)`);

    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Deployment is fully functional.');
    } else {
        console.log('⚠️  Some tests failed. Review the failures above.');

        const failedTests = testResults.filter(t => !t.success);
        console.log('\n❌ Failed Tests:');
        failedTests.forEach(test => {
            console.log(`  - ${test.name}: ${test.details}`);
        });
    }

    return {
        total: totalTests,
        passed: passedTests,
        percentage: Math.round(passedTests/totalTests*100),
        results: testResults
    };
}

// Run tests if called directly
runComprehensiveTests().catch(console.error);

export { runComprehensiveTests };