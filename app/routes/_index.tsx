import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Check if this is an embedded app install with shop parameter
  if (url.searchParams.get("embedded") === "1" || url.searchParams.get("shop")) {
    return login(request);
  }

  // For all other requests, redirect to the app login
  return redirect("/app");
};