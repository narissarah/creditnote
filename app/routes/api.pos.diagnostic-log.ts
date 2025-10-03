/**
 * POS Diagnostic Log Endpoint
 * Receives diagnostic information from POS extensions and logs it server-side
 * This allows us to see frontend state in Vercel logs since device console is inaccessible
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  // Handle OPTIONS for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const diagnosticData = await request.json();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🔬 POS EXTENSION DIAGNOSTIC DATA RECEIVED');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('[POS DIAGNOSTIC] Timestamp:', new Date().toISOString());
    console.log('[POS DIAGNOSTIC] User-Agent:', request.headers.get('User-Agent')?.substring(0, 100));
    console.log('');

    // Log API structure
    if (diagnosticData.apiStructure) {
      console.log('📊 API OBJECT STRUCTURE:');
      console.log('[POS DIAGNOSTIC] API top-level keys:', diagnosticData.apiStructure.topLevelKeys);
      console.log('[POS DIAGNOSTIC] API type:', diagnosticData.apiStructure.apiType);
      console.log('');

      console.log('🔐 SESSION OBJECT STRUCTURE:');
      console.log('[POS DIAGNOSTIC] Has api.session:', diagnosticData.apiStructure.hasSession);
      console.log('[POS DIAGNOSTIC] api.session keys:', diagnosticData.apiStructure.sessionKeys);
      console.log('[POS DIAGNOSTIC] api.session type:', diagnosticData.apiStructure.sessionType);
      console.log('');

      console.log('📍 CURRENT SESSION STRUCTURE:');
      console.log('[POS DIAGNOSTIC] Has api.session.currentSession:', diagnosticData.apiStructure.hasCurrentSession);
      console.log('[POS DIAGNOSTIC] api.session.currentSession keys:', diagnosticData.apiStructure.currentSessionKeys);
      console.log('[POS DIAGNOSTIC] api.session.currentSession type:', diagnosticData.apiStructure.currentSessionType);
      console.log('');

      console.log('🏪 SHOP DOMAIN EXTRACTION ATTEMPTS:');
      console.log('[POS DIAGNOSTIC] api.session.currentSession.shopDomain:', diagnosticData.apiStructure.shopDomainPaths?.currentSessionShopDomain);
      console.log('[POS DIAGNOSTIC] api.session.currentSession.shop:', diagnosticData.apiStructure.shopDomainPaths?.currentSessionShop);
      console.log('[POS DIAGNOSTIC] api.session.shopDomain:', diagnosticData.apiStructure.shopDomainPaths?.sessionShopDomain);
      console.log('[POS DIAGNOSTIC] api.session.shop:', diagnosticData.apiStructure.shopDomainPaths?.sessionShop);
      console.log('[POS DIAGNOSTIC] api.shopDomain:', diagnosticData.apiStructure.shopDomainPaths?.topLevelShopDomain);
      console.log('[POS DIAGNOSTIC] api.shop:', diagnosticData.apiStructure.shopDomainPaths?.topLevelShop);
      console.log('');

      console.log('🎫 SESSION TOKEN AVAILABILITY:');
      console.log('[POS DIAGNOSTIC] Has api.session.getSessionToken:', diagnosticData.apiStructure.hasGetSessionToken);
      console.log('[POS DIAGNOSTIC] getSessionToken type:', diagnosticData.apiStructure.getSessionTokenType);
      console.log('');
    }

    // Log session token attempt result
    if (diagnosticData.sessionTokenAttempt) {
      console.log('🔑 SESSION TOKEN FETCH ATTEMPT:');
      console.log('[POS DIAGNOSTIC] Attempt successful:', diagnosticData.sessionTokenAttempt.success);
      console.log('[POS DIAGNOSTIC] Token type:', diagnosticData.sessionTokenAttempt.tokenType);
      console.log('[POS DIAGNOSTIC] Token is null:', diagnosticData.sessionTokenAttempt.isNull);
      console.log('[POS DIAGNOSTIC] Token is undefined:', diagnosticData.sessionTokenAttempt.isUndefined);
      console.log('[POS DIAGNOSTIC] Token length:', diagnosticData.sessionTokenAttempt.tokenLength);
      console.log('[POS DIAGNOSTIC] Error:', diagnosticData.sessionTokenAttempt.error);
      console.log('');
    }

    // Log current session data
    if (diagnosticData.currentSessionData) {
      console.log('📋 CURRENT SESSION DATA:');
      console.log('[POS DIAGNOSTIC] Shop ID:', diagnosticData.currentSessionData.shopId);
      console.log('[POS DIAGNOSTIC] User ID:', diagnosticData.currentSessionData.userId);
      console.log('[POS DIAGNOSTIC] Location ID:', diagnosticData.currentSessionData.locationId);
      console.log('[POS DIAGNOSTIC] Staff Member ID:', diagnosticData.currentSessionData.staffMemberId);
      console.log('[POS DIAGNOSTIC] Currency:', diagnosticData.currentSessionData.currency);
      console.log('[POS DIAGNOSTIC] POS Version:', diagnosticData.currentSessionData.posVersion);
      console.log('[POS DIAGNOSTIC] All keys:', diagnosticData.currentSessionData.allKeys);
      console.log('');
    }

    // Log additional context
    if (diagnosticData.context) {
      console.log('🎯 EXTENSION CONTEXT:');
      console.log('[POS DIAGNOSTIC] Extension point:', diagnosticData.context.extensionPoint);
      console.log('[POS DIAGNOSTIC] Retry attempt:', diagnosticData.context.retryAttempt);
      console.log('[POS DIAGNOSTIC] Load timestamp:', diagnosticData.context.loadTimestamp);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');

    return json(
      {
        success: true,
        message: "Diagnostic data logged successfully",
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );

  } catch (error) {
    console.error('[POS DIAGNOSTIC] Error processing diagnostic data:', error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
