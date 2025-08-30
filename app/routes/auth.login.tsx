import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../shopify.server";
import { LoginErrorCode } from "@shopify/shopify-app-remix/server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const errorCode = url.searchParams.get("errorCode");

  if (shop) {
    throw await login({ request });
  }

  return json({
    showForm: Boolean(errorCode),
    errorCode,
  });
}

export default function Auth() {
  const { showForm, errorCode } = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "400px", margin: "4rem auto" }}>
      <h1 style={{ marginBottom: "2rem" }}>Log in</h1>
      
      {showForm ? (
        <>
          {errorCode === LoginErrorCode.MissingShop ? (
            <div style={{ color: "#dc2626", marginBottom: "1rem" }}>
              Please provide a valid shop domain to log in.
            </div>
          ) : errorCode === LoginErrorCode.InvalidShop ? (
            <div style={{ color: "#dc2626", marginBottom: "1rem" }}>
              Please provide a valid shop domain to log in.
            </div>
          ) : null}
          
          <Form method="get" action="/auth/login">
            <label htmlFor="shop" style={{ display: "block", marginBottom: "0.5rem" }}>
              Shop domain
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              <input
                id="shop"
                name="shop"
                type="text"
                autoComplete="on"
                placeholder="example.myshopify.com"
                required
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "0.25rem"
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: "0.25rem",
                cursor: "pointer",
                fontSize: "1rem"
              }}
            >
              Log in
            </button>
          </Form>
        </>
      ) : (
        <Form method="get" action="/auth/login">
          <label htmlFor="shop" style={{ display: "block", marginBottom: "0.5rem" }}>
            Shop domain
          </label>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <input
              id="shop"
              name="shop"
              type="text"
              autoComplete="on"
              placeholder="example.myshopify.com"
              required
              style={{
                flex: 1,
                padding: "0.5rem",
                border: "1px solid #ccc",
                borderRadius: "0.25rem"
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
              fontSize: "1rem"
            }}
          >
            Log in
          </button>
        </Form>
      )}
    </div>
  );
}