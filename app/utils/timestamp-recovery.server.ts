/**
 * Timestamp Recovery and Validation Utilities
 * Handles timestamp validation with clock skew tolerance for iOS and other devices
 */

export interface TimestampValidationResult {
  valid: boolean;
  error?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  recoveryAction?: string;
  shouldRefresh?: boolean;
  timeUntilExpiry?: number;
  debugInfo?: {
    exp?: number;
    nbf?: number;
    iat?: number;
    now?: number;
    clockSkew?: number;
  };
}

/**
 * Validates JWT timestamps with iOS-friendly clock skew tolerance
 */
export function validateTimestampsWithRecovery(
  payload: { exp: number; nbf: number; iat: number },
  request?: Request
): TimestampValidationResult {
  const now = Math.floor(Date.now() / 1000);

  // Enhanced clock skew tolerance for iOS devices (5 minutes)
  const CLOCK_SKEW_TOLERANCE = 300; // 5 minutes in seconds

  // Check if iOS device for enhanced tolerance
  const userAgent = request?.headers?.get('User-Agent') || '';
  const isIOSDevice = userAgent.includes('iPhone') ||
                     userAgent.includes('iPad') ||
                     userAgent.includes('iPod') ||
                     userAgent.includes('iOS');

  const clockSkew = isIOSDevice ? CLOCK_SKEW_TOLERANCE : 60; // 5 min for iOS, 1 min for others

  // Check token expiration
  if (payload.exp < (now - clockSkew)) {
    return {
      valid: false,
      error: 'Token has expired',
      severity: 'high',
      recoveryAction: 'REFRESH_TOKEN',
      shouldRefresh: true,
      debugInfo: {
        exp: payload.exp,
        nbf: payload.nbf,
        iat: payload.iat,
        now,
        clockSkew
      }
    };
  }

  // Check not before time
  if (payload.nbf > (now + clockSkew)) {
    return {
      valid: false,
      error: 'Token not yet valid',
      severity: 'medium',
      recoveryAction: 'WAIT_OR_REFRESH',
      shouldRefresh: false,
      debugInfo: {
        exp: payload.exp,
        nbf: payload.nbf,
        iat: payload.iat,
        now,
        clockSkew
      }
    };
  }

  // Check if token will expire soon (within 5 minutes)
  const timeUntilExpiry = payload.exp - now;
  const shouldRefresh = timeUntilExpiry < 300; // Less than 5 minutes

  return {
    valid: true,
    shouldRefresh,
    timeUntilExpiry,
    severity: shouldRefresh ? 'low' : undefined,
    recoveryAction: shouldRefresh ? 'REFRESH_SOON' : undefined,
    debugInfo: {
      exp: payload.exp,
      nbf: payload.nbf,
      iat: payload.iat,
      now,
      clockSkew
    }
  };
}

/**
 * Creates a standardized response for timestamp validation errors
 */
export function createTimestampRecoveryResponse(validation: TimestampValidationResult) {
  return {
    action: validation.recoveryAction,
    severity: validation.severity,
    shouldRefresh: validation.shouldRefresh,
    message: validation.error || 'Timestamp validation completed',
    recommendations: getRecoveryRecommendations(validation)
  };
}

/**
 * Get recovery recommendations based on validation result
 */
function getRecoveryRecommendations(validation: TimestampValidationResult): string[] {
  const recommendations: string[] = [];

  if (validation.recoveryAction === 'REFRESH_TOKEN') {
    recommendations.push('Request a new session token');
    recommendations.push('Use session token bounce page');
    recommendations.push('Ensure clock synchronization');
  }

  if (validation.recoveryAction === 'WAIT_OR_REFRESH') {
    recommendations.push('Wait a few moments and retry');
    recommendations.push('Check device clock settings');
    recommendations.push('Sync device time with network');
  }

  if (validation.recoveryAction === 'REFRESH_SOON') {
    recommendations.push('Proactively refresh token before expiry');
    recommendations.push('Consider implementing token refresh background task');
  }

  return recommendations;
}
