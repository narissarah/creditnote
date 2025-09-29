/**
 * Advanced Error Handling Patterns for Shopify 2025-07 App
 * Implements comprehensive error classification, recovery strategies, and monitoring
 * Based on: https://shopify.dev/docs/apps/best-practices/error-handling
 */

import { json } from "@remix-run/node";
import { logProductionError, createErrorContext } from "./production-monitoring.server";

export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  SHOPIFY_API = 'SHOPIFY_API',
  DATABASE = 'DATABASE',
  CONFIGURATION = 'CONFIGURATION',
  POS_INTEGRATION = 'POS_INTEGRATION',
  SESSION_MANAGEMENT = 'SESSION_MANAGEMENT',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AppError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  userMessage: string;
  details: any;
  suggestions: string[];
  isRetryable: boolean;
  retryAfter?: number;
  timestamp: string;
  context?: any;
}

export interface ErrorRecoveryResult {
  success: boolean;
  response?: Response;
  error?: AppError;
  recoveryAction?: string;
}

/**
 * Enhanced error factory for creating standardized errors
 */
export class AppErrorFactory {
  static createAuthenticationError(details: any, context?: any): AppError {
    return {
      category: ErrorCategory.AUTHENTICATION,
      severity: ErrorSeverity.HIGH,
      code: 'AUTH_FAILED',
      message: 'Authentication failed',
      userMessage: 'Please sign in again to continue',
      details,
      suggestions: [
        'Refresh the page and try again',
        'Clear your browser cache and cookies',
        'Ensure you are logged into Shopify Admin',
        'Contact support if the issue persists'
      ],
      isRetryable: true,
      retryAfter: 5000,
      timestamp: new Date().toISOString(),
      context
    };
  }

  static createShopifyAPIError(status: number, response: any, context?: any): AppError {
    const isRateLimit = status === 429;
    const isServerError = status >= 500;

    return {
      category: ErrorCategory.SHOPIFY_API,
      severity: isServerError ? ErrorSeverity.CRITICAL : ErrorSeverity.MEDIUM,
      code: isRateLimit ? 'API_RATE_LIMIT' : `API_ERROR_${status}`,
      message: `Shopify API error: ${status}`,
      userMessage: isRateLimit
        ? 'Too many requests. Please wait a moment and try again.'
        : isServerError
          ? 'Shopify is experiencing issues. Please try again later.'
          : 'There was an issue with your request. Please try again.',
      details: { status, response, isRateLimit, isServerError },
      suggestions: [
        ...(isRateLimit ? ['Wait 60 seconds before retrying'] : []),
        ...(isServerError ? ['Check Shopify status page', 'Try again in a few minutes'] : []),
        'Refresh the page',
        'Contact support if issue persists'
      ],
      isRetryable: true,
      retryAfter: isRateLimit ? 60000 : 5000,
      timestamp: new Date().toISOString(),
      context
    };
  }

  static createValidationError(field: string, value: any, rule: string, context?: any): AppError {
    return {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.LOW,
      code: 'VALIDATION_FAILED',
      message: `Validation failed for field: ${field}`,
      userMessage: `Please check the ${field} field and try again`,
      details: { field, value, rule, validation: 'failed' },
      suggestions: [
        `Ensure ${field} follows the required format`,
        'Check for typos or invalid characters',
        'Review the field requirements',
        'Contact support if you need help'
      ],
      isRetryable: true,
      timestamp: new Date().toISOString(),
      context
    };
  }

  static createPOSIntegrationError(operation: string, details: any, context?: any): AppError {
    return {
      category: ErrorCategory.POS_INTEGRATION,
      severity: ErrorSeverity.MEDIUM,
      code: 'POS_INTEGRATION_FAILED',
      message: `POS integration failed: ${operation}`,
      userMessage: 'There was an issue with the POS system. Please try again.',
      details: { operation, ...details },
      suggestions: [
        'Ensure POS device is connected and online',
        'Check your POS app permissions',
        'Restart the POS application',
        'Contact support if the issue continues'
      ],
      isRetryable: true,
      retryAfter: 3000,
      timestamp: new Date().toISOString(),
      context
    };
  }

