import { json, LoaderFunctionArgs } from "@remix-run/node";

/**
 * Diagnostic route to check authentication environment variables
 * This will help identify missing or incorrect configuration
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const envCheck = {
    SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
    SHOPIFY_APP_URL: !!process.env.SHOPIFY_APP_URL,
    SHOPIFY_API_KEY_length: process.env.SHOPIFY_API_KEY?.length || 0,
    SHOPIFY_API_SECRET_length: process.env.SHOPIFY_API_SECRET?.length || 0,
    DATABASE_URL: !!process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SCOPES: process.env.SCOPES,
    HOST: process.env.HOST
  };

  console.log('[AUTH DEBUG] Environment check:', envCheck);

  return json({
    envCheck,
    timestamp: new Date().toISOString(),
    message: "Environment variables diagnostic"
  });
}

export default function AuthDebug() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Authentication Debug</h1>
      <p>Check the server console for environment variable details.</p>
      <p>This route checks for required Shopify authentication environment variables.</p>
    </div>
  );
}