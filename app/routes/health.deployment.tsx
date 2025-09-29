import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { checkDatabaseConnection } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  try {
    console.log('[HEALTH DEPLOYMENT] Comprehensive deployment health check initiated...');

    const url = new URL(request.url);
    const headers = Object.fromEntries(request.headers.entries());

    // Database health check
    const dbHealth = await checkDatabaseConnection();

    // Environment variable analysis
    const envAnalysis = {
      // Shopify Configuration
      shopifyApiKey: !!process.env.SHOPIFY_API_KEY ? 'SET' : 'MISSING',
      shopifyApiKeyLength: process.env.SHOPIFY_API_KEY?.length || 0,
      shopifyApiSecret: !!process.env.SHOPIFY_API_SECRET ? 'SET' : 'MISSING',
      shopifyAppUrl: process.env.SHOPIFY_APP_URL || 'MISSING',
      scopes: process.env.SCOPES || 'MISSING',

      // Database Configuration
      databaseUrl: !!process.env.DATABASE_URL ? 'SET' : 'MISSING',
      postgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL ? 'SET' : 'MISSING',
      postgresUrlNonPooling: !!process.env.POSTGRES_URL_NON_POOLING ? 'SET' : 'MISSING',

      // Runtime Configuration
      nodeEnv: process.env.NODE_ENV,
      sessionSecret: !!process.env.SESSION_SECRET ? 'SET' : 'MISSING',

      // Vercel Specific
      vercelEnv: process.env.VERCEL_ENV,
      vercelRegion: process.env.VERCEL_REGION,
      vercelUrl: process.env.VERCEL_URL,
    };

    // Request analysis
    const requestAnalysis = {
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      search: url.search,
      headers: {
        userAgent: headers["user-agent"],
        origin: headers["origin"],
        referer: headers["referer"],
        host: headers["host"],
        xForwardedFor: headers["x-forwarded-for"],
        xVercelId: headers["x-vercel-id"],
        shopifyShopDomain: headers["x-shopify-shop-domain"],
        shopifyAccessToken: !!headers["x-shopify-access-token"],
        authorization: !!headers["authorization"]
      },
      shopifyParams: {
        shop: url.searchParams.get('shop'),
        host: url.searchParams.get('host'),
        embedded: url.searchParams.get('embedded'),
        session: url.searchParams.get('session'),
        id_token: url.searchParams.get('id_token')
      }
    };

    // Runtime diagnostics
    const runtime = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid
    };

    const totalTime = Date.now() - startTime;

    const healthData = {
      status: "operational",
      timestamp: new Date().toISOString(),
      deployment: {
        platform: 'vercel',
        framework: 'remix',
        region: process.env.VERCEL_REGION || 'unknown',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
      },
      environment: envAnalysis,
      database: {
        health: dbHealth,
        connectionType: process.env.POSTGRES_PRISMA_URL ? 'pooled' : 'direct'
      },
      runtime,
      request: requestAnalysis,
      performance: {
        healthCheckTime: totalTime,
        databaseLatency: dbHealth.latency
      },
      authentication: {
        strategy: "stable_embedded_auth",
        useOnlineTokens: false,
        isEmbeddedApp: true,
        apiVersion: "2025-07"
      },
      recommendations: []
    };

    // Add recommendations based on analysis
    if (!dbHealth.connected) {
      healthData.recommendations.push('Database connection failed - check connection string and network connectivity');
    }

    if (!process.env.SHOPIFY_API_KEY) {
      healthData.recommendations.push('SHOPIFY_API_KEY environment variable is missing');
    }

    if (envAnalysis.shopifyApiKeyLength !== 32) {
      healthData.recommendations.push('Shopify API Key should be 32 characters long');
    }

    if (!process.env.SHOPIFY_APP_URL) {
      healthData.recommendations.push('SHOPIFY_APP_URL environment variable is missing');
    }

    console.log('[HEALTH DEPLOYMENT] ✅ Health check completed successfully in', totalTime, 'ms');

    return json(healthData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
        'X-Health-Check': 'deployment'
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    console.error('[HEALTH DEPLOYMENT] ❌ Health check failed:', error);

    return json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown health check error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      performance: {
        healthCheckTime: totalTime
      },
      deployment: {
        platform: 'vercel',
        framework: 'remix',
        region: process.env.VERCEL_REGION || 'unknown'
      }
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'deployment'
      }
    });
  }
}

export default function HealthDeployment() {
  return (
    <div style={{
      fontFamily: 'Monaco, Consolas, monospace',
      padding: '20px',
      backgroundColor: '#1a1a1a',
      color: '#00ff00',
      minHeight: '100vh'
    }}>
      <h1>🏥 Deployment Health Check</h1>
      <p>This endpoint provides comprehensive deployment health diagnostics.</p>
      <p>Access the JSON data at: <code>/health/deployment</code></p>

      <div style={{ marginTop: '30px' }}>
        <h2>Quick Health Links:</h2>
        <ul>
          <li><a href="/health" style={{color: '#00ff00'}}>Basic Health Check</a></li>
          <li><a href="/debug/deployment-check" style={{color: '#00ff00'}}>Deployment Debug</a></li>
          <li><a href="/health/deployment" style={{color: '#00ff00'}}>Full Health Report (JSON)</a></li>
        </ul>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '5px' }}>
        <h3>🚀 Deployment Status</h3>
        <p>✅ Route accessible - serverless function is working</p>
        <p>✅ Health endpoint responding</p>
        <p>✅ Environment variables loading</p>
        <p>🔍 Full diagnostics available via JSON endpoint</p>
      </div>
    </div>
  );
}