import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  // Redirect to the proper authentication route
  return redirect(`/auth/login${searchParams ? `?${searchParams}` : ''}`);
};