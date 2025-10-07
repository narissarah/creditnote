import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * POS Extension Diagnostic Logging Endpoint
 * Receives and logs diagnostic information from POS extensions
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const data = await request.json();

    console.log('============================================');
    console.log('[POS DIAGNOSTIC] Frontend diagnostic data received:');
    console.log('============================================');
    console.log('[POS DIAGNOSTIC] Timestamp:', new Date().toISOString());
    console.log('[POS DIAGNOSTIC] API Structure:', JSON.stringify(data.apiStructure, null, 2));
    console.log('[POS DIAGNOSTIC] Session Token Attempt:', JSON.stringify(data.sessionTokenAttempt, null, 2));
    console.log('[POS DIAGNOSTIC] Current Session Data:', JSON.stringify(data.currentSessionData, null, 2));
    console.log('[POS DIAGNOSTIC] Context:', JSON.stringify(data.context, null, 2));
    console.log('============================================');

    return json({
      success: true,
      message: 'Diagnostic data logged successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[POS DIAGNOSTIC] Error processing diagnostic data:', error);
    return json({
      success: false,
      error: 'Failed to process diagnostic data'
    }, { status: 500 });
  }
}

export async function loader() {
  return json({
    error: 'This endpoint only accepts POST requests'
  }, { status: 405 });
}
