import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    console.log(`[WEBHOOK] Incoming webhook request to ${request.url}`);

    const authResult = await authenticate.webhook(request);
    console.log(`[WEBHOOK] Authentication result:`, {
      hasWebhook: !!authResult?.webhook,
      hasSession: !!authResult?.session,
      webhookTopic: authResult?.webhook?.topic || 'undefined'
    });

    if (!authResult || !authResult.webhook) {
      console.warn(`[WEBHOOK] Invalid webhook authentication result`);
      return json({ error: "Invalid webhook" }, { status: 400 });
    }

    const { webhook, session } = authResult;

    if (!webhook.topic) {
      console.warn(`[WEBHOOK] Webhook missing topic property`);
      return json({ error: "Webhook missing topic" }, { status: 400 });
    }

    console.log(`[WEBHOOK] Processing ${webhook.topic} webhook for shop ${session?.shop}`);

    // Handle different webhook topics
    switch (webhook.topic) {
      case "APP_UNINSTALLED":
        console.log(`[WEBHOOK] App uninstalled for shop: ${session?.shop}`);
        // Could implement cleanup logic here if needed
        break;

      case "CUSTOMERS_DATA_REQUEST":
      case "CUSTOMERS_REDACT":
      case "SHOP_REDACT":
        console.log(`[WEBHOOK] GDPR webhook received: ${webhook.topic}`);
        // Handle GDPR compliance webhooks
        break;

      default:
        console.log(`[WEBHOOK] Unhandled webhook topic: ${webhook.topic}`);
    }

    return json({ received: true, topic: webhook.topic }, { status: 200 });

  } catch (error) {
    console.error("[WEBHOOK] Error processing webhook:", error);
    console.error("[WEBHOOK] Request details:", {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });
    return json({ error: "Webhook processing failed", details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
};