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