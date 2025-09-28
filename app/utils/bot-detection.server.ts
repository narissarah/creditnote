import { isbot } from "isbot";

/**
 * Enhanced bot detection for Shopify embedded apps
 * Handles Vercel bots and other crawlers that cause authentication issues
 */
export function detectBot(request: Request): {
  isBot: boolean;
  botType: string | null;
  shouldBypass: boolean;
} {
  const userAgent = request.headers.get("User-Agent") || "";

  // Enhanced Vercel bot detection - including all variants that cause "require is not defined" errors
  const vercelBots = [
    "vercel-screenshot",
    "vercel-favicon",
    "vercel-og-image",
    "vercel-bot",
    "vercel-screenshot/1.0",
    "vercel-favicon/1.0",
    "Vercelbot"
  ];

  // Check for Vercel bots specifically
  const isVercelBot = vercelBots.some(bot => userAgent.includes(bot));

  if (isVercelBot) {
    return {
      isBot: true,
      botType: "vercel",
      shouldBypass: true // Bypass authentication for Vercel service bots
    };
  }

  // Use isbot library for general bot detection
  const generalBot = isbot(userAgent);

  // Search engine bots should get 410 for protected routes
  const searchBots = [
    "googlebot",
    "bingbot",
    "facebookexternalhit",
    "twitterbot",
    "linkedinbot"
  ];

  const isSearchBot = searchBots.some(bot =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );

  return {
    isBot: generalBot || isSearchBot,
    botType: isSearchBot ? "search" : (generalBot ? "general" : null),
    shouldBypass: false // Search bots should get proper 410 responses
  };
}

/**
 * Enhanced authentication middleware for embedded apps
 * Handles bot detection and appropriate responses
 */
export function handleBotAuthentication(request: Request) {
  const { isBot, botType, shouldBypass } = detectBot(request);

  if (!isBot) {
    return null; // Continue with normal authentication
  }

  console.log(`[BOT DETECTION] Detected ${botType} bot:`, {
    userAgent: request.headers.get("User-Agent"),
    url: request.url,
    shouldBypass
  });

  if (shouldBypass) {
    // CRITICAL FIX: For Vercel service bots, return 200 to prevent deployment verification failures
    // This fixes FUNCTION_INVOCATION_FAILED errors during deployment
    return new Response("OK - Bot bypassed", {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Bot-Type": botType || "unknown"
      }
    });
  }

  // For search bots, return proper 410 to indicate protected resource
  return new Response("Authentication required", {
    status: 410,
    statusText: "Gone",
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Bot-Type": botType || "unknown"
    }
  });
}