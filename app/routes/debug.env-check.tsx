import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[DEBUG ENV] Environment check starting...');

  try {
    const envCheck = {
      // Required Shopify vars
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? 'SET' : 'MISSING',
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? 'SET' : 'MISSING',
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL || 'MISSING',
      SCOPES: process.env.SCOPES ? 'SET' : 'MISSING',

      // Database vars
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? 'SET' : 'MISSING',
      POSTGRES_URL: process.env.POSTGRES_URL ? 'SET' : 'MISSING',
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING ? 'SET' : 'MISSING',

      // Other vars
      NODE_ENV: process.env.NODE_ENV || 'MISSING',
      SESSION_SECRET: process.env.SESSION_SECRET ? 'SET' : 'MISSING',

      // Counts
      totalEnvVars: Object.keys(process.env).length,
      timestamp: new Date().toISOString()
    };

    console.log('[DEBUG ENV] Environment status:', envCheck);

    return new Response(JSON.stringify({
      status: "ok",
      environment: envCheck,
      message: "Environment variables checked successfully"
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[DEBUG ENV] Error checking environment:', error);

    return new Response(JSON.stringify({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}