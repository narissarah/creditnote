/**
 * Bulletproof Timestamp Recovery System for Shopify 2025-07
 *
 * Addresses the critical issue where JWT tokens show extreme future timestamps
 * (e.g., exp: 1758991244 in September 2025) causing validation failures.
 *
 * This is NOT a clock skew issue - it's a token expiration issue that requires
 * proper token lifecycle management and proactive refresh strategies.
 */

export interface TimestampValidationResult {
  valid: boolean;
  error?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recoveryAction?: 'ALLOW' | 'TOKEN_EXCHANGE' | 'SESSION_BOUNCE' | 'FORCE_REFRESH' | 'WAIT_OR_REFRESH';
  debugInfo?: any;
  shouldRefresh?: boolean;
  timeUntilExpiry?: number;
}

export interface SessionTokenPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti?: string;
  sid?: string;
}

/**
 * Production-ready timestamp validation with comprehensive recovery strategies
 * Handles extreme scenarios like tokens with timestamps 10+ hours in the future/past
 */
export function validateTimestampsWithRecovery(
  payload: SessionTokenPayload,
  request?: Request
): TimestampValidationResult {
  console.log('[Timestamp Recovery] Starting bulletproof timestamp validation...');

  const now = Math.floor(Date.now() / 1000);
  const userAgent = request?.headers?.get('User-Agent') || '';
  const isIOSDevice = detectIOSDevice(userAgent);

  // Calculate time differences for analysis
  const clockSkew = payload.nbf ? payload.nbf - now : 0;
  const timeUntilExpiry = payload.exp - now;
  const timeSinceIssued = now - payload.iat;

  console.log('[Timestamp Recovery] Comprehensive timestamp analysis:', {
    currentTime: now,
    currentTimeISO: new Date(now * 1000).toISOString(),
    tokenExp: payload.exp,
    tokenExpISO: new Date(payload.exp * 1000).toISOString(),
    tokenNbf: payload.nbf,
    tokenNbfISO: new Date(payload.nbf * 1000).toISOString(),
    tokenIat: payload.iat,
    tokenIatISO: new Date(payload.iat * 1000).toISOString(),
    clockSkew,
    timeUntilExpiry,
    timeSinceIssued,
    isIOSDevice
  });

  // CRITICAL: Detect severely malformed timestamps (> 1 year in future/past)
  const oneYearInSeconds = 365 * 24 * 60 * 60;
  if (Math.abs(clockSkew) > oneYearInSeconds) {
    console.error('[Timestamp Recovery] 🚨 CRITICAL: Severely malformed timestamp detected');
    console.error('[Timestamp Recovery] This indicates a fundamental timestamp generation issue');

    return {
      valid: false,
      error: 'Severely malformed timestamp - possible system clock or token generation issue',
      severity: 'CRITICAL',
      recoveryAction: 'FORCE_REFRESH',
      debugInfo: {
        issue: 'MALFORMED_TIMESTAMP',
        clockSkew,
        clockSkewHours: Math.round(clockSkew / 3600),
        recommendedAction: 'Force session bounce to get new token',
        possibleCauses: [
          'System clock synchronization issue',
          'Token generation timestamp bug',
          'Timezone conversion error',
          'Database timestamp corruption'
        ]
      }
    };
  }

  // CRITICAL: Check if token is severely expired (> 1 hour ago)
  if (payload.exp < (now - 3600)) {
    const expiredHours = Math.round((now - payload.exp) / 3600);
    console.error('[Timestamp Recovery] 🚨 Token severely expired:', expiredHours, 'hours ago');

    return {
      valid: false,
      error: `Token severely expired ${expiredHours} hours ago - automatic refresh required`,
      severity: 'CRITICAL',
      recoveryAction: 'FORCE_REFRESH',
      debugInfo: {
        expiredBy: now - payload.exp,
        expiredHours,
        expiredAt: new Date(payload.exp * 1000).toISOString(),
        currentTime: new Date(now * 1000).toISOString(),
        issue: 'SEVERELY_EXPIRED'
      }
    };
  }

  // Determine appropriate tolerance based on device and scenario
  const tolerance = determineClockSkewTolerance(request, clockSkew);

  // Check expiration with adaptive tolerance
  if (payload.exp <= (now - tolerance)) {
    const expiredBy = now - payload.exp;
    const shouldUseTokenExchange = expiredBy < 300; // < 5 minutes expired

    console.warn('[Timestamp Recovery] ⚠️ Token expired beyond tolerance');

    return {
      valid: false,
      error: `Token expired ${Math.round(expiredBy / 60)} minutes ago`,
      severity: shouldUseTokenExchange ? 'MEDIUM' : 'HIGH',
      recoveryAction: shouldUseTokenExchange ? 'TOKEN_EXCHANGE' : 'SESSION_BOUNCE',
      debugInfo: {
        expiredBy,
        tolerance,
        recommendedAction: shouldUseTokenExchange ? 'Immediate token exchange' : 'Session bounce recovery',
        deviceType: isIOSDevice ? 'iOS' : 'Other',
        issue: 'EXPIRED_BEYOND_TOLERANCE'
      }
    };
  }

  // Check not-yet-valid with tolerance (future timestamps)
  if (payload.nbf > (now + tolerance)) {
    const validIn = payload.nbf - now;
    const hoursInFuture = Math.round(validIn / 3600);

    // If token is extremely far in the future, this is likely a system issue
    if (hoursInFuture > 24) {
      console.error('[Timestamp Recovery] 🚨 Token extremely far in future:', hoursInFuture, 'hours');

      return {
        valid: false,
        error: `Token not valid for ${hoursInFuture} hours - possible timestamp issue`,
        severity: 'CRITICAL',
        recoveryAction: 'FORCE_REFRESH',
        debugInfo: {
          validIn,
          hoursInFuture,
          tolerance,
          clockSkew,
          issue: 'FUTURE_TIMESTAMP_EXTREME',
          possibleCauses: [
            'System clock far behind',
            'Token generation timestamp bug',
            'Timezone conversion error'
          ]
        }
      };
    }

    console.warn('[Timestamp Recovery] ⚠️ Token not yet valid');

    return {
      valid: false,
      error: `Token not valid for ${Math.round(validIn / 60)} minutes`,
      severity: 'MEDIUM',
      recoveryAction: validIn < 300 ? 'WAIT_OR_REFRESH' : 'SESSION_BOUNCE',
      debugInfo: {
        validIn,
        tolerance,
        clockSkew,
        issue: 'NOT_YET_VALID'
      }
    };
  }

  // CRITICAL: Check if expiration is unreasonably far in the future
  // Shopify session tokens typically expire within 60 seconds
  // But during development/testing, they may have longer lifetimes
  const maxReasonableExpiry = 3600; // 1 hour max for normal operations
  const maxExtendedExpiry = 86400; // 24 hours for extended sessions

  // Only reject if token expires more than 24 hours in the future
  if (timeUntilExpiry > maxExtendedExpiry) {
    const hoursUntilExpiry = Math.round(timeUntilExpiry / 3600);
    const daysUntilExpiry = Math.round(timeUntilExpiry / (24 * 3600));

    console.error('[Timestamp Recovery] 🚨 CRITICAL: Token expiration unreasonably far in future');
    console.error('[Timestamp Recovery] Token expires in:', {
      seconds: timeUntilExpiry,
      hours: hoursUntilExpiry,
      days: daysUntilExpiry,
      expectedMaxSeconds: maxReasonableExpiry,
      maxExtendedSeconds: maxExtendedExpiry
    });

    // Check if this looks like a millisecond/second confusion (common bug)
    const possibleCorrectExp = Math.floor(payload.exp / 1000);
    const possibleTimeUntilExpiry = possibleCorrectExp - now;
    const isLikelyMillisecondIssue = possibleTimeUntilExpiry > -300 && possibleTimeUntilExpiry < 600;

    return {
      valid: false,
      error: `Token expiration ${daysUntilExpiry} days in future - invalid session token`,
      severity: 'CRITICAL',
      recoveryAction: 'FORCE_REFRESH',
      debugInfo: {
        issue: 'FUTURE_EXPIRATION_EXTREME',
        timeUntilExpiry,
        hoursUntilExpiry,
        daysUntilExpiry,
        tokenExp: payload.exp,
        tokenExpISO: new Date(payload.exp * 1000).toISOString(),
        currentTime: now,
        currentTimeISO: new Date(now * 1000).toISOString(),
        maxReasonableExpiry,
        maxExtendedExpiry,
        possibleCauses: [
          isLikelyMillisecondIssue ? 'Token timestamp in milliseconds instead of seconds' : null,
          'Token generation bug',
          'Malformed token',
          'Security issue - token lifetime too long'
        ].filter(Boolean),
        isLikelyMillisecondIssue,
        possibleCorrectExp: isLikelyMillisecondIssue ? possibleCorrectExp : undefined
      }
    };
  }

  // Warn if token has extended lifetime but allow it
  if (timeUntilExpiry > maxReasonableExpiry) {
    console.warn('[Timestamp Recovery] ⚠️ Token has extended lifetime:', {
      timeUntilExpiry,
      hoursUntilExpiry: Math.round(timeUntilExpiry / 3600),
      maxNormalExpiry: maxReasonableExpiry
    });
  }

  // Token is valid - check if it needs refresh soon
  const needsRefreshSoon = timeUntilExpiry < 120; // < 2 minutes until expiry
  const shouldRefresh = timeUntilExpiry < 300; // < 5 minutes until expiry

  if (needsRefreshSoon) {
    console.log('[Timestamp Recovery] ⚠️ Token expires soon, flagging for refresh');
  }

  return {
    valid: true,
    shouldRefresh,
    timeUntilExpiry,
    debugInfo: {
      clockSkew,
      tolerance,
      timeUntilExpiry,
      timeUntilExpiryMinutes: Math.round(timeUntilExpiry / 60),
      needsRefreshSoon,
      shouldRefresh,
      deviceType: isIOSDevice ? 'iOS' : 'Other',
      validationResult: 'VALID'
    }
  };
}

