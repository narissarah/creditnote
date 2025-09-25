import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[DEBUG MINIMAL] Request received:', request.url);

  try {
    return new Response(JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      message: "Minimal debug endpoint - completely isolated"
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[DEBUG MINIMAL] Error:', error);
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