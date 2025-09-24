import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate, login } from "../shopify.server";
import { handleBotAuthentication } from "../utils/bot-detection.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // First, check for bots and handle them appropriately
    const botResponse = handleBotAuthentication(request);
    if (botResponse) {
      return botResponse;
    }

    const url = new URL(request.url);

    console.log(`[AUTH ROUTE] Processing authentication request:`, {
      pathname: url.pathname,
      userAgent: request.headers.get("User-Agent"),
      origin: request.headers.get("Origin"),
      referer: request.headers.get("Referer")
    });

    // If this is the login path, use shopify.login() instead of authenticate.admin()
    if (url.pathname === '/auth/login') {
      return await login(request);
    }

    // For all other auth paths, use authenticate.admin()
    await authenticate.admin(request);
    return null;

  } catch (error) {
    console.error(`[AUTH ROUTE] Authentication error:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      url: request.url,
      userAgent: request.headers.get("User-Agent"),
      method: request.method
    });

    // Re-throw to let Shopify's boundary handler manage the error
    throw error;
  }
};
