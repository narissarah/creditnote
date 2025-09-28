/**
 * Comprehensive POS Authorization Recovery System
 *
 * Addresses the critical issue where iPhone devices with Shopify POS 10.10.1
 * show 'authorization: Missing' in request headers, preventing API access.
 *
 * Based on production logs showing:
 * - User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Shopify POS/10.10.1/iOS/18.6.2/Apple/iPhone11,8/production ExtensibilityHost
 * - Origin: https://extensions.shopifycdn.com
 * - Authorization: Missing
 */

export interface PosAuthorizationContext {
  userAgent: string;
  origin: string;
  shop?: string;
  locationId?: string;
  hasAuthHeader: boolean;
  hasPosHeaders: boolean;
  deviceType: 'iPhone' | 'iPad' | 'Android' | 'Unknown';
  posVersion?: string;
  iosVersion?: string;
}

export interface PosAuthorizationRecoveryResult {
  success: boolean;
  authorizationMethod?: string;
  fallbackShop?: string;
  recoveryStrategy?: string;
  error?: string;
  debugInfo?: any;
  troubleshootingLevel?: 'INFO' | 'WARNING' | 'CRITICAL';
}

/**
 * Analyze POS request context and determine recovery strategy
 */
export function analyzePosAuthorizationContext(request: Request): PosAuthorizationContext {
  const userAgent = request.headers.get('User-Agent') || '';
  const origin = request.headers.get('Origin') || '';
  const hasAuthHeader = !!request.headers.get('Authorization');

  // Enhanced device detection
  let deviceType: 'iPhone' | 'iPad' | 'Android' | 'Unknown' = 'Unknown';
  if (userAgent.includes('iPhone')) deviceType = 'iPhone';
  else if (userAgent.includes('iPad')) deviceType = 'iPad';
  else if (userAgent.includes('Android')) deviceType = 'Android';

  // Extract POS and iOS versions
  const posVersionMatch = userAgent.match(/Shopify POS\/([\d.]+)/);
  const iosVersionMatch = userAgent.match(/OS ([\d_]+)/);

  // Check for POS-specific headers
  const hasPosHeaders = !!(
    request.headers.get('X-POS-Extension-Version') ||
    request.headers.get('X-Shopify-POS-Extension') ||
    request.headers.get('X-POS-Device-Type') ||
    request.headers.get('X-POS-Token-Fallback')
  );

  return {
    userAgent,
    origin,
    hasAuthHeader,
    hasPosHeaders,
    deviceType,
    posVersion: posVersionMatch?.[1],
    iosVersion: iosVersionMatch?.[1]?.replace(/_/g, '.'),
    shop: extractShopFromHeaders(request) || extractShopFromUrl(request)
  };
}

/**
 * Comprehensive POS authorization recovery for missing headers
 */
export function recoverPosAuthorization(
  request: Request,
  context?: PosAuthorizationContext
): PosAuthorizationRecoveryResult {
  console.log('[POS Auth Recovery] Starting comprehensive authorization recovery...');

  const authContext = context || analyzePosAuthorizationContext(request);

  console.log('[POS Auth Recovery] Context analysis:', {
    deviceType: authContext.deviceType,
    posVersion: authContext.posVersion,
    iosVersion: authContext.iosVersion,
    hasAuthHeader: authContext.hasAuthHeader,
    hasPosHeaders: authContext.hasPosHeaders,
    origin: authContext.origin,
    userAgent: authContext.userAgent.substring(0, 100)
  });

  // Check if this is actually a POS extension request
  if (!isPosExtensionContext(authContext)) {
    return {
      success: false,
      error: 'Not a POS extension request - recovery not applicable',
      debugInfo: { context: 'NON_POS_REQUEST' }
    };
  }

  // Strategy 1: Enhanced headers from improved POS API client
  if (authContext.hasPosHeaders) {
    const enhancedRecovery = attemptEnhancedHeaderRecovery(request, authContext);
    if (enhancedRecovery.success) {
      console.log('[POS Auth Recovery] ✅ Enhanced header recovery successful');
      return enhancedRecovery;
    }
  }

  // Strategy 2: iOS-specific session token acquisition patterns
  if (authContext.deviceType === 'iPhone' || authContext.deviceType === 'iPad') {
    const iosRecovery = attemptIOSAuthorizationRecovery(request, authContext);
    if (iosRecovery.success) {
      console.log('[POS Auth Recovery] ✅ iOS authorization recovery successful');
      return iosRecovery;
    }
  }

  // Strategy 3: Shop domain extraction for server-side fallback
  if (authContext.shop) {
    const shopRecovery = attemptShopBasedRecovery(request, authContext);
    if (shopRecovery.success) {
      console.log('[POS Auth Recovery] ✅ Shop-based recovery successful');
      return shopRecovery;
    }
  }

  // Strategy 4: URL parameter analysis
  const urlRecovery = attemptUrlParameterRecovery(request, authContext);
  if (urlRecovery.success) {
    console.log('[POS Auth Recovery] ✅ URL parameter recovery successful');
    return urlRecovery;
  }

  // All strategies failed - return comprehensive diagnostic information
  console.error('[POS Auth Recovery] ❌ All recovery strategies failed');
  return createComprehensiveFailureResponse(authContext);
}

