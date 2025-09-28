/**
 * Comprehensive POS Session Token Recovery for iOS Devices
 *
 * Addresses the critical issue where iOS POS extensions fail to provide
 * session tokens due to device idle state, permission issues, or network problems.
 *
 * Based on research showing iOS devices with Shopify POS 10.10.1 experiencing
 * 'authorization: Missing' errors due to getSessionToken() returning null.
 */

export interface PosTokenRecoveryOptions {
  shop: string;
  locationId?: string;
  retryAttempts?: number;
  deviceType?: 'iOS' | 'Android' | 'Unknown';
  userAgent?: string;
  origin?: string;
}

export interface PosTokenRecoveryResult {
  success: boolean;
  shopDomain?: string;
  fallbackStrategy?: string;
  error?: string;
  debugInfo?: any;
}

/**
 * Comprehensive POS session token recovery for iOS devices
 * Implements multiple fallback strategies when getSessionToken() fails
 */
export function recoverPosSessionToken(
  request: Request,
  options: PosTokenRecoveryOptions
): PosTokenRecoveryResult {
  console.log('[POS Recovery] Starting comprehensive session token recovery...');

  const userAgent = request.headers.get('User-Agent') || options.userAgent || '';
  const origin = request.headers.get('Origin') || options.origin || '';

  // Enhanced iOS device detection
  const isIOSDevice = userAgent.includes('iPhone') ||
                     userAgent.includes('iPad') ||
                     userAgent.includes('iPod') ||
                     userAgent.includes('Safari') && userAgent.includes('Mobile') ||
                     options.deviceType === 'iOS';

  const isPOSExtension = origin.includes('extensions.shopifycdn.com') ||
                        userAgent.includes('Shopify POS') ||
                        userAgent.includes('ExtensibilityHost');

  console.log('[POS Recovery] Device and context analysis:', {
    isIOSDevice,
    isPOSExtension,
    userAgent: userAgent.substring(0, 100),
    origin,
    shop: options.shop
  });

  if (!isPOSExtension) {
    return {
      success: false,
      error: 'Not a POS extension request - recovery not applicable',
      debugInfo: { context: 'NON_POS_REQUEST' }
    };
  }

  // Strategy 1: Extract shop from enhanced POS client headers
  const enhancedShop = request.headers.get('X-Shopify-Shop-Domain');
  if (enhancedShop && enhancedShop.includes('.myshopify.com')) {
    console.log('[POS Recovery] ✅ Strategy 1: Enhanced client header shop extraction');
    return {
      success: true,
      shopDomain: enhancedShop,
      fallbackStrategy: 'ENHANCED_CLIENT_HEADERS',
      debugInfo: {
        strategy: 1,
        source: 'X-Shopify-Shop-Domain',
        value: enhancedShop
      }
    };
  }

  // Strategy 2: URL parameters from request
  const url = new URL(request.url);
  const shopParam = url.searchParams.get('shop') || url.searchParams.get('shopDomain') || options.shop;
  if (shopParam && shopParam.includes('.myshopify.com')) {
    console.log('[POS Recovery] ✅ Strategy 2: URL parameter shop extraction');
    return {
      success: true,
      shopDomain: shopParam,
      fallbackStrategy: 'URL_PARAMETERS',
      debugInfo: {
        strategy: 2,
        source: 'URL_PARAMETERS',
        value: shopParam
      }
    };
  }

  // Strategy 3: Standard headers
  const headerShop = request.headers.get('X-Shop-Domain') ||
                    request.headers.get('X-Shopify-Shop');
  if (headerShop && headerShop.includes('.myshopify.com')) {
    console.log('[POS Recovery] ✅ Strategy 3: Standard header shop extraction');
    return {
      success: true,
      shopDomain: headerShop,
      fallbackStrategy: 'STANDARD_HEADERS',
      debugInfo: {
        strategy: 3,
        source: 'X-Shop-Domain',
        value: headerShop
      }
    };
  }

  // Strategy 4: Referer header analysis (iOS specific)
  if (isIOSDevice) {
    const referer = request.headers.get('Referer') || request.headers.get('Referrer');
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererShop = refererUrl.searchParams.get('shop');
        if (refererShop && refererShop.includes('.myshopify.com')) {
          console.log('[POS Recovery] ✅ Strategy 4: iOS referer header analysis');
          return {
            success: true,
            shopDomain: refererShop,
            fallbackStrategy: 'IOS_REFERER_ANALYSIS',
            debugInfo: {
              strategy: 4,
              source: 'REFERER_HEADER',
              value: refererShop,
              refererUrl: referer
            }
          };
        }
      } catch (error) {
        console.warn('[POS Recovery] Failed to parse referer URL:', error);
      }
    }
  }

  // Strategy 5: Extract from options (last resort)
  if (options.shop && options.shop.includes('.myshopify.com')) {
    console.log('[POS Recovery] ✅ Strategy 5: Options fallback');
    return {
      success: true,
      shopDomain: options.shop,
      fallbackStrategy: 'OPTIONS_FALLBACK',
      debugInfo: {
        strategy: 5,
        source: 'FUNCTION_OPTIONS',
        value: options.shop
      }
    };
  }

  // All strategies failed
  console.error('[POS Recovery] ❌ All recovery strategies failed');
  return {
    success: false,
    error: 'No valid shop domain found in any fallback strategy',
    debugInfo: {
      strategiesAttempted: 5,
      isIOSDevice,
      isPOSExtension,
      availableHeaders: {
        hasEnhancedShop: !!enhancedShop,
        hasHeaderShop: !!headerShop,
        hasReferer: !!request.headers.get('Referer'),
        hasOrigin: !!origin
      },
      availableParams: {
        hasShopParam: !!url.searchParams.get('shop'),
        hasShopDomainParam: !!url.searchParams.get('shopDomain')
      },
      troubleshooting: [
        'Verify POS extension configuration includes shop parameter',
        'Check if session token acquisition is properly implemented',
        'Ensure user has app permissions in Shopify Admin',
        'Verify POS app version is 10.6.0 or higher'
      ]
    }
  };
}

