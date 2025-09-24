import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { detectBot } from "../utils/bot-detection.server";

/**
 * Debug route to test bot detection logic
 * Accessible at: /debug/bot-detection
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const userAgent = request.headers.get("User-Agent") || "";

  const botDetection = detectBot(request);

  const debugInfo = {
    timestamp: new Date().toISOString(),
    request: {
      url: url.toString(),
      method: request.method,
      userAgent,
      origin: request.headers.get("Origin"),
      referer: request.headers.get("Referer"),
      host: request.headers.get("Host"),
      xForwardedFor: request.headers.get("X-Forwarded-For"),
      xRealIp: request.headers.get("X-Real-IP")
    },
    botDetection: {
      isBot: botDetection.isBot,
      botType: botDetection.botType,
      shouldBypass: botDetection.shouldBypass,
      recommendation: botDetection.shouldBypass
        ? "Would return 503 Service Unavailable"
        : botDetection.isBot
          ? "Would return 410 Gone"
          : "Would proceed with normal authentication"
    },
    authenticationFlow: {
      wouldAuthenticate: !botDetection.isBot,
      expectedBehavior: botDetection.isBot
        ? (botDetection.shouldBypass ? "Bypass auth with 503" : "Block with 410")
        : "Normal Shopify authentication"
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      shopifyApiKey: !!process.env.SHOPIFY_API_KEY,
      shopifyAppUrl: process.env.SHOPIFY_APP_URL,
      isProduction: process.env.NODE_ENV === "production"
    }
  };

  return json(debugInfo, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Debug-Route": "bot-detection"
    }
  });
};