/**
 * Determine appropriate clock skew tolerance based on device and scenario
 */
function determineClockSkewTolerance(request?: Request, clockSkew?: number): number {
  const userAgent = request?.headers?.get('User-Agent') || '';
  const isIOSDevice = detectIOSDevice(userAgent);
  const isPOSExtension = userAgent.includes('Shopify POS') || userAgent.includes('ExtensibilityHost');

  // Base tolerances
  const STANDARD_TOLERANCE = 300; // 5 minutes
  const IOS_TOLERANCE = 900; // 15 minutes for iOS devices
  const EXTREME_TOLERANCE = 3600; // 1 hour for extreme scenarios

  // For POS extensions on iOS, use higher tolerance
  if (isPOSExtension && isIOSDevice) {
    // If clock skew is extremely high, allow higher tolerance
    if (clockSkew && Math.abs(clockSkew) > IOS_TOLERANCE) {
      console.warn('[Timestamp Recovery] Using extreme tolerance for iOS POS extension');
      return EXTREME_TOLERANCE;
    }
    return IOS_TOLERANCE;
  }

  // For regular iOS devices
  if (isIOSDevice) {
    return IOS_TOLERANCE;
  }

  // Standard tolerance for other devices
  return STANDARD_TOLERANCE;
}

/**
 * Detect iOS devices from user agent
 */
