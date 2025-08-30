import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  // If shop parameter exists, initiate login
  if (shop) {
    throw await login({ request });
  }

  // Return empty data for the form
  return json({ shop: "" });
}

export default function Auth() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <div style={{ 
      fontFamily: "system-ui, sans-serif", 
      padding: "2rem", 
      maxWidth: "400px", 
      margin: "4rem auto",
      textAlign: "center" 
    }}>
      <h1 style={{ marginBottom: "2rem", fontSize: "1.5rem" }}>creditnote</h1>
      
      <div style={{ 
        background: "white", 
        padding: "2rem", 
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <h2 style={{ marginBottom: "1.5rem", fontSize: "1.25rem" }}>Log in</h2>
        
        <Form method="get" action="/auth/login">
          <div style={{ marginBottom: "1rem", textAlign: "left" }}>
            <label htmlFor="shop" style={{ 
              display: "block", 
              marginBottom: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: "500"
            }}>
              Shop domain
            </label>
            <input
              id="shop"
              name="shop"
              type="text"
              autoComplete="on"
              required
              placeholder="example.myshopify.com"
              defaultValue={shop}
              style={{
                width: "100%",
                padding: "0.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.375rem",
                fontSize: "1rem"
              }}
            />
            <p style={{ 
              marginTop: "0.25rem", 
              fontSize: "0.75rem", 
              color: "#6b7280" 
            }}>
              example.myshopify.com
            </p>
          </div>
          
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "500"
            }}
          >
            Log in
          </button>
        </Form>
      </div>
    </div>
  );
}