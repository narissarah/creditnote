#!/usr/bin/env node

/**
 * Deployment Verification Script for Shopify Remix App on Vercel
 * This script checks if your deployment configuration is correct
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying Shopify Remix + Vercel deployment configuration...\n');

let hasErrors = false;
const warnings = [];
const errors = [];

// Check 1: Vercel.json configuration
console.log('1. Checking vercel.json configuration...');
try {
  const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

  // Should NOT have buildCommand or outputDirectory for @vercel/remix
  if (vercelConfig.buildCommand) {
    warnings.push('vercel.json contains buildCommand - this may conflict with @vercel/remix auto-detection');
  }

  if (vercelConfig.outputDirectory) {
    warnings.push('vercel.json contains outputDirectory - this may conflict with @vercel/remix auto-detection');
  }

  // Check for static CSP headers (should be dynamic)
  const cspHeaders = vercelConfig.headers?.some(rule =>
    rule.headers?.some(header =>
      header.key === 'Content-Security-Policy' &&
      header.value.includes('frame-ancestors')
    )
  );

  if (cspHeaders) {
    warnings.push('Static CSP frame-ancestors headers detected in vercel.json - should be dynamic per shop');
  }

  console.log('   ✅ vercel.json structure is acceptable');
} catch (error) {
  errors.push('vercel.json is missing or invalid');
  hasErrors = true;
}

// Check 2: Package.json dependencies
console.log('2. Checking package.json dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  // Required dependencies
  const requiredDeps = [
    '@vercel/remix',
    '@shopify/shopify-app-remix'
  ];

  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies?.[dep]) {
      errors.push(`Missing required dependency: ${dep}`);
      hasErrors = true;
    } else {
      console.log(`   ✅ ${dep} found`);
    }
  });

  // Check vercel-build script
  if (!packageJson.scripts?.['vercel-build']) {
    warnings.push('No vercel-build script found - Vercel will use default build');
  } else {
    console.log('   ✅ vercel-build script found');
  }

} catch (error) {
  errors.push('package.json is missing or invalid');
  hasErrors = true;
}

// Check 3: Vite config
console.log('3. Checking vite.config.ts...');
try {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');

  if (!viteConfig.includes('vercelPreset')) {
    errors.push('vite.config.ts missing vercelPreset() - required for Vercel deployment');
    hasErrors = true;
  } else {
    console.log('   ✅ vercelPreset found in vite.config.ts');
  }

  if (!viteConfig.includes('@vercel/remix/vite')) {
    errors.push('vite.config.ts missing import from @vercel/remix/vite');
    hasErrors = true;
  } else {
    console.log('   ✅ @vercel/remix/vite import found');
  }

} catch (error) {
  errors.push('vite.config.ts is missing or unreadable');
  hasErrors = true;
}

// Check 4: Shopify server configuration
console.log('4. Checking app/shopify.server.ts...');
try {
  const shopifyServer = fs.readFileSync('app/shopify.server.ts', 'utf8');

  if (!shopifyServer.includes('@shopify/shopify-app-remix/adapters/vercel')) {
    errors.push('app/shopify.server.ts missing Vercel adapter import');
    hasErrors = true;
  } else {
    console.log('   ✅ Vercel adapter import found');
  }

  if (!shopifyServer.includes('unstable_newEmbeddedAuthStrategy: true')) {
    warnings.push('Consider enabling unstable_newEmbeddedAuthStrategy for better auth flow');
  } else {
    console.log('   ✅ New embedded auth strategy enabled');
  }

} catch (error) {
  errors.push('app/shopify.server.ts is missing or unreadable');
  hasErrors = true;
}

// Check 5: Environment variables
console.log('5. Checking environment configuration...');
const requiredEnvVars = [
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_APP_URL',
  'DATABASE_URL'
];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    warnings.push(`Environment variable ${envVar} not set (check your .env file or Vercel settings)`);
  } else {
    console.log(`   ✅ ${envVar} is set`);
  }
});

// Summary
console.log('\n📊 VERIFICATION SUMMARY');
console.log('=========================');

if (errors.length > 0) {
  console.log('\n❌ ERRORS (must fix):');
  errors.forEach(error => console.log(`   - ${error}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (recommend fixing):');
  warnings.forEach(warning => console.log(`   - ${warning}`));
}

if (!hasErrors && warnings.length === 0) {
  console.log('\n🎉 All checks passed! Your configuration looks good for Vercel deployment.');
} else if (!hasErrors) {
  console.log('\n✅ No critical errors found. Address warnings for optimal deployment.');
} else {
  console.log('\n🚨 Critical errors found. Please fix these before deploying.');
}

console.log('\n📋 DEPLOYMENT CHECKLIST:');
console.log('1. Run: npm run build (should succeed)');
console.log('2. Commit your changes');
console.log('3. Deploy to Vercel');
console.log('4. Update SHOPIFY_APP_URL in Shopify Partner Dashboard');
console.log('5. Test embedded app in Shopify admin');

process.exit(hasErrors ? 1 : 0);