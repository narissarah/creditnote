import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  // If this is the login path, use login instead of authenticate
  if (url.pathname === "/auth/login") {
    return login(request);
  }
  
  // For other auth paths, redirect to app
  return redirect("/app");
};
