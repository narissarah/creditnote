import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticateRequest } from "../utils/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const url = new URL(request.url);

  try {
    console.log('[AUTH TEST] Starting authentication test...');

    // Collect request information
    const requestInfo = {
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      search: url.search,
      headers: Object.fromEntries(request.headers.entries()),
      shopifyParams: {
        shop: url.searchParams.get('shop'),
        host: url.searchParams.get('host'),
        embedded: url.searchParams.get('embedded'),
        session: url.searchParams.get('session'),
        id_token: url.searchParams.get('id_token'),
        state: url.searchParams.get('state'),
        code: url.searchParams.get('code')
      }
    };

    // Environment check
    const envCheck = {
      hasApiKey: !!process.env.SHOPIFY_API_KEY,
      hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
      hasAppUrl: !!process.env.SHOPIFY_APP_URL,
      appUrl: process.env.SHOPIFY_APP_URL,
      hasDatabase: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    };

    let authResult = null;
    let authError = null;

    // Test authentication if there are Shopify parameters
    if (url.searchParams.get('shop') || url.searchParams.get('host')) {
      try {
        console.log('[AUTH TEST] Attempting authentication...');
        authResult = await authenticateRequest(request);
        console.log('[AUTH TEST] Authentication successful');
      } catch (error) {
        console.error('[AUTH TEST] Authentication failed:', error);
        authError = {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: error?.constructor?.name,
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : null
        };
      }
    }

    const totalTime = Date.now() - startTime;

    return json({
      status: "auth-test-complete",
      timestamp: new Date().toISOString(),
      testDuration: totalTime,
      request: requestInfo,
      environment: envCheck,
      authentication: {
        attempted: !!(url.searchParams.get('shop') || url.searchParams.get('host')),
        successful: !!authResult,
        result: authResult ? {
          authMethod: authResult.authMethod,
          shopDomain: authResult.shopDomain,
          hasSession: !!authResult.session,
          hasAdmin: !!authResult.admin
        } : null,
        error: authError
      },
      recommendations: [
        ...(authError ? ['Authentication failed - check environment variables and Shopify configuration'] : []),
        ...(!envCheck.hasApiKey ? ['SHOPIFY_API_KEY is missing'] : []),
        ...(!envCheck.hasApiSecret ? ['SHOPIFY_API_SECRET is missing'] : []),
        ...(!envCheck.hasAppUrl ? ['SHOPIFY_APP_URL is missing'] : []),
        ...(!envCheck.hasDatabase ? ['DATABASE_URL is missing'] : [])
      ]
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;

    console.error('[AUTH TEST] Critical error during test:', error);

    return json({
      status: "auth-test-failed",
      timestamp: new Date().toISOString(),
      testDuration: totalTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
}

export default function AuthTest() {
  return (
    <div style={{
      fontFamily: 'Monaco, Consolas, monospace',
      padding: '20px',
      backgroundColor: '#1a1a1a',
      color: '#00ff00',
      minHeight: '100vh'
    }}>
      <h1>🔐 Authentication Test</h1>
      <p>This endpoint tests Shopify embedded app authentication.</p>
      <p>Access the JSON data at: <code>/debug/auth-test</code></p>

      <div style={{ marginTop: '30px' }}>
        <h2>Test with Shopify Parameters:</h2>
        <ul>
          <li><a href="/debug/auth-test?shop=test.myshopify.com" style={{color: '#00ff00'}}>Test with Shop Parameter</a></li>
          <li><a href="/debug/auth-test?host=dGVzdC5teXNob3BpZnkuY29t" style={{color: '#00ff00'}}>Test with Host Parameter</a></li>
          <li><a href="/debug/auth-test" style={{color: '#00ff00'}}>Test without Parameters</a></li>
        </ul>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>Other Debug Routes:</h2>
        <ul>
          <li><a href="/health/deployment" style={{color: '#00ff00'}}>Deployment Health</a></li>
          <li><a href="/debug/deployment-check" style={{color: '#00ff00'}}>Deployment Check</a></li>
          <li><a href="/health" style={{color: '#00ff00'}}>Basic Health</a></li>
        </ul>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '5px' }}>
        <h3>🧪 Authentication Test Status</h3>
        <p>✅ Route accessible - auth test endpoint working</p>
        <p>🔍 Use JSON endpoint for detailed authentication diagnostics</p>
        <p>⚡ Tests embedded authentication with retry logic</p>
      </div>
    </div>
  );
}