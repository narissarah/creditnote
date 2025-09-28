/**
 * Comprehensive Authorization Header Validation for POS APIs
 * Addresses the "Missing" authorization header issues found in production logs
 * Enhanced for iOS device compatibility and detailed diagnostics
 */

export interface AuthHeaderValidationResult {
  valid: boolean;
  token?: string;
  error?: string;
  diagnostics?: {
    hasAuthHeader: boolean;
    headerFormat: string;
    tokenLength: number;
    tokenFormat: string;
    isIOSDevice: boolean;
    userAgent?: string;
    origin?: string;
    troubleshooting?: string[];
  };
}

/**
 * Validates Authorization header with comprehensive error reporting
 * Specifically designed to catch the issues reported in production logs
 */
export function validateAuthorizationHeader(request: Request): AuthHeaderValidationResult {
  const userAgent = request.headers.get('User-Agent') || '';
  const origin = request.headers.get('Origin') || '';
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

  // Detect iOS devices for enhanced diagnostics
  const isIOSDevice = userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iPod') ||
                     userAgent.includes('Safari') && userAgent.includes('Mobile') ||
                     origin?.includes('extensions.shopifycdn.com');

  console.log('[Auth Header Validation] Starting comprehensive header validation...', {
    hasAuthHeader: !!authHeader,
    isIOSDevice,
    userAgent: userAgent.substring(0, 100),
    origin
  });

  // STEP 1: Check if Authorization header exists
  if (!authHeader) {
    console.error('[Auth Header Validation] ❌ CRITICAL: Authorization header completely missing');

    return {
      valid: false,
      error: 'Authorization header is missing',
      diagnostics: {
        hasAuthHeader: false,
        headerFormat: 'MISSING',
        tokenLength: 0,
        tokenFormat: 'N/A',
        isIOSDevice,
        userAgent: userAgent.substring(0, 100),
        origin,
        troubleshooting: [
          '🚨 CRITICAL: Authorization header not sent by client',
          isIOSDevice ? 'iOS Device: Check if POS Session API is returning null tokens' : 'Check client-side authentication implementation',
          'Verify POS extension is calling sessionApi.getSessionToken() successfully',
          'Check if user has proper app permissions in Shopify Admin',
          'Ensure user is logged in with email/password (not PIN only)',
          'Verify POS app version is 10.6.0 or higher',
          'Check if Smart Grid tile needs re-activation after URL changes'
        ]
      }
    };
  }

  // STEP 2: Check Authorization header format
  if (!authHeader.startsWith('Bearer ')) {
    console.error('[Auth Header Validation] ❌ Invalid Authorization header format:', authHeader.substring(0, 20) + '...');

    return {
      valid: false,
      error: 'Invalid Authorization header format - must start with "Bearer "',
      diagnostics: {
        hasAuthHeader: true,
        headerFormat: 'INVALID_FORMAT',
        tokenLength: authHeader.length,
        tokenFormat: authHeader.substring(0, 10) + '...',
        isIOSDevice,
        userAgent: userAgent.substring(0, 100),
        origin,
        troubleshooting: [
          'Authorization header found but format is incorrect',
          'Expected format: "Bearer <token>"',
          `Actual format: "${authHeader.substring(0, 20)}..."`,
          'Check client-side token formatting in API calls'
        ]
      }
    };
  }

  // STEP 3: Extract and validate token
  const token = authHeader.substring(7).trim();

  if (!token) {
    console.error('[Auth Header Validation] ❌ Empty token in Authorization header');

    return {
      valid: false,
      error: 'Empty token in Authorization header',
      diagnostics: {
        hasAuthHeader: true,
        headerFormat: 'BEARER_EMPTY',
        tokenLength: 0,
        tokenFormat: 'EMPTY',
        isIOSDevice,
        userAgent: userAgent.substring(0, 100),
        origin,
        troubleshooting: [
          'Authorization header has correct "Bearer " prefix but token is empty',
          isIOSDevice ? 'iOS Device: sessionApi.getSessionToken() likely returned empty string' : 'Check token generation on client side',
          'This often indicates session API failure on POS device',
          'Try refreshing POS session or re-logging into POS with email/password'
        ]
      }
    };
  }

  // STEP 4: Validate JWT structure (if it's a JWT)
  const tokenParts = token.split('.');
  const isJWT = tokenParts.length === 3 && token.startsWith('eyJ');

  if (isJWT) {
    try {
      // Basic JWT structure validation
      JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
      JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());

      console.log('[Auth Header Validation] ✅ Valid JWT structure detected');
    } catch (jwtError) {
      console.error('[Auth Header Validation] ❌ Invalid JWT structure:', jwtError);

      return {
        valid: false,
        error: 'Invalid JWT structure in Authorization header',
        diagnostics: {
          hasAuthHeader: true,
          headerFormat: 'BEARER_INVALID_JWT',
          tokenLength: token.length,
          tokenFormat: 'MALFORMED_JWT',
          isIOSDevice,
          userAgent: userAgent.substring(0, 100),
          origin,
          troubleshooting: [
            'Authorization header contains malformed JWT token',
            'JWT structure validation failed - token may be corrupted',
            isIOSDevice ? 'iOS Device: Check for session token corruption during transmission' : 'Check token generation and transmission',
            'This may indicate a client-side token handling issue'
          ]
        }
      };
    }
  }

  // STEP 5: Check for common problematic token patterns
  const suspiciousPatterns = [
    { pattern: /^null$/i, issue: 'Token is literal "null" string' },
    { pattern: /^undefined$/i, issue: 'Token is literal "undefined" string' },
    { pattern: /^\s*$/, issue: 'Token is whitespace only' },
    { pattern: /^Bearer\s/, issue: 'Token incorrectly includes "Bearer" prefix' }
  ];

  for (const { pattern, issue } of suspiciousPatterns) {
    if (pattern.test(token)) {
      console.error('[Auth Header Validation] ❌ Suspicious token pattern detected:', issue);

      return {
        valid: false,
        error: `Invalid token: ${issue}`,
        diagnostics: {
          hasAuthHeader: true,
          headerFormat: 'BEARER_SUSPICIOUS',
          tokenLength: token.length,
          tokenFormat: issue,
          isIOSDevice,
          userAgent: userAgent.substring(0, 100),
          origin,
          troubleshooting: [
            `Token validation failed: ${issue}`,
            'This indicates a client-side token handling bug',
            isIOSDevice ? 'iOS Device: Check sessionApi.getSessionToken() return value handling' : 'Check client-side null/undefined handling',
            'Ensure proper error handling when session tokens are null or undefined'
          ]
        }
      };
    }
  }

  // STEP 6: Success - token passes all validation
  console.log('[Auth Header Validation] ✅ Authorization header validation successful', {
    tokenLength: token.length,
    tokenType: isJWT ? 'JWT' : 'OTHER',
    isIOSDevice
  });

  return {
    valid: true,
    token,
    diagnostics: {
      hasAuthHeader: true,
      headerFormat: 'BEARER_VALID',
      tokenLength: token.length,
      tokenFormat: isJWT ? 'JWT' : 'OTHER',
      isIOSDevice,
      userAgent: userAgent.substring(0, 100),
      origin
    }
  };
}

