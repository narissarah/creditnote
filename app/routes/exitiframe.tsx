import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = session;

  if (shop) {
    throw redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`);
  }

  throw redirect("/app");
}