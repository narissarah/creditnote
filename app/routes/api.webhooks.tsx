import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { webhook, session } = await authenticate.webhook(request);

    console.log(`[WEBHOOK] Received ${webhook.topic} webhook for shop ${session?.shop}`);

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

    return json({ received: true }, { status: 200 });

  } catch (error) {
    console.error("[WEBHOOK] Error processing webhook:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
};