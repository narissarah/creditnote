import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import db, { checkDatabaseConnection } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  try {
    console.log('[HEALTH] Comprehensive serverless health check initiated...');

    // ENHANCED: Use the new database health check function
    const dbHealth = await checkDatabaseConnection();
    console.log('[HEALTH] Database health:', dbHealth);

    let creditCount = 0;
    let dbStatus = "connected";

    if (dbHealth.connected) {
      try {
        // Count total credit notes (not shop-specific for health check)
        creditCount = await db.creditNote.count();
        console.log('[HEALTH] Credit note count:', creditCount);
      } catch (countError) {
        console.warn('[HEALTH] Could not count credit notes:', countError);
        dbStatus = "connected-limited";
      }
    } else {
      dbStatus = "disconnected";
    }

    const totalTime = Date.now() - startTime;

    const healthData = {
      status: dbHealth.connected ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: dbStatus,
      databaseLatency: dbHealth.latency,
      totalResponseTime: totalTime,
      creditNotes: creditCount,
      appUrl: process.env.SHOPIFY_APP_URL,
      posExtensions: {
        redeem: "active",
        manage: "active",
        create: "active"
      },
      serverless: {
        platform: "vercel",
        region: process.env.VERCEL_REGION || "unknown",
        memory: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || "unknown"
      },
      version: {
        node: process.version,
        shopifyApiVersion: "2025-07"
      }
    };

    if (dbHealth.error) {
      healthData.databaseError = dbHealth.error;
    }

    console.log('[HEALTH] ✅ Health check completed in', totalTime, 'ms');

    return json(healthData, {
      status: dbHealth.connected ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'true'
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    console.error('[HEALTH] ❌ Critical health check failure:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.split('\n')[0] : 'No stack',
      totalTime
    });

    return json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown critical error",
      timestamp: new Date().toISOString(),
      database: "error",
      totalResponseTime: totalTime,
      serverless: {
        platform: "vercel",
        region: process.env.VERCEL_REGION || "unknown"
      }
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'true'
      }
    });
  }
}
