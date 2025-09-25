import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('[HEALTH] Testing database connectivity...');

    // Test database connectivity with simple query
    const result = await db.$queryRaw`SELECT 1 as test`;
    console.log('[HEALTH] Database test result:', result);

    // Count total credit notes (not shop-specific for health check)
    const creditCount = await db.creditNote.count();
    console.log('[HEALTH] Credit note count:', creditCount);

    return json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: "connected",
      creditNotes: creditCount,
      appUrl: process.env.SHOPIFY_APP_URL,
      posExtensions: {
        redeem: "active",
        manage: "active",
        create: "active"
      }
    });
  } catch (error) {
    console.error('[HEALTH] Health check failed:', error);
    return json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      database: "disconnected"
    }, { status: 500 });
  }
}
