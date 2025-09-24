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

  // Known Vercel bots that cause 410 errors
  const vercelBots = [
    "vercel-screenshot",
    "vercel-favicon",
    "vercel-og-image",
    "vercel-bot"
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
    // For Vercel service bots, return a simple response to prevent 410 errors
    return new Response("Bot detected - service unavailable", {
      status: 503,
      statusText: "Service Unavailable",
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