/**
 * Strategy 1: Enhanced header recovery from improved POS API client
 */
function attemptEnhancedHeaderRecovery(
  request: Request,
  context: PosAuthorizationContext
): PosAuthorizationRecoveryResult {
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain');
  const posDeviceType = request.headers.get('X-POS-Device-Type');
  const tokenFallback = request.headers.get('X-POS-Token-Fallback');

  if (shopDomain && shopDomain.includes('.myshopify.com')) {
    return {
      success: true,
      authorizationMethod: 'ENHANCED_POS_HEADERS',
      fallbackShop: shopDomain,
      recoveryStrategy: 'ENHANCED_CLIENT_HEADERS',
      debugInfo: {
        strategy: 1,
        shopDomain,
        posDeviceType,
        tokenFallback,
        clientEnhanced: true
      }
    };
  }

  return { success: false, error: 'Enhanced headers not found' };
}

/**
 * Strategy 2: iOS-specific authorization recovery
 */
function attemptIOSAuthorizationRecovery(
  request: Request,
  context: PosAuthorizationContext
): PosAuthorizationRecoveryResult {
  // Check for iOS-specific recovery indicators
  const iosTokenFailed = request.headers.get('X-iOS-Token-Failed');
  const posAuthAttempt = request.headers.get('X-POS-Auth-Attempt');

  // Extract shop from referer for iOS devices
  const referer = request.headers.get('Referer') || request.headers.get('Referrer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererShop = refererUrl.searchParams.get('shop');
      if (refererShop && refererShop.includes('.myshopify.com')) {
        return {
          success: true,
          authorizationMethod: 'IOS_REFERER_EXTRACTION',
          fallbackShop: refererShop,
          recoveryStrategy: 'IOS_REFERER_ANALYSIS',
          debugInfo: {
            strategy: 2,
            refererShop,
            iosTokenFailed,
            posAuthAttempt,
            deviceType: context.deviceType,
            iosVersion: context.iosVersion
          }
        };
      }
    } catch (error) {
      console.warn('[POS Auth Recovery] Failed to parse referer for iOS recovery:', error);
    }
  }

  return { success: false, error: 'iOS referer analysis failed' };
}

/**
 * Strategy 3: Shop-based recovery using extracted shop domain
 */
function attemptShopBasedRecovery(
  request: Request,
  context: PosAuthorizationContext
): PosAuthorizationRecoveryResult {
  if (context.shop && context.shop.includes('.myshopify.com')) {
    return {
      success: true,
      authorizationMethod: 'SHOP_DOMAIN_EXTRACTION',
      fallbackShop: context.shop,
      recoveryStrategy: 'SHOP_BASED_RECOVERY',
      debugInfo: {
        strategy: 3,
        shopDomain: context.shop,
        extractionMethod: 'CONTEXT_ANALYSIS'
      }
    };
  }

  return { success: false, error: 'No valid shop domain found' };
}

/**
 * Strategy 4: URL parameter analysis
 */
function attemptUrlParameterRecovery(
  request: Request,
  context: PosAuthorizationContext
): PosAuthorizationRecoveryResult {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get('shop') || url.searchParams.get('shopDomain');

  if (shopParam && shopParam.includes('.myshopify.com')) {
    return {
      success: true,
      authorizationMethod: 'URL_PARAMETER_EXTRACTION',
      fallbackShop: shopParam,
      recoveryStrategy: 'URL_PARAMETER_ANALYSIS',
      debugInfo: {
        strategy: 4,
        shopParam,
        urlAnalysis: true
      }
    };
  }

  return { success: false, error: 'No shop parameter in URL' };
}

/**
 * Create comprehensive failure response with detailed diagnostics
 */
