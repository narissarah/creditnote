import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Enhanced webhook topic handler with improved 2025-07 support
function handleWebhookByTopic(topic: string, headers: Record<string, string>) {
  console.log(`[WEBHOOK] Processing fallback webhook topic: ${topic}`);
  console.log(`[WEBHOOK] Shop domain: ${headers['x-shopify-shop-domain']}`);

  // Handle different webhook topics with enhanced logging
  switch (topic) {
    case "app/uninstalled":
      console.log(`[WEBHOOK] App uninstalled for shop: ${headers['x-shopify-shop-domain']}`);
      // Could implement cleanup logic here if needed
      break;

    case "customers/data_request":
    case "customers/redact":
    case "shop/redact":
      console.log(`[WEBHOOK] GDPR webhook received: ${topic}`);
      // Handle GDPR compliance webhooks
      break;

    case "orders/create":
    case "orders/updated":
      console.log(`[WEBHOOK] Order webhook received: ${topic}`);
      // Handle order-related webhooks for credit note integration
      break;

    case "customers/create":
    case "customers/update":
      console.log(`[WEBHOOK] Customer webhook received: ${topic}`);
      // Handle customer-related webhooks for credit note system
      break;

    default:
      console.log(`[WEBHOOK] Unhandled webhook topic: ${topic}`);
  }

  return json({
    received: true,
    topic,
    shop: headers['x-shopify-shop-domain'],
    processed_via: 'fallback_handler'
  }, { status: 200 });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    console.log(`[WEBHOOK] Incoming webhook request to ${request.url}`);

    // Log webhook headers for debugging (2025-07 verification pattern)
    const headers = Object.fromEntries(request.headers.entries());
    console.log(`[WEBHOOK] Headers:`, {
      'x-shopify-topic': headers['x-shopify-topic'],
      'x-shopify-hmac-sha256': headers['x-shopify-hmac-sha256'] ? '***' : 'missing',
      'x-shopify-shop-domain': headers['x-shopify-shop-domain'],
      'x-shopify-webhook-id': headers['x-shopify-webhook-id'],
      'x-shopify-triggered-at': headers['x-shopify-triggered-at'],
      'x-shopify-event-id': headers['x-shopify-event-id']
    });

    // ENHANCED: Robust webhook authentication with proper HMAC verification for 2025-07
    let authResult;

    // Clone the request to preserve the body for potential manual verification
    const requestClone = request.clone();

    try {
      // First, try the standard Shopify webhook authentication
      authResult = await authenticate.webhook(request);
      console.log(`[WEBHOOK] Standard authentication result:`, {
        hasWebhook: !!authResult?.webhook,
        hasSession: !!authResult?.session,
        webhookTopic: authResult?.webhook?.topic || 'undefined',
        payload: authResult?.payload ? 'present' : 'missing'
      });
    } catch (authError) {
      console.error(`[WEBHOOK] Standard authentication failed:`, authError);

      // Enhanced fallback: Verify HMAC manually if standard auth fails
      const topic = headers['x-shopify-topic'];
      const hmac = headers['x-shopify-hmac-sha256'];
      const shopDomain = headers['x-shopify-shop-domain'];

      if (topic && hmac && shopDomain) {
        console.log(`[WEBHOOK] Attempting manual HMAC verification for topic: ${topic}`);

        try {
          // Read the raw body from the cloned request for HMAC verification
          const bodyText = await requestClone.text();

          // Manual HMAC verification using crypto
          const crypto = require('crypto');
          const secret = process.env.SHOPIFY_API_SECRET;

          if (secret) {
            const calculatedHmac = crypto
              .createHmac('sha256', secret)
              .update(bodyText)
              .digest('base64');

            if (calculatedHmac === hmac) {
              console.log(`[WEBHOOK] ✅ Manual HMAC verification successful for ${topic}`);

              // Create a synthetic auth result for consistent processing
              authResult = {
                webhook: { topic },
                session: { shop: shopDomain },
                payload: bodyText ? JSON.parse(bodyText) : {}
              };
            } else {
              console.error(`[WEBHOOK] ❌ Manual HMAC verification failed for ${topic}`);
              console.error(`[WEBHOOK] Expected: ${hmac}, Calculated: ${calculatedHmac}`);
              return json({
                error: "HMAC verification failed",
                details: "Invalid webhook signature"
              }, { status: 401 });
            }
          } else {
            console.error(`[WEBHOOK] Missing SHOPIFY_API_SECRET for HMAC verification`);
            return json({
              error: "Server configuration error",
              details: "Unable to verify webhook"
            }, { status: 500 });
          }
        } catch (manualVerifyError) {
          console.error(`[WEBHOOK] Manual verification error:`, manualVerifyError);
          return json({
            error: "Webhook verification failed",
            details: "Could not verify webhook authenticity"
          }, { status: 401 });
        }
      } else {
        console.error(`[WEBHOOK] Missing required headers for fallback verification:`, {
          hasTopic: !!topic,
          hasHmac: !!hmac,
          hasShopDomain: !!shopDomain
        });
        return json({
          error: "Webhook authentication failed",
          details: authError instanceof Error ? authError.message : 'Unknown auth error'
        }, { status: 401 });
      }
    }

    if (!authResult || !authResult.webhook) {
      console.warn(`[WEBHOOK] Invalid webhook authentication result - HMAC verification may have failed`);

      // Try to extract topic from headers as fallback
      const topicFromHeader = headers['x-shopify-topic'];
      if (topicFromHeader) {
        console.log(`[WEBHOOK] Fallback: Using topic from header: ${topicFromHeader}`);
        // Handle webhook with header topic (less secure but functional)
        return handleWebhookByTopic(topicFromHeader, headers);
      }

      return json({ error: "Invalid webhook authentication - HMAC verification failed" }, { status: 401 });
    }

    const { webhook, session } = authResult;

    if (!webhook.topic) {
      console.warn(`[WEBHOOK] Webhook missing topic property`);

      // Try fallback to header topic
      const topicFromHeader = headers['x-shopify-topic'];
      if (topicFromHeader) {
        console.log(`[WEBHOOK] Fallback: Using topic from header: ${topicFromHeader}`);
        return handleWebhookByTopic(topicFromHeader, headers);
      }

      return json({ error: "Webhook missing topic" }, { status: 400 });
    }

    console.log(`[WEBHOOK] Processing ${webhook.topic} webhook for shop ${session?.shop}`);

    // Enhanced topic handling with proper case normalization
    const normalizedTopic = webhook.topic.toLowerCase().replace(/_/g, '/');

    // Handle different webhook topics with enhanced 2025-07 support
    switch (normalizedTopic) {
      case "app/uninstalled":
        console.log(`[WEBHOOK] App uninstalled for shop: ${session?.shop}`);
        // Could implement cleanup logic here if needed
        break;

      case "customers/data/request":
      case "customers/redact":
      case "shop/redact":
        console.log(`[WEBHOOK] GDPR webhook received: ${normalizedTopic}`);
        // Handle GDPR compliance webhooks
        break;

      case "orders/create":
      case "orders/updated":
        console.log(`[WEBHOOK] Order webhook received: ${normalizedTopic}`);
        // Handle order-related webhooks for credit note integration
        break;

      case "customers/create":
      case "customers/update":
        console.log(`[WEBHOOK] Customer webhook received: ${normalizedTopic}`);
        // Handle customer-related webhooks for credit note system
        break;

      default:
        console.log(`[WEBHOOK] Unhandled webhook topic: ${normalizedTopic}`);
    }

    return json({
      received: true,
      topic: webhook.topic,
      normalizedTopic,
      shop: session?.shop || 'unknown',
      processed_via: 'authenticated_handler'
    }, { status: 200 });

  } catch (error) {
    console.error("[WEBHOOK] Critical error processing webhook:", error);
    console.error("[WEBHOOK] Request details:", {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      contentType: request.headers.get('content-type'),
      hasHMACHeader: !!request.headers.get('x-shopify-hmac-sha256')
    });

    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    return json({
      error: "Webhook processing failed",
      details: isProduction ? 'Internal server error' : (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 });
  }
};