/**
 * Creates a standardized error response for authorization header failures
 * Includes iOS-specific troubleshooting guidance
 */
export function createAuthHeaderErrorResponse(validationResult: AuthHeaderValidationResult, additionalContext?: any) {
  const { error, diagnostics } = validationResult;

  return {
    success: false,
    error: error || 'Authorization header validation failed',
    data: [],
    total: 0,
    solutions: [
      '🚨 AUTHORIZATION HEADER ISSUE DETECTED:',
      ...(diagnostics?.troubleshooting || []),
      '',
      '📱 iOS POS Device Specific Steps:',
      '1. Ensure user is logged into POS with EMAIL/PASSWORD (not PIN)',
      '2. Check POS app version is 10.6.0 or higher',
      '3. Try force-closing and reopening POS app',
      '4. Remove and re-add Smart Grid extension tiles',
      '',
      '⚙️ General Troubleshooting:',
      '1. Verify app permissions in Shopify Admin → Users & permissions',
      '2. Check extension deployment status',
      '3. Verify API endpoint URLs are correct',
      '📞 Contact support if issue persists after completing all steps'
    ],
    diagnostics: {
      headerValidation: diagnostics,
      platform: diagnostics?.isIOSDevice ? 'iOS_POS' : 'OTHER',
      timestamp: new Date().toISOString(),
      troubleshootingLevel: 'CRITICAL',
      additionalContext
    }
  };
}