function createComprehensiveFailureResponse(
  context: PosAuthorizationContext
): PosAuthorizationRecoveryResult {
  const isIOSDevice = context.deviceType === 'iPhone' || context.deviceType === 'iPad';
  const isPOSVersionSupported = context.posVersion ? parseFloat(context.posVersion) >= 10.6 : false;

  return {
    success: false,
    error: 'All POS authorization recovery strategies failed',
    troubleshootingLevel: 'CRITICAL',
    debugInfo: {
      allStrategiesFailed: true,
      context,
      deviceAnalysis: {
        isIOSDevice,
        deviceType: context.deviceType,
        posVersion: context.posVersion,
        iosVersion: context.iosVersion,
        isPOSVersionSupported,
        hasRequiredHeaders: context.hasPosHeaders
      },
      troubleshooting: {
        userPermissionIssue: !context.hasAuthHeader && !context.hasPosHeaders,
        deviceCompatibility: !isPOSVersionSupported,
        networkIssue: !context.origin.includes('extensions.shopifycdn.com'),
        configurationIssue: !context.shop
      },
      criticalErrors: [
        'POS extension session token acquisition failed',
        'No valid shop domain extraction possible',
        'Authorization header completely missing',
        'Enhanced fallback headers not present'
      ]
    }
  };
}

/**
 * Check if request context indicates POS extension
 */
function isPosExtensionContext(context: PosAuthorizationContext): boolean {
  return context.origin.includes('extensions.shopifycdn.com') ||
         context.userAgent.includes('Shopify POS') ||
         context.userAgent.includes('ExtensibilityHost') ||
         context.hasPosHeaders;
}

/**
 * Extract shop domain from various header sources
 */
function extractShopFromHeaders(request: Request): string | null {
  const candidates = [
    request.headers.get('X-Shopify-Shop-Domain'),
    request.headers.get('X-Shop-Domain'),
    request.headers.get('X-Shopify-Shop')
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.includes('.myshopify.com')) {
      return candidate;
    }
  }

  return null;
}

/**
 * Extract shop domain from URL parameters
 */
function extractShopFromUrl(request: Request): string | null {
  const url = new URL(request.url);
  const candidates = [
    url.searchParams.get('shop'),
    url.searchParams.get('shopDomain')
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.includes('.myshopify.com')) {
      return candidate;
    }
  }

  return null;
}

/**
 * Create detailed authorization failure response
 */
export function createPosAuthorizationFailureResponse(
  recoveryResult: PosAuthorizationRecoveryResult,
  additionalContext?: any
) {
  const context = recoveryResult.debugInfo?.context || recoveryResult.debugInfo;
  const isIOSDevice = context?.deviceType === 'iPhone' || context?.deviceType === 'iPad';

  return {
    success: false,
    error: 'POS Extension Authorization Failed',
    details: recoveryResult.error,
    data: [],
    total: 0,
    solutions: [
      '🚨 CRITICAL POS AUTHORIZATION ISSUE (iPhone/iPad):',
      'This device cannot provide session tokens to the POS extension.',
      '',
      '📱 IMMEDIATE iOS-SPECIFIC TROUBLESHOOTING:',
      '1. User MUST be logged into POS with EMAIL/PASSWORD (not PIN only)',
      '2. User MUST have app permissions in Shopify Admin → Users & permissions',
      '3. POS app version MUST be 10.6.0 or higher (current: ' + (context?.posVersion || 'Unknown') + ')',
      '4. iOS version compatibility check (current: ' + (context?.iosVersion || 'Unknown') + ')',
      '5. Smart Grid tile needs to be removed and re-added',
      '6. Force-close and reopen POS app completely',
      '7. Clear POS app cache and restart device',
      '8. Check network connectivity and WiFi stability',
      '',
      '🔧 ADVANCED TROUBLESHOOTING:',
      '9. Check if app URL changed recently (requires extension re-deployment)',
      '10. Verify extension is properly configured in Partner Dashboard',
      '11. Test with different POS user account',
      '12. Contact Shopify support if issue persists with fresh tokens',
      '',
      '🩺 DIAGNOSTIC INFORMATION:',
      `- Device: ${context?.deviceType || 'Unknown'}`,
      `- POS Version: ${context?.posVersion || 'Unknown'}`,
      `- iOS Version: ${context?.iosVersion || 'Unknown'}`,
      `- Has Enhanced Headers: ${context?.hasPosHeaders ? 'Yes' : 'No'}`,
      `- Recovery Strategies Attempted: ${recoveryResult.debugInfo?.allStrategiesFailed ? 'All' : 'Partial'}`,
      '',
      '📞 If all steps are completed and issue persists, this indicates a POS user permission problem.'
    ],
    diagnostics: {
      platform: 'POS_EXTENSION_AUTHORIZATION_RECOVERY',
      deviceType: context?.deviceType || 'Unknown',
      authorizationFailure: 'COMPREHENSIVE_RECOVERY_FAILED',
      posVersion: context?.posVersion,
      iosVersion: context?.iosVersion,
      hasEnhancedHeaders: context?.hasPosHeaders,
      recoveryStrategiesAttempted: recoveryResult.debugInfo?.allStrategiesFailed ? 4 : 'Partial',
      troubleshootingLevel: recoveryResult.troubleshootingLevel || 'CRITICAL',
      timestamp: new Date().toISOString(),
      ...additionalContext
    }
  };
}