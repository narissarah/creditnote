import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  // Only allow in development or with special header
  const allowDebug = process.env.NODE_ENV === 'development' ||
                    request.headers.get('X-Debug-Key') === 'creditnote-debug-2025';

  if (!allowDebug) {
    return json({ error: "Debug endpoint not available in production" }, { status: 403 });
  }

  const requiredEnvVars = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'DATABASE_URL',
    'SESSION_SECRET'
  ];

  const optionalEnvVars = [
    'DATABASE_URL_UNPOOLED',
    'SCOPES'
  ];

  const envStatus = {
    required: {} as Record<string, boolean>,
    optional: {} as Record<string, boolean>,
    values: {} as Record<string, string>
  };

  // Check required variables
  requiredEnvVars.forEach(varName => {
    envStatus.required[varName] = !!process.env[varName];
    if (process.env[varName]) {
      // Show partial value for security
      const value = process.env[varName]!;
      if (varName.includes('SECRET') || varName.includes('KEY')) {
        envStatus.values[varName] = value.substring(0, 8) + '***';
      } else {
        envStatus.values[varName] = value;
      }
    }
  });

  // Check optional variables
  optionalEnvVars.forEach(varName => {
    envStatus.optional[varName] = !!process.env[varName];
    if (process.env[varName]) {
      envStatus.values[varName] = process.env[varName]!;
    }
  });

  const missingRequired = requiredEnvVars.filter(varName => !process.env[varName]);
  const isHealthy = missingRequired.length === 0;

  return json({
    status: isHealthy ? "healthy" : "error",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    envStatus,
    missingRequired,
    recommendations: isHealthy ?
      ["All required environment variables are set"] :
      [`Set missing variables in Vercel Dashboard: ${missingRequired.join(', ')}`]
  });
}
