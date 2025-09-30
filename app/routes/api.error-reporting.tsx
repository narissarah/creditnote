import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Error Reporting Endpoint for Network Error Logging (NEL)
 *
 * This endpoint receives error reports from the browser's Network Error Logging
 * and Report-To APIs configured in the app headers.
 */

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle GET requests (health check for the error reporting endpoint)
  return json({
    status: "ok",
    endpoint: "error-reporting",
    message: "Error reporting endpoint is operational",
    timestamp: new Date().toISOString()
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    console.log('[ERROR REPORTING] Received error report');

    const contentType = request.headers.get('content-type') || '';
    let errorData;

    // Parse the error report based on content type
    if (contentType.includes('application/json')) {
      errorData = await request.json();
    } else if (contentType.includes('application/reports+json')) {
      // NEL reports are sent as application/reports+json
      errorData = await request.json();
    } else {
      errorData = await request.text();
    }

    // Log the error report for monitoring
    console.log('[ERROR REPORTING] Error report received:', {
      url: request.url,
      method: request.method,
      userAgent: request.headers.get('User-Agent')?.substring(0, 100),
      origin: request.headers.get('Origin'),
      contentType,
      reportData: typeof errorData === 'string' ? errorData.substring(0, 500) : errorData,
      timestamp: new Date().toISOString()
    });

    // In production, you might want to:
    // 1. Store errors in a database
    // 2. Send to external monitoring service (Sentry, DataDog, etc.)
    // 3. Filter out known issues
    // 4. Alert on critical errors

    return json({
      status: "received",
      message: "Error report processed successfully",
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('[ERROR REPORTING] Failed to process error report:', error);

    return json({
      status: "error",
      message: "Failed to process error report",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, User-Agent",
      "Access-Control-Max-Age": "86400",
    },
  });
}