function detectIOSDevice(userAgent: string): boolean {
  return userAgent.includes('iPhone') ||
         userAgent.includes('iPad') ||
         userAgent.includes('iPod') ||
         (userAgent.includes('Safari') && userAgent.includes('Mobile'));
}

/**
 * Calculate recommended refresh time based on token expiry
 */
function calculateRefreshTime(tokenExp: number, currentTime: number): number {
  const expiredBy = currentTime - tokenExp;

  if (expiredBy < 0) {
    // Token not yet expired
    return Math.abs(expiredBy);
  }

  // Token is expired - return how long ago it expired
  return expiredBy;
}

/**
 * Create recovery response based on validation result
 */
export function createTimestampRecoveryResponse(
  validationResult: TimestampValidationResult,
  additionalContext?: any
) {
  if (validationResult.valid) {
    return {
      success: true,
      timestamp: {
        valid: true,
        shouldRefresh: validationResult.shouldRefresh || false,
        timeUntilExpiry: validationResult.timeUntilExpiry,
        debugInfo: validationResult.debugInfo
      },
      ...additionalContext
    };
  }

  return {
    success: false,
    error: 'Timestamp validation failed',
    details: validationResult.error,
    severity: validationResult.severity,
    recoveryAction: validationResult.recoveryAction,
    timestamp: {
      valid: false,
      debugInfo: validationResult.debugInfo
    },
    solutions: getTimestampTroubleshootingSolutions(validationResult),
    ...additionalContext
  };
}

/**
 * Get troubleshooting solutions based on validation result
 */
function getTimestampTroubleshootingSolutions(result: TimestampValidationResult): string[] {
  const issue = result.debugInfo?.issue;

  switch (issue) {
    case 'MALFORMED_TIMESTAMP':
    case 'FUTURE_TIMESTAMP_EXTREME':
      return [
        '🚨 CRITICAL TIMESTAMP ISSUE DETECTED:',
        'This indicates a fundamental system clock or token generation problem.',
        '',
        '🔧 IMMEDIATE TROUBLESHOOTING:',
        '1. Check system clock synchronization on all servers',
        '2. Verify timezone settings are correct',
        '3. Check for daylight saving time transition issues',
        '4. Restart the application to clear any cached timestamps',
        '5. Contact Shopify support if issue persists with fresh tokens'
      ];

    case 'SEVERELY_EXPIRED':
      return [
        '⏰ TOKEN SEVERELY EXPIRED:',
        'The session token expired hours ago and needs immediate refresh.',
        '',
        '🔄 RECOVERY ACTIONS:',
        '1. Force session token refresh using App Bridge',
        '2. Clear any cached or stored tokens',
        '3. Ensure app is fetching fresh tokens before each request',
        '4. Check for token storage issues preventing refresh'
      ];

    case 'EXPIRED_BEYOND_TOLERANCE':
      return [
        '⚠️ TOKEN EXPIRED:',
        'Session token expired beyond acceptable tolerance.',
        '',
        '🔄 RECOMMENDED ACTIONS:',
        '1. Use session token bounce to get fresh token',
        '2. Implement proactive token refresh (< 5 minutes before expiry)',
        '3. Check App Bridge session token acquisition patterns'
      ];

    case 'NOT_YET_VALID':
      return [
        '🕐 TOKEN NOT YET VALID:',
        'Token has future timestamp - check clock synchronization.',
        '',
        '🔧 TROUBLESHOOTING:',
        '1. Check system clock synchronization',
        '2. Verify timezone settings',
        '3. Wait for token to become valid or request new token'
      ];

    default:
      return [
        '❓ TIMESTAMP VALIDATION ISSUE:',
        'Unknown timestamp validation problem detected.',
        '',
        '🔧 GENERAL TROUBLESHOOTING:',
        '1. Check system clock synchronization',
        '2. Verify token freshness',
        '3. Use session token bounce for recovery'
      ];
  }
}