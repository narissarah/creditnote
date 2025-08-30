import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useNavigation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { Frame, Loading, Toast } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { useState } from "react";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Enhanced logging for debugging
    console.log("[App Loader] Starting authentication...", {
      url: request.url,
      method: request.method,
      hasApiKey: !!process.env.SHOPIFY_API_KEY,
      hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
      hasAppUrl: !!process.env.SHOPIFY_APP_URL,
      appUrl: process.env.SHOPIFY_APP_URL,
      hasDatabase: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    });

    const { admin, session } = await authenticate.admin(request);
    
    if (!session) {
      console.error("[App Loader] No session found after authentication");
      throw new Response("Session not found", { status: 401 });
    }

    console.log("[App Loader] Authentication successful", {
      shop: session.shop,
      sessionId: session.id
    });

    return json({
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: session.shop,
    });
  } catch (error) {
    console.error("[App Loader] Authentication error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name,
      status: error instanceof Response ? error.status : undefined
    });
    
    // If it's an authentication error, handle it specifically
    if (error instanceof Response) {
      throw error;
    }
    
    // For other errors, provide more context
    throw new Response(
      JSON.stringify({
        message: "Authentication failed",
        error: error instanceof Error ? error.message : "Unknown error",
        details: process.env.NODE_ENV === "development" ? error?.toString() : undefined,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};

export default function App() {
  const { apiKey, shop } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [toastActive, setToastActive] = useState(false);
  const [toastContent, setToastContent] = useState("");

  const toggleToast = () => setToastActive((active) => !active);

  const toastMarkup = toastActive ? (
    <Toast content={toastContent} onDismiss={toggleToast} />
  ) : null;

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Dashboard
        </Link>
        <Link to="/app/credit-notes">
          Credit Notes
        </Link>
        <Link to="/app/additional">
          Settings
        </Link>
      </NavMenu>
      <Frame>
        {navigation.state !== "idle" && <Loading />}
        <Outlet context={{ shop, setToastContent, toggleToast }} />
        {toastMarkup}
      </Frame>
    </AppProvider>
  );
}

// Enhanced error boundary with better error display
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("App error boundary:", error);
  
  // Let Shopify handle its own errors
  if (boundary.error) {
    const shopifyError = boundary.error(error);
    if (shopifyError) {
      return shopifyError;
    }
  }
  
  // Custom error display for other errors
  return (
    <div style={{
      padding: "2rem",
      textAlign: "center",
      fontFamily: "system-ui, sans-serif"
    }}>
      <h1 style={{ color: "#dc2626", marginBottom: "1rem" }}>
        Something went wrong
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        {error instanceof Error ? error.message : "An unexpected error occurred"}
      </p>
      <a 
        href="/app" 
        style={{
          display: "inline-block",
          padding: "0.5rem 1rem",
          background: "#4f46e5",
          color: "white",
          borderRadius: "0.375rem",
          textDecoration: "none"
        }}
      >
        Back to Dashboard
      </a>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
