import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  
  // If accessed directly, redirect to the app
  if (url.pathname === "/") {
    return redirect("/app");
  }
  
  return null;
}