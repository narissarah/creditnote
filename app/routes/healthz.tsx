import { json } from "@remix-run/node";

/**
 * Healthcheck endpoint for Vercel and monitoring
 * Returns 200 OK to prevent deployment failures
 */
export async function loader() {
  return json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "creditnote",
    version: "1.0.0"
  }, {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Content-Type": "application/json"
    }
  });
}

export async function options() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    }
  });
}
