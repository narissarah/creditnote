import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { isbot } from "isbot";
// CRITICAL FIX: Removed addDocumentResponseHeaders import to avoid ESM issues
// Manual headers are set below to replace this functionality

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  try {
    // CRITICAL FIX: Handle OPTIONS requests at server level before Remix routing
    // This prevents "Invalid request method OPTIONS" errors
    if (request.method === "OPTIONS") {
      console.log('[ENTRY SERVER] Handling OPTIONS request for:', request.url);
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id, X-Shopify-Access-Token",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
          "Content-Length": "0"
        }
      });
    }

    // CRITICAL FIX: Handle Vercel bot requests at server level
    // Additional protection to prevent bots from reaching Remix routing
    const userAgent = request.headers.get("user-agent") || '';
    const isVercelBot = userAgent.includes('vercel-favicon') ||
                       userAgent.includes('vercel-screenshot') ||
                       userAgent.includes('vercel-og-image') ||
                       userAgent.includes('vercel-bot') ||
                       userAgent.startsWith('vercel-');

    if (isVercelBot) {
      console.log('[ENTRY SERVER] 🤖 Vercel bot detected at server level:', userAgent);
      return new Response(`<!DOCTYPE html>
<html>
<head>
  <title>CreditNote</title>
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  <h1>CreditNote App</h1>
  <p>Shopify embedded app for credit note management.</p>
</body>
</html>`, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600',
          'X-Bot-Detected': 'server-level',
          'X-User-Agent': userAgent.slice(0, 50)
        }
      });
    }
    // CRITICAL FIX: Set essential headers manually to avoid ESM/CommonJS issues
    // Replaces problematic addDocumentResponseHeaders call
    responseHeaders.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com;');
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("X-Frame-Options", "ALLOWALL");

    const userAgent = request.headers.get("user-agent");
    const callbackName = isbot(userAgent ?? '')
      ? "onAllReady"
      : "onShellReady";

    return new Promise((resolve, reject) => {
      const { pipe, abort } = renderToPipeableStream(
        <RemixServer
          context={remixContext}
          url={request.url}
        />,
        {
          [callbackName]: () => {
            const body = new PassThrough();
            const stream = createReadableStreamFromReadable(body);

            responseHeaders.set("Content-Type", "text/html");
            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: responseStatusCode,
              })
            );
            pipe(body);
          },
          onShellError(error) {
            console.error('[ENTRY SERVER] Shell error:', error);
            reject(error);
          },
          onError(error) {
            console.error('[ENTRY SERVER] Render error:', error);
            responseStatusCode = 500;
          },
        }
      );

      // Reduce timeout to prevent serverless function timeout
      setTimeout(abort, 4000);
    });
  } catch (error) {
    console.error('[ENTRY SERVER] Critical error:', error);
    throw error;
  }
}