  static createDatabaseError(operation: string, sqlError: any, context?: any): AppError {
    const isConnectionError = sqlError?.code === 'ECONNREFUSED' || sqlError?.code === 'ETIMEDOUT';

    return {
      category: ErrorCategory.DATABASE,
      severity: isConnectionError ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
      code: isConnectionError ? 'DB_CONNECTION_FAILED' : 'DB_OPERATION_FAILED',
      message: `Database ${operation} failed`,
      userMessage: 'We are experiencing technical difficulties. Please try again.',
      details: { operation, sqlError: sqlError?.message, isConnectionError },
      suggestions: [
        'Try again in a few moments',
        'Refresh the page',
        'Contact support if the issue persists',
        ...(isConnectionError ? ['Check your internet connection'] : [])
      ],
      isRetryable: true,
      retryAfter: isConnectionError ? 10000 : 5000,
      timestamp: new Date().toISOString(),
      context
    };
  }

  static createConfigurationError(setting: string, details: any, context?: any): AppError {
    return {
      category: ErrorCategory.CONFIGURATION,
      severity: ErrorSeverity.CRITICAL,
      code: 'CONFIG_ERROR',
      message: `Configuration error: ${setting}`,
      userMessage: 'The application is not properly configured. Please contact support.',
      details: { setting, ...details },
      suggestions: [
        'Contact your system administrator',
        'Check environment variables',
        'Verify app installation',
        'Contact support for assistance'
      ],
      isRetryable: false,
      timestamp: new Date().toISOString(),
      context
    };
  }
}

/**
 * Advanced error recovery strategies
 */
export class ErrorRecoveryManager {
  /**
   * Attempt to recover from an error with appropriate strategy
   */
  static async attemptRecovery(error: AppError, request: Request): Promise<ErrorRecoveryResult> {
    console.log('[ERROR RECOVERY] Attempting recovery for:', error.category);

    try {
      switch (error.category) {
        case ErrorCategory.AUTHENTICATION:
          return await this.recoverAuthentication(error, request);

        case ErrorCategory.SHOPIFY_API:
          return await this.recoverShopifyAPI(error, request);

        case ErrorCategory.DATABASE:
          return await this.recoverDatabase(error, request);

        case ErrorCategory.POS_INTEGRATION:
          return await this.recoverPOSIntegration(error, request);

        default:
          return { success: false, error, recoveryAction: 'no_recovery_strategy' };
      }
    } catch (recoveryError) {
      console.error('[ERROR RECOVERY] Recovery attempt failed:', recoveryError);
      return {
        success: false,
        error,
        recoveryAction: 'recovery_failed'
      };
    }
  }

  private static async recoverAuthentication(error: AppError, request: Request): Promise<ErrorRecoveryResult> {
    // For authentication errors, redirect to auth flow
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');

    const authUrl = shop
      ? `/auth?shop=${encodeURIComponent(shop)}`
      : '/auth';

    return {
      success: true,
      response: new Response(null, {
        status: 302,
        headers: { 'Location': authUrl }
      }),
      recoveryAction: 'redirect_to_auth'
    };
  }

  private static async recoverShopifyAPI(error: AppError, request: Request): Promise<ErrorRecoveryResult> {
    // For rate limits, return 429 with retry header
    if (error.code === 'API_RATE_LIMIT') {
      return {
        success: true,
        response: json(
          {
            error: 'Rate limit exceeded',
            message: error.userMessage,
            retryAfter: error.retryAfter,
            suggestions: error.suggestions
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((error.retryAfter || 60000) / 1000)),
              'X-RateLimit-Reset': String(Date.now() + (error.retryAfter || 60000))
            }
          }
        ),
        recoveryAction: 'rate_limit_response'
      };
    }

    return { success: false, error, recoveryAction: 'no_api_recovery' };
  }

  private static async recoverDatabase(error: AppError, request: Request): Promise<ErrorRecoveryResult> {
    // For connection errors, return service unavailable
    if (error.code === 'DB_CONNECTION_FAILED') {
      return {
        success: true,
        response: json(
          {
            error: 'Service temporarily unavailable',
            message: error.userMessage,
            retryAfter: error.retryAfter,
            suggestions: error.suggestions
          },
          {
            status: 503,
            headers: {
              'Retry-After': String(Math.ceil((error.retryAfter || 10000) / 1000))
            }
          }
        ),
        recoveryAction: 'service_unavailable'
      };
    }

    return { success: false, error, recoveryAction: 'no_db_recovery' };
  }

  private static async recoverPOSIntegration(error: AppError, request: Request): Promise<ErrorRecoveryResult> {
    // For POS errors, return helpful error response
    return {
      success: true,
      response: json(
        {
          error: 'POS Integration Error',
          message: error.userMessage,
          suggestions: error.suggestions,
          details: error.details
        },
        { status: 503 }
      ),
      recoveryAction: 'pos_error_response'
    };
  }
}

/**
 * Enhanced error response utility
 */