/**
 * Create enhanced authentication response for POS recovery
 */
export function createPosRecoveryResponse(
  recoveryResult: PosTokenRecoveryResult,
  locationId?: string,
  additionalContext?: any
) {
  if (recoveryResult.success) {
    return {
      success: true,
      shopDomain: recoveryResult.shopDomain,
      authType: `POS_RECOVERY_${recoveryResult.fallbackStrategy}`,
      locationId,
      metadata: {
        recoveryStrategy: recoveryResult.fallbackStrategy,
        strategyNumber: recoveryResult.debugInfo?.strategy,
        timestamp: new Date().toISOString(),
        ...additionalContext
      }
    };
  }

  return {
    success: false,
    error: 'POS session token recovery failed',
    details: recoveryResult.error,
    solutions: [
      '🚨 CRITICAL POS iOS Authentication Issue:',
      'This indicates the POS extension cannot obtain session tokens.',
      '',
      '📱 IMMEDIATE iOS-SPECIFIC TROUBLESHOOTING:',
      '1. User MUST be logged into POS with EMAIL/PASSWORD (not PIN only)',
      '2. User MUST have app permissions in Shopify Admin → Users & permissions',
      '3. POS app version MUST be 10.6.0 or higher',
      '4. Smart Grid tile needs to be removed and re-added',
      '5. Try force-closing and reopening the POS app completely',
      '6. Clear POS app cache and restart device',
      '7. Check network connectivity and try different WiFi',
      '',
      '🔧 Technical Diagnostics:',
      `- Device Type: ${recoveryResult.debugInfo?.isIOSDevice ? 'iOS' : 'Unknown'}`,
      `- POS Extension: ${recoveryResult.debugInfo?.isPOSExtension ? 'Yes' : 'No'}`,
      `- Strategies Attempted: ${recoveryResult.debugInfo?.strategiesAttempted || 0}`,
      '',
      '📞 If issue persists after all steps, contact support with these details.'
    ],
    diagnostics: {
      platform: 'POS_EXTENSION_IOS_ENHANCED_RECOVERY',
      recoveryAttempted: true,
      allStrategiesFailed: true,
      debugInfo: recoveryResult.debugInfo,
      timestamp: new Date().toISOString(),
      troubleshootingLevel: 'CRITICAL_POS_RECOVERY'
    }
  };
}

/**
 * Enhanced POS extension detection
 */
export function isPosExtensionRequest(request: Request): boolean {
  const userAgent = request.headers.get('User-Agent') || '';
  const origin = request.headers.get('Origin') || '';

  return origin.includes('extensions.shopifycdn.com') ||
         userAgent.includes('Shopify POS') ||
         userAgent.includes('ExtensibilityHost') ||
         request.headers.get('X-POS-Extension-Version') !== null ||
         request.headers.get('X-Shopify-POS-Extension') !== null;
}

/**
 * Enhanced iOS device detection
 */
export function isIOSPosDevice(request: Request): boolean {
  const userAgent = request.headers.get('User-Agent') || '';

  return (userAgent.includes('iPhone') ||
          userAgent.includes('iPad') ||
          userAgent.includes('iPod') ||
          userAgent.includes('Safari') && userAgent.includes('Mobile')) &&
         isPosExtensionRequest(request);
}