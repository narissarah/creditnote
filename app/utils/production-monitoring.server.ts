/**
 * Production Monitoring and Error Tracking for Shopify 2025-07 App
 * Provides comprehensive logging and error tracking for Vercel serverless deployment
 */

export interface ErrorContext {
  userId?: string;
  shop?: string;
  sessionId?: string;
  route?: string;
  userAgent?: string;
  timestamp: string;
  environment: string;
}

export interface ProductionError {
  error: Error | string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
}

/**
 * Log production errors with context for easier debugging
 */
export function logProductionError(productionError: ProductionError) {
  const { error, context, severity, tags } = productionError;

  const errorMessage = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  const logEntry = {
    timestamp: context.timestamp,
    level: severity,
    message: errorMessage,
    stack,
    context: {
      shop: context.shop,
      userId: context.userId,
      sessionId: context.sessionId,
      route: context.route,
      userAgent: context.userAgent?.substring(0, 100),
      environment: context.environment
    },
    tags,
    source: 'shopify-app'
  };

  // Console logging for Vercel function logs
  console.error(`[PRODUCTION ERROR] [${severity.toUpperCase()}]`, JSON.stringify(logEntry, null, 2));

  // Future: Send to external monitoring service
  // await sendToMonitoringService(logEntry);
}

/**
 * Track authentication failures with detailed context
 */
export function trackAuthenticationFailure(request: Request, error: Error | string, authMethod?: string) {
  const url = new URL(request.url);

  logProductionError({
    error,
    context: {
      route: url.pathname,
      userAgent: request.headers.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    },
    severity: 'high',
    tags: ['authentication', 'failure', authMethod || 'unknown'].filter(Boolean)
  });
}

/**
 * Track API errors with request context
 */
export function trackAPIError(request: Request, error: Error | string, endpoint: string) {
  const url = new URL(request.url);

  logProductionError({
    error,
    context: {
      route: endpoint,
      userAgent: request.headers.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    },
    severity: 'medium',
    tags: ['api', 'error', endpoint]
  });
}

/**
 * Track session token issues
 */
export function trackSessionTokenIssue(request: Request, issue: string, tokenLength?: number) {
  const url = new URL(request.url);

  logProductionError({
    error: `Session token issue: ${issue}`,
    context: {
      route: url.pathname,
      userAgent: request.headers.get('User-Agent') || 'unknown',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    },
    severity: 'high',
    tags: ['session', 'token', 'issue', `length:${tokenLength || 0}`]
  });
}

/**
 * Track bot requests that bypass authentication
 */
export function trackBotRequest(request: Request, reason: string) {
  const url = new URL(request.url);

  // Lower severity logging for bot requests to avoid noise
  console.log(`[BOT REQUEST] ${url.pathname} - ${reason}`, {
    userAgent: request.headers.get('User-Agent')?.substring(0, 100),
    timestamp: new Date().toISOString()
  });
}

/**
 * Track successful operations for monitoring health
 */
export function trackSuccess(operation: string, context: Partial<ErrorContext> = {}) {
  console.log(`[SUCCESS] ${operation}`, {
    timestamp: new Date().toISOString(),
    shop: context.shop,
    route: context.route,
    environment: process.env.NODE_ENV || 'unknown'
  });
}

/**
 * Monitor performance metrics
 */
export function trackPerformance(operation: string, duration: number, context: Partial<ErrorContext> = {}) {
  console.log(`[PERFORMANCE] ${operation} took ${duration}ms`, {
    timestamp: new Date().toISOString(),
    duration,
    shop: context.shop,
    route: context.route,
    environment: process.env.NODE_ENV || 'unknown'
  });
}

/**
 * Create error context from request
 */
export function createErrorContext(
  request: Request,
  additionalContext: Partial<ErrorContext> = {}
): ErrorContext {
  const url = new URL(request.url);

  return {
    route: url.pathname,
    userAgent: request.headers.get('User-Agent') || 'unknown',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    ...additionalContext
  };
}