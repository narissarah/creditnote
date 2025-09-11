import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  
  // If there's a shop parameter, this is likely an app installation/access
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // For embedded app context, authenticate and redirect to app
  try {
    await authenticate.admin(request);
    return redirect("/app");
  } catch (error) {
    // If authentication fails, redirect to app route which will handle login
    return redirect("/app");
  }
};