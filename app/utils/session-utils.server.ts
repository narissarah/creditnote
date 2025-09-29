/**
 * Session Utilities for Enhanced Authentication
 *
 * Provides convenient utilities for working with the Enhanced Session Token Manager
 * and integrating it with existing Shopify app patterns.
 */

import enhancedSessionManager from './enhanced-session-token-manager.server';
import type { ValidatedSessionResult } from './token-exchange-2025-07.server';
import type { SessionCacheStats } from './enhanced-session-token-manager.server';

/**
 * Get validated session with enhanced caching and performance optimization
 */
export async function getValidatedSession(sessionToken: string, request?: Request): Promise<ValidatedSessionResult> {
  return enhancedSessionManager.getValidatedSession(sessionToken, request);
}

/**
 * Get session manager statistics for monitoring and debugging
 */
export function getSessionStats(): SessionCacheStats & { cacheSize: number; validationCacheSize: number } {
  return enhancedSessionManager.getStats();
}

/**
 * Clear session cache (useful for testing or memory management)
 */
export function clearSessionCache(): void {
  enhancedSessionManager.clearCache();
}

/**
 * Check if session token is likely to expire soon
 */
export function isSessionTokenExpiringSoon(sessionToken: string, thresholdMinutes: number = 5): boolean {
  try {
    // Simple JWT payload extraction without full validation
    const parts = sessionToken.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - now;

    return timeUntilExpiry <= (thresholdMinutes * 60);
  } catch (error) {
    console.warn('[Session Utils] Failed to check token expiration:', error);
    return false;
  }
}

/**
 * Extract shop domain from session token without full validation
 */
export function extractShopFromToken(sessionToken: string): string | null {
  try {
    const parts = sessionToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

    // Try destination first, then issuer
    const candidates = [payload.dest, payload.iss];

    for (const candidate of candidates) {
      if (candidate) {
        if (candidate.startsWith('https://')) {
          try {
            const url = new URL(candidate);
            return url.hostname;
          } catch (e) {
            continue;
          }
        }

        if (candidate.includes('.myshopify.com')) {
          return candidate;
        }

        if (candidate.match(/^[a-zA-Z0-9\-]+$/)) {
          return `${candidate}.myshopify.com`;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn('[Session Utils] Failed to extract shop from token:', error);
    return null;
  }
}

/**
 * Create session health report for monitoring
 */
export interface SessionHealthReport {
  healthy: boolean;
  cachePerformance: {
    hitRate: number;
    totalRequests: number;
    cacheSize: number;
  };
  issues: string[];
  recommendations: string[];
  stats: SessionCacheStats & { cacheSize: number; validationCacheSize: number };
}

export function generateSessionHealthReport(): SessionHealthReport {
  const stats = enhancedSessionManager.getStats();
  const totalRequests = stats.cacheHits + stats.cacheMisses;
  const hitRate = totalRequests > 0 ? (stats.cacheHits / totalRequests) * 100 : 0;

  const issues: string[] = [];
  const recommendations: string[] = [];
  let healthy = true;

  // Check cache hit rate
  if (totalRequests > 100 && hitRate < 50) {
    issues.push(`Low cache hit rate: ${hitRate.toFixed(1)}%`);
    recommendations.push('Consider adjusting cache timeout settings');
    healthy = false;
  }

  // Check for high expiration rate
  if (stats.expiredSessions > (stats.validSessions * 0.3)) {
    issues.push(`High token expiration rate: ${stats.expiredSessions} expired vs ${stats.validSessions} valid`);
    recommendations.push('Consider enabling proactive token refresh');
    healthy = false;
  }

  // Check cache size utilization
  if (stats.cacheSize > 800) { // Near max cache size of 1000
    issues.push(`Cache size approaching limit: ${stats.cacheSize}/1000`);
    recommendations.push('Consider increasing max cache size or reducing cache timeout');
  }

  // Check validation performance
  if (stats.validationCalls > (stats.totalSessions * 2)) {
    issues.push(`High validation overhead: ${stats.validationCalls} validations for ${stats.totalSessions} sessions`);
    recommendations.push('Validation caching may not be working optimally');
  }

  return {
    healthy,
    cachePerformance: {
      hitRate,
      totalRequests,
      cacheSize: stats.cacheSize
    },
    issues,
    recommendations,
    stats
  };
}

/**
 * Enhanced session token validation with performance metrics
 */
export async function validateSessionWithMetrics(sessionToken: string, request?: Request): Promise<{
  result: ValidatedSessionResult;
  metrics: {
    validationTime: number;
    fromCache: boolean;
    cacheStats: SessionCacheStats & { cacheSize: number; validationCacheSize: number };
  };
}> {
  const startTime = Date.now();

  const result = await enhancedSessionManager.getValidatedSession(sessionToken, request);

  const validationTime = Date.now() - startTime;
  const fromCache = result.debugInfo?.fromCache || false;
  const cacheStats = enhancedSessionManager.getStats();

  return {
    result,
    metrics: {
      validationTime,
      fromCache,
      cacheStats
    }
  };
}

/**
 * Batch validate multiple session tokens (useful for high-load scenarios)
 */
export async function batchValidateSessions(
  sessionTokens: { token: string; request?: Request }[]
): Promise<Array<{
  token: string;
  result: ValidatedSessionResult;
  processingTime: number;
}>> {
  const results = await Promise.allSettled(
    sessionTokens.map(async ({ token, request }) => {
      const startTime = Date.now();
      const result = await enhancedSessionManager.getValidatedSession(token, request);
      const processingTime = Date.now() - startTime;

      return {
        token,
        result,
        processingTime
      };
    })
  );

  return results
    .filter((result): result is PromiseFulfilledResult<{ token: string; result: ValidatedSessionResult; processingTime: number }> =>
      result.status === 'fulfilled')
    .map(result => result.value);
}

/**
 * Configure session manager for different deployment scenarios
 */
export function configureSessionManagerForEnvironment() {
  const config = enhancedSessionManager.getConfig();

  if (process.env.NODE_ENV === 'production') {
    // Production optimizations
    enhancedSessionManager.updateConfig({
      enablePerformanceMode: true,
      cacheTimeout: 600, // 10 minutes in production
      validationCacheTimeout: 120, // 2 minutes validation cache
      maxCacheSize: 2000, // Larger cache for production
      enableProactiveRefresh: true
    });

    console.log('[Session Utils] Configured session manager for production environment');
  } else if (process.env.NODE_ENV === 'development') {
    // Development optimizations
    enhancedSessionManager.updateConfig({
      enablePerformanceMode: false,
      cacheTimeout: 180, // 3 minutes in development
      validationCacheTimeout: 60, // 1 minute validation cache
      maxCacheSize: 500, // Smaller cache for development
      enableProactiveRefresh: false // Disable proactive refresh in dev
    });

    console.log('[Session Utils] Configured session manager for development environment');
  }

  return enhancedSessionManager.getConfig();
}

// Auto-configure on module load
configureSessionManagerForEnvironment();