import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const requiredEnvVars = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'DATABASE_URL',
    'SESSION_SECRET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  return json({
    status: missingVars.length === 0 ? "healthy" : "error",
    missingEnvironmentVariables: missingVars,
    environment: process.env.NODE_ENV,
    appUrl: process.env.SHOPIFY_APP_URL,
    hasApiKey: !!process.env.SHOPIFY_API_KEY,
    hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
    hasDatabase: !!process.env.DATABASE_URL,
    hasSessionSecret: !!process.env.SESSION_SECRET,
    timestamp: new Date().toISOString()
  });
}
