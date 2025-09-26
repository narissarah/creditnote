import type { LoaderFunctionArgs } from "@remix-run/node";
import { checkDatabaseConnection } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const timestamp = new Date().toISOString();

  try {
    // Quick health check with database connectivity test
    const dbHealth = await checkDatabaseConnection();

    // Check essential environment variables
    const envCheck = {
      hasShopifyApiKey: !!process.env.SHOPIFY_API_KEY,
      hasShopifyApiSecret: !!process.env.SHOPIFY_API_SECRET,
      hasShopifyAppUrl: !!process.env.SHOPIFY_APP_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL || !!process.env.POSTGRES_URL,
      hasPostgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
    };

    const allEnvPresent = Object.values(envCheck).every(Boolean);
    const overallHealth = dbHealth.connected && allEnvPresent;

    return new Response(
      JSON.stringify({
        status: overallHealth ? "healthy" : "degraded",
        timestamp,
        environment: process.env.NODE_ENV || "unknown",
        database: {
          connected: dbHealth.connected,
          latency: dbHealth.latency,
          error: dbHealth.error
        },
        environment_variables: envCheck,
        configuration: {
          shopifyAppUrl: process.env.SHOPIFY_APP_URL,
          nodeEnv: process.env.NODE_ENV,
          hasAllRequiredEnv: allEnvPresent
        },
        deployment: {
          vercelRegion: process.env.VERCEL_REGION || "unknown",
          vercelEnv: process.env.VERCEL_ENV || "unknown",
          deploymentUrl: process.env.VERCEL_URL || "unknown"
        },
        request: {
          url: request.url,
          userAgent: request.headers.get("user-agent")?.substring(0, 100) || "unknown",
          origin: request.headers.get("origin") || "none"
        }
      }),
      {
        status: overallHealth ? 200 : 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (error) {
    console.error("[HEALTH CHECK] Error:", error);

    return new Response(
      JSON.stringify({
        status: "error",
        timestamp,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Health check failed due to internal error"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}