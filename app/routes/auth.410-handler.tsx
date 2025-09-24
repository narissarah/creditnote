// CRITICAL FIX: Dedicated handler for 410 Gone errors in authentication
// This route provides a recovery endpoint when session tokens expire in Vercel serverless

import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { sessionStorage } from "../shopify.server";
import { recoverFromAuthError, validateSession } from "../utils/session-manager.server";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[410 HANDLER] Processing 410 Gone error recovery request');

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');
    const timestamp = url.searchParams.get('timestamp');

    if (!shop) {
      console.error('[410 HANDLER] No shop parameter provided');
      return json({
        error: 'Missing shop parameter',
        action: 'redirect_to_auth',
        redirectUrl: '/auth'
      }, { status: 400 });
    }

    console.log(`[410 HANDLER] Attempting recovery for shop: ${shop}`);

    // Try to recover the session
    const recoveredSession = await recoverFromAuthError(request, { status: 410 });

    if (recoveredSession) {
      // Validate the recovered session
      const validation = await validateSession(recoveredSession);

      if (validation.isValid) {
        console.log('[410 HANDLER] ✅ Session recovery successful, redirecting to app');

        // Redirect back to the app with the recovered session
        const returnUrl = url.searchParams.get('return_url') || '/app';
        return redirect(returnUrl);
      }
    }

    // If recovery failed, provide session refresh instructions
    console.warn('[410 HANDLER] Session recovery failed, providing refresh instructions');

    return json({
      status: 'session_expired',
      message: 'Your session has expired and could not be automatically recovered',
      shop,
      timestamp: new Date().toISOString(),
      actions: {
        refresh: `/auth?shop=${shop}`,
        install: `/auth/install?shop=${shop}`,
        support: '/help'
      },
      instructions: [
        'Your authentication session has expired',
        'This commonly happens in serverless environments after extended periods of inactivity',
        'Click "Refresh Session" below to re-authenticate with Shopify',
        'If issues persist, try reinstalling the app'
      ]
    });

  } catch (error) {
    console.error('[410 HANDLER] Recovery process failed:', error);

    return json({
      status: 'error',
      message: 'Session recovery failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      action: 'redirect_to_auth',
      redirectUrl: '/auth'
    }, { status: 500 });
  }
}

// Default component for when this route is accessed directly
export default function Error410Handler() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Session Recovery - CreditNote</title>
        <style dangerouslySetInnerHTML={{
          __html: `
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.2);
              max-width: 500px;
              text-align: center;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 16px;
            }
            p {
              color: #666;
              line-height: 1.5;
              margin-bottom: 20px;
            }
            .btn {
              background: #5865F2;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 16px;
              text-decoration: none;
              display: inline-block;
              margin: 10px;
            }
            .btn:hover {
              background: #4752C4;
            }
            .btn-secondary {
              background: #6c757d;
            }
            .btn-secondary:hover {
              background: #545b62;
            }
          `
        }} />
      </head>
      <body>
        <div className="container">
          <div className="icon">🔄</div>
          <h1>Session Recovery</h1>
          <p>
            This page helps recover from authentication session timeouts in our Shopify app.
            If you're seeing this page, it means a session token has expired.
          </p>
          <p>
            This is a technical endpoint that's typically accessed automatically by our app
            when authentication issues occur in Vercel's serverless environment.
          </p>
          <div>
            <a href="/auth" className="btn">
              Go to Authentication
            </a>
            <a href="/app" className="btn btn-secondary">
              Try App Again
            </a>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Auto-redirect if we're in an embedded context
            if (window.top !== window.self && window.location.search.includes('shop=')) {
              const params = new URLSearchParams(window.location.search);
              const shop = params.get('shop');
              if (shop) {
                console.log('[410 HANDLER] Auto-redirecting to auth for embedded context');
                window.location.href = '/auth?shop=' + shop;
              }
            }
          `
        }} />
      </body>
    </html>
  );
}