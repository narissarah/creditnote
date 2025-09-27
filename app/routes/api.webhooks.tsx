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

    // Use Shopify's built-in webhook authentication (2025-07 compliant)
    const { topic, shop, session, payload } = await authenticate.webhook(request);

    console.log(`[WEBHOOK] ✅ Authentication successful:`, {
      topic,
      shop,
      hasSession: !!session,
      payloadSize: payload ? JSON.stringify(payload).length : 0
    });

    console.log(`[WEBHOOK] Processing ${topic} webhook for shop ${shop}`);

    // Handle different webhook topics with enhanced 2025-07 support
    switch (topic) {
      case "APP_UNINSTALLED":
        console.log(`[WEBHOOK] App uninstalled for shop: ${shop}`);
        // Clean up shop/session data here if needed
        // session may be undefined if the app is already uninstalled
        break;

      case "CUSTOMERS_DATA_REQUEST":
      case "CUSTOMERS_REDACT":
      case "SHOP_REDACT":
        console.log(`[WEBHOOK] GDPR webhook received: ${topic}`);
        // Handle GDPR compliance webhooks
        break;

      case "ORDERS_CREATE":
      case "ORDERS_UPDATED":
        console.log(`[WEBHOOK] Order webhook received: ${topic}`);
        // Handle order-related webhooks for credit note integration
        break;

      case "CUSTOMERS_CREATE":
      case "CUSTOMERS_UPDATE":
        console.log(`[WEBHOOK] Customer webhook received: ${topic}`);
        // Handle customer-related webhooks for credit note system
        break;

      default:
        console.log(`[WEBHOOK] Unhandled webhook topic: ${topic}`);
    }

    return json({
      received: true,
      topic,
      shop,
      processed_via: 'authenticated_handler'
    }, { status: 200 });

  } catch (error) {
    console.error("[WEBHOOK] Authentication or processing failed:", error);

    // For webhook authentication failures, return 401
    if (error instanceof Response) {
      return error;
    }

    return json({
      error: "Webhook verification failed",
      details: "Could not verify webhook authenticity"
    }, { status: 401 });
  }
};

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "https://admin.shopify.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Shopify-Topic, X-Shopify-Hmac-Sha256, X-Shopify-Shop-Domain, X-Shopify-API-Version",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    },
  });
}