export function createErrorResponse(error: AppError, request: Request): Response {
  // Log the error for monitoring
  logProductionError({
    error: error.message,
    context: createErrorContext(request, {
      errorCode: error.code,
      errorCategory: error.category,
      shop: error.context?.shop
    }),
    severity: error.severity,
    tags: [error.category, error.code, 'error_response']
  });

  // CRITICAL FIX: For loader errors, return loader-compatible data structure
  // This prevents "Missing API key" errors when authentication fails
  if (request.url.includes('/app') && !request.url.includes('/api/')) {
    console.log('[ERROR HANDLER] Returning loader-compatible error response for app route');

    // Get API key with fallback (matching validateEnvironmentConfig pattern)
    const apiKey = process.env.SHOPIFY_API_KEY || "3e0a90c9ecdf9a085dfc7bd1c1c5fa6e";

    return json({
      // Required loader data for AppProvider
      apiKey: apiKey,
      shop: error.context?.shop || "error.myshopify.com",
      host: btoa((error.context?.shop || "error") + ".myshopify.com/admin"),

      // Error information for component to handle
      error: error.message,
      errorDetails: {
        code: error.code,
        category: error.category,
        userMessage: error.userMessage,
        suggestions: error.suggestions,
        isRetryable: error.isRetryable,
        retryAfter: error.retryAfter,
        timestamp: error.timestamp
      }
    });
  }

  // For API routes, return standard JSON error response
  const status = getStatusCodeForError(error);
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });

  // Add retry headers for retryable errors
  if (error.isRetryable && error.retryAfter) {
    headers.set('Retry-After', String(Math.ceil(error.retryAfter / 1000)));
  }

  return json(
    {
      error: error.message,
      userMessage: error.userMessage,
      code: error.code,
      category: error.category,
      suggestions: error.suggestions,
      isRetryable: error.isRetryable,
      retryAfter: error.retryAfter,
      timestamp: error.timestamp,
      ...(process.env.NODE_ENV === 'development' ? { details: error.details } : {})
    },
    { status, headers }
  );
}

/**
 * Map error categories to appropriate HTTP status codes
 */
function getStatusCodeForError(error: AppError): number {
  switch (error.category) {
    case ErrorCategory.AUTHENTICATION:
      return 401;
    case ErrorCategory.AUTHORIZATION:
      return 403;
    case ErrorCategory.VALIDATION:
      return 400;
    case ErrorCategory.SHOPIFY_API:
      return error.code === 'API_RATE_LIMIT' ? 429 : 502;
    case ErrorCategory.DATABASE:
      return error.code === 'DB_CONNECTION_FAILED' ? 503 : 500;
    case ErrorCategory.CONFIGURATION:
      return 500;
    case ErrorCategory.POS_INTEGRATION:
      return 503;
    case ErrorCategory.SESSION_MANAGEMENT:
      return 401;
    default:
      return 500;
  }
}

/**
 * Centralized error handler for route loaders and actions
 */
export async function handleRouteError(error: any, request: Request): Promise<Response> {
  console.error('[ROUTE ERROR] Handling error:', error);

  let appError: AppError;

  // Convert various error types to AppError
  if (error instanceof Error) {
    if (error.name === 'ValidationError') {
      appError = AppErrorFactory.createValidationError('unknown', error.message, 'validation');
    } else if (error.message.includes('authentication')) {
      appError = AppErrorFactory.createAuthenticationError({ originalError: error.message });
    } else if (error.message.includes('database') || error.message.includes('prisma')) {
      appError = AppErrorFactory.createDatabaseError('query', error);
    } else {
      appError = {
        category: ErrorCategory.UNKNOWN,
        severity: ErrorSeverity.MEDIUM,
        code: 'UNKNOWN_ERROR',
        message: error.message,
        userMessage: 'An unexpected error occurred. Please try again.',
        details: { originalError: error.message, stack: error.stack },
        suggestions: [
          'Refresh the page and try again',
          'Contact support if the issue persists'
        ],
        isRetryable: true,
        timestamp: new Date().toISOString()
      };
    }
  } else {
    appError = {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.LOW,
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      userMessage: 'Something went wrong. Please try again.',
      details: { error },
      suggestions: ['Refresh the page and try again'],
      isRetryable: true,
      timestamp: new Date().toISOString()
    };
  }

  // Attempt recovery
  const recoveryResult = await ErrorRecoveryManager.attemptRecovery(appError, request);

  if (recoveryResult.success && recoveryResult.response) {
    console.log('[ROUTE ERROR] Recovery successful:', recoveryResult.recoveryAction);
    return recoveryResult.response;
  }

  // Return standard error response
  return createErrorResponse(appError, request);
}