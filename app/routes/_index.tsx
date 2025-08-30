import { redirect } from "@remix-run/node";

// Redirect root to /app
export async function loader() {
  return redirect("/app");
}