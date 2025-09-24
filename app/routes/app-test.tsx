import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "test-key",
    timestamp: new Date().toISOString(),
    url: request.url
  });
};

export default function AppTest() {
  const { apiKey, timestamp } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>App Test</title>
      </head>
      <body>
        <h1>App Test Route</h1>
        <p>API Key configured: {apiKey ? "Yes" : "No"}</p>
        <p>Timestamp: {timestamp}</p>
        <p>This tests React rendering without Shopify authentication.</p>
      </body>
    </html>
  );
}