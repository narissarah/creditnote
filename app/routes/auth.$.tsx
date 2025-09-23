import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate, login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // If this is the login path, use shopify.login() instead of authenticate.admin()
  if (url.pathname === '/auth/login') {
    return await login(request);
  }

  // For all other auth paths, use authenticate.admin()
  await authenticate.admin(request);
  return null;
};
