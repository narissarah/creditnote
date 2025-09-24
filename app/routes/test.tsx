import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({
    message: "Test route working",
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method
  });
};

export default function Test() {
  return (
    <html>
      <head>
        <title>Test Route</title>
      </head>
      <body>
        <h1>Test Route Working</h1>
        <p>This is a minimal test to verify React rendering works.</p>
      </body>
    </html>
  );
}