import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('[AUTH-CHECK] Testing authentication flow...');

  try {
    // Test authentication with new embedded auth strategy
    const { admin, session } = await authenticate.admin(request);

    console.log('[AUTH-CHECK] ✅ Authentication successful:', {
      shop: session.shop,
      hasAccessToken: !!session.accessToken,
      sessionId: session.id,
      isOnline: session.isOnline
    });

    return json({
      success: true,
      shop: session.shop,
      sessionId: session.id,
      authMethod: "SHOPIFY_EMBEDDED_2025",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AUTH-CHECK] ❌ Authentication failed:', error);

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown authentication error',
      timestamp: new Date().toISOString()
    }, { status: 401 });
  }
};

export default function AuthCheck() {
  const data = useLoaderData<typeof loader>();

  if (!data.success) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h2>❌ Authentication Test Failed</h2>
        <p><strong>Error:</strong> {data.error}</p>
        <p><strong>Time:</strong> {data.timestamp}</p>
        <div style={{ marginTop: '20px', padding: '15px', background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px' }}>
          <strong>Troubleshooting:</strong>
          <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
            <li>This route requires authentication to access</li>
            <li>Access it through the Shopify admin app interface</li>
            <li>If error persists, check environment variables</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
      <h2>✅ Authentication Test Successful</h2>
      <div style={{ marginTop: '20px', padding: '15px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '4px' }}>
        <p><strong>Shop:</strong> {data.shop}</p>
        <p><strong>Session ID:</strong> {data.sessionId}</p>
        <p><strong>Auth Method:</strong> {data.authMethod}</p>
        <p><strong>Test Time:</strong> {data.timestamp}</p>
      </div>
      <div style={{ marginTop: '20px' }}>
        <h3>🎯 Next Steps:</h3>
        <ol style={{ paddingLeft: '20px' }}>
          <li><strong>Main App:</strong> The "Something went wrong" error should now be resolved</li>
          <li><strong>POS Extensions:</strong> Manually activate them in POS Settings</li>
          <li><strong>Health Check:</strong> <a href="/health" target="_blank">Test /health endpoint</a></li>
        </ol>
      </div>
    </div>
  );
}
