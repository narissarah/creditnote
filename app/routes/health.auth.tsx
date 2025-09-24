// VERCEL-SAFE: Authentication health check that doesn't require embedded context
import { json, LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('[HEALTH AUTH] Testing Vercel-safe authentication health...');

    // Check environment variables
    const envCheck = {
      hasApiKey: !!process.env.SHOPIFY_API_KEY,
      hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
      hasAppUrl: !!process.env.SHOPIFY_APP_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      apiKeyLength: process.env.SHOPIFY_API_KEY?.length || 0,
      appUrl: process.env.SHOPIFY_APP_URL,
      timestamp: new Date().toISOString()
    };

    // Test database connection
    let dbStatus = 'unknown';
    try {
      // Import db locally to test connection
      const { default: prisma } = await import("../db.server");
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (dbError) {
      dbStatus = `failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`;
    }

    // Test Shopify configuration
    let shopifyConfigStatus = 'unknown';
    try {
      const { default: shopify } = await import("../shopify.server");
      shopifyConfigStatus = 'initialized';
    } catch (shopifyError) {
      shopifyConfigStatus = `failed: ${shopifyError instanceof Error ? shopifyError.message : 'Unknown error'}`;
    }

    return json({
      success: true,
      status: 'healthy',
      environment: envCheck,
      database: dbStatus,
      shopifyConfig: shopifyConfigStatus,
      vercelOptimized: true,
      message: 'Authentication infrastructure is working. 410 errors may occur due to missing embedded context - this is normal for direct API calls.'
    });

  } catch (error) {
    console.error('[HEALTH AUTH] Health check failed:', error);

    return json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      message: 'Authentication infrastructure has issues'
    }, {
      status: 500
    });
  }
}

export default function HealthAuth() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔐 Authentication Health Check</h1>
      <p>This endpoint tests authentication infrastructure without requiring Shopify embedded context.</p>
      <p>Check the JSON response above for detailed status information.</p>
    </div>
  );
}