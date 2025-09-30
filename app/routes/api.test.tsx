import { json } from "@remix-run/node";

export async function loader() {
  return json({
    success: true,
    message: "API routing is working",
    timestamp: new Date().toISOString()
  });
}

export async function action() {
  return json({
    success: true,
    message: "API action is working",
    timestamp: new Date().toISOString()
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}