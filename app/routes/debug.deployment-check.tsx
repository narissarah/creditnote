import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());

  return json({
    status: "deployment-check",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercelRegion: process.env.VERCEL_REGION,
    hasShopifyApiKey: !!process.env.SHOPIFY_API_KEY,
    hasDatabase: !!process.env.DATABASE_URL,
    hasPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
    requestUrl: url.toString(),
    requestHeaders: {
      userAgent: headers["user-agent"],
      origin: headers["origin"],
      referer: headers["referer"],
      host: headers["host"],
      xForwardedFor: headers["x-forwarded-for"],
      xVercelId: headers["x-vercel-id"]
    },
    shopifyConfig: {
      appUrl: process.env.SHOPIFY_APP_URL,
      hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
      scopes: process.env.SCOPES
    },
    vercelInfo: {
      region: process.env.VERCEL_REGION,
      env: process.env.VERCEL_ENV,
      url: process.env.VERCEL_URL
    }
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Type': 'application/json'
    }
  });
}