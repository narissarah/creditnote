import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { isbot } from "isbot";
// CRITICAL FIX: Re-adding addDocumentResponseHeaders for proper Frame context
import shopify, { addDocumentResponseHeaders } from "./shopify.server";

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
      console.log('[ENTRY SERVER] ✅ Handling OPTIONS preflight for:', request.url);

      // Enhanced CORS headers for OPTIONS requests
      const optionsHeaders = new Headers();
      optionsHeaders.set("Access-Control-Allow-Origin", "*");
      optionsHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      optionsHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id, X-Shopify-Access-Token, X-Shopify-Session-Token, X-Requested-With");
      optionsHeaders.set("Access-Control-Max-Age", "86400");
      optionsHeaders.set("Access-Control-Allow-Credentials", "true");
      optionsHeaders.set("Vary", "Origin");
      optionsHeaders.set("Content-Length", "0");
      optionsHeaders.set("Cache-Control", "public, max-age=86400");

      return new Response(null, {
        status: 204, // 204 No Content is more appropriate for OPTIONS
        headers: optionsHeaders
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
    // CRITICAL FIX: Use proper Shopify document response headers for Frame context
    // This is essential for embedded app authorization and Frame context
    try {
      addDocumentResponseHeaders(request, responseHeaders);
      console.log('[ENTRY SERVER] ✅ Shopify document response headers added successfully');
    } catch (headerError) {
      console.error('[ENTRY SERVER] ❌ Failed to add Shopify headers:', headerError);

      // Fallback to manual headers if addDocumentResponseHeaders fails
      const url = new URL(request.url);
      const shop = url.searchParams.get('shop') || 'admin.shopify.com';
      const shopDomain = shop.endsWith('.myshopify.com') ? shop : `${shop}.myshopify.com`;

      responseHeaders.set('Content-Security-Policy', `frame-ancestors https://${shopDomain} https://admin.shopify.com https://*.myshopify.com;`);
      responseHeaders.set("X-Content-Type-Options", "nosniff");
      responseHeaders.set("X-Frame-Options", "ALLOWALL");

      console.log('[ENTRY SERVER] 🔄 Using fallback headers for shop:', shopDomain);
    }

    const callbackName = isbot(userAgent ?? '')
      ? "onAllReady"
      : "onShellReady";

    return new Promise((resolve, reject) => {
      let didError = false;

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
            didError = true;

            // If React context error, provide fallback HTML
            if (error instanceof Error && error.message.includes('useContext')) {
              console.error('[ENTRY SERVER] React context error detected - likely SSR bundling issue');
              resolve(
                new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CreditNote App - Loading...</title>
  <meta name="shopify-api-key" content="${process.env.SHOPIFY_API_KEY || ''}" />
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
</head>
<body>
  <div style="padding: 20px; font-family: Inter, sans-serif;">
    <h1>Loading CreditNote App...</h1>
    <p>If this message persists, please clear your browser cache and try again.</p>
  </div>
  <script>
    // Auto-reload after 2 seconds to trigger client-side hydration
    setTimeout(() => window.location.reload(), 2000);
  </script>
</body>
</html>`, {
                  status: 500,
                  headers: {
                    'Content-Type': 'text/html',
                    ...Object.fromEntries(responseHeaders.entries())
                  }
                })
              );
            } else {
              reject(error);
            }
          },
          onError(error) {
            console.error('[ENTRY SERVER] Render error:', error);
            if (!didError) {
              responseStatusCode = 500;
            }
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
