import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Generate robots.txt to help control bot behavior
  const robotsTxt = `
User-agent: *
Disallow: /app/
Disallow: /auth/
Disallow: /api/
Disallow: /debug/

User-agent: vercel-screenshot
Disallow: /

User-agent: vercel-favicon
Disallow: /

User-agent: vercel-bot
Disallow: /

# Allow health checks
Allow: /health
Allow: /favicon.ico
  `.trim();

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600"
    }
  });
};