import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { verifyPOSSessionToken } from "../utils/pos-auth.server";

/**
 * Advanced permission diagnostic tool for troubleshooting POS user access issues
 * This route specifically checks for common permission problems that cause "0 credits"
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const testMode = url.searchParams.get("test") || "pos";

  console.log('[PERMISSION DIAGNOSTIC] Starting comprehensive permission analysis...');

  const diagnosticResults = {
    timestamp: new Date().toISOString(),
    testMode,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasRequiredEnvVars: {
        SHOPIFY_API_KEY: !!process.env.SHOPIFY_API_KEY,
        SHOPIFY_API_SECRET: !!process.env.SHOPIFY_API_SECRET,
        SHOPIFY_APP_URL: !!process.env.SHOPIFY_APP_URL,
        DATABASE_URL: !!process.env.DATABASE_URL
      }
    },
    authTests: {},
    recommendations: []
  } as any;

  try {
    // TEST 1: Admin Authentication
    console.log('[PERMISSION DIAGNOSTIC] Testing admin authentication...');
    try {
      const { session, admin } = await authenticate.admin(request);
      diagnosticResults.authTests.admin = {
        success: true,
        hasSession: !!session,
        shopDomain: session?.shop || null,
        isOnline: session?.isOnline || false,
        hasAccessToken: !!session?.accessToken,
        scopes: session?.scope?.split(',') || []
      };
      console.log('[PERMISSION DIAGNOSTIC] ✅ Admin authentication successful');
    } catch (adminError) {
      diagnosticResults.authTests.admin = {
        success: false,
        error: adminError instanceof Error ? adminError.message : 'Unknown admin auth error',
        type: 'admin_auth_failure'
      };
      console.log('[PERMISSION DIAGNOSTIC] ❌ Admin authentication failed:', adminError);
    }

    // TEST 2: POS Session Token Authentication
    console.log('[PERMISSION DIAGNOSTIC] Testing POS session token authentication...');
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      const posAuthResult = verifyPOSSessionToken(sessionToken);

      diagnosticResults.authTests.pos = {
        hasAuthHeader: true,
        authResult: posAuthResult,
        sessionTokenLength: sessionToken.length,
        sessionTokenFormat: sessionToken.substring(0, 20) + '...'
      };

      if (posAuthResult.success) {
        console.log('[PERMISSION DIAGNOSTIC] ✅ POS session token authentication successful');
      } else {
        console.log('[PERMISSION DIAGNOSTIC] ❌ POS session token authentication failed:', posAuthResult.error);
        diagnosticResults.recommendations.push({
          issue: 'POS Authentication Failed',
          solution: 'Ensure POS user has app permissions enabled and is logged in with email/password',
          priority: 'HIGH',
          steps: [
            'Go to Shopify Admin → Settings → Users',
            'Find your POS user account',
            'Click user → Apps tab → Enable "CreditNote" app',
            'Ensure user logged in with EMAIL/PASSWORD (not PIN only)',
            'Log out and back into POS if still not working'
          ]
        });
      }
    } else {
      diagnosticResults.authTests.pos = {
        hasAuthHeader: false,
        error: 'No Bearer token provided'
      };
      console.log('[PERMISSION DIAGNOSTIC] ⚠️ No POS authentication header found');
      diagnosticResults.recommendations.push({
        issue: 'No POS Authentication Token',
        solution: 'This request is not coming from a POS extension',
        priority: 'INFO',
        steps: [
          'To test POS authentication, make a request from a POS extension',
          'Or add "?test=admin" to test admin authentication only'
        ]
      });
    }

    // TEST 3: Permission Configuration Analysis
    console.log('[PERMISSION DIAGNOSTIC] Analyzing permission configuration...');
    diagnosticResults.permissionAnalysis = {
      requiredScopes: [
        'read_customers', 'write_customers', 'read_orders', 'write_orders',
        'read_products', 'write_products', 'read_locations'
      ],
      configuredScopes: process.env.SCOPES?.split(',').map(s => s.trim()) || [],
      appConfiguration: {
        isEmbeddedApp: true,
        apiVersion: '2025-07',
        posSupported: true
      }
    };

    // TEST 4: Common Issues Check
    console.log('[PERMISSION DIAGNOSTIC] Checking for common issues...');
    const commonIssues = [];

    // Check for missing environment variables
    const missingEnvVars = Object.entries(diagnosticResults.environment.hasRequiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingEnvVars.length > 0) {
      commonIssues.push({
        issue: 'Missing Environment Variables',
        details: missingEnvVars,
        priority: 'CRITICAL'
      });
    }

    // Check authentication patterns
    if (!diagnosticResults.authTests.admin?.success && !diagnosticResults.authTests.pos?.authResult?.success) {
      commonIssues.push({
        issue: 'No Valid Authentication',
        details: 'Neither admin nor POS authentication succeeded',
        priority: 'CRITICAL'
      });
    }

    diagnosticResults.commonIssues = commonIssues;

    // Generate recommendations
    if (diagnosticResults.authTests.pos?.authResult?.success === false) {
      diagnosticResults.recommendations.push({
        issue: 'POS User Permissions',
        solution: 'Enable app permissions for POS users',
        priority: 'HIGH',
        steps: [
          '1. Open Shopify Admin → Settings → Users and permissions',
          '2. Find the user account used for POS',
          '3. Click on the user name → Apps tab',
          '4. Find "CreditNote" and enable the toggle',
          '5. Ensure user has "Staff account" permissions (not POS-only)',
          '6. Verify user logs in with email/password (not PIN)',
          '7. Log out and back into POS to refresh permissions'
        ]
      });
    }

    console.log('[PERMISSION DIAGNOSTIC] ✅ Diagnostic analysis complete');

  } catch (error) {
    console.error('[PERMISSION DIAGNOSTIC] ❌ Critical error during analysis:', error);
    diagnosticResults.criticalError = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    };
  }

  return json(diagnosticResults);
}

export default function PermissionDiagnostic() {
  const data = useLoaderData<typeof loader>();

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'monospace',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#2c5aa0' }}>🔍 CreditNote Permission Diagnostic</h1>

      <div style={{ marginBottom: '20px' }}>
        <strong>Test Mode:</strong> {data.testMode}<br/>
        <strong>Timestamp:</strong> {data.timestamp}
      </div>

      {/* Environment Check */}
      <section style={{
        backgroundColor: 'white',
        padding: '15px',
        marginBottom: '20px',
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        <h2 style={{ color: '#2c5aa0' }}>🌍 Environment Configuration</h2>
        {Object.entries(data.environment.hasRequiredEnvVars).map(([key, value]) => (
          <div key={key} style={{ marginBottom: '5px' }}>
            <span style={{ color: value ? 'green' : 'red' }}>
              {value ? '✅' : '❌'} {key}
            </span>
          </div>
        ))}
      </section>

      {/* Authentication Tests */}
      <section style={{
        backgroundColor: 'white',
        padding: '15px',
        marginBottom: '20px',
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        <h2 style={{ color: '#2c5aa0' }}>🔐 Authentication Tests</h2>

        <h3>Admin Authentication:</h3>
        <div style={{
          backgroundColor: data.authTests.admin?.success ? '#d4edda' : '#f8d7da',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <strong>{data.authTests.admin?.success ? '✅ Success' : '❌ Failed'}</strong>
          <pre>{JSON.stringify(data.authTests.admin, null, 2)}</pre>
        </div>

        <h3>POS Authentication:</h3>
        <div style={{
          backgroundColor: data.authTests.pos?.authResult?.success ? '#d4edda' : '#f8d7da',
          padding: '10px',
          borderRadius: '4px'
        }}>
          <strong>{data.authTests.pos?.authResult?.success ? '✅ Success' : '❌ Failed'}</strong>
          <pre>{JSON.stringify(data.authTests.pos, null, 2)}</pre>
        </div>
      </section>

      {/* Common Issues */}
      {data.commonIssues && data.commonIssues.length > 0 && (
        <section style={{
          backgroundColor: '#fff3cd',
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          border: '1px solid #ffeaa7'
        }}>
          <h2 style={{ color: '#856404' }}>⚠️ Common Issues Detected</h2>
          {data.commonIssues.map((issue: any, index: number) => (
            <div key={index} style={{ marginBottom: '10px' }}>
              <strong>{issue.priority} - {issue.issue}:</strong>
              <pre>{JSON.stringify(issue.details, null, 2)}</pre>
            </div>
          ))}
        </section>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <section style={{
          backgroundColor: '#d1ecf1',
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '8px',
          border: '1px solid #bee5eb'
        }}>
          <h2 style={{ color: '#0c5460' }}>💡 Recommendations</h2>
          {data.recommendations.map((rec: any, index: number) => (
            <div key={index} style={{ marginBottom: '15px' }}>
              <h3>{rec.priority} - {rec.issue}</h3>
              <p><strong>Solution:</strong> {rec.solution}</p>
              {rec.steps && (
                <div>
                  <strong>Steps:</strong>
                  <ol>
                    {rec.steps.map((step: string, stepIndex: number) => (
                      <li key={stepIndex}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Raw Data */}
      <details style={{ marginTop: '20px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
          🔧 Raw Diagnostic Data
        </summary>
        <pre style={{
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '12px'
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}