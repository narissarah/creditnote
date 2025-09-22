import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Test database connectivity
    const creditCount = await db.creditNote.count({
      where: { shopDomain: "arts-kardz.myshopify.com" }
    });

    return json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: "connected",
      creditNotes: creditCount,
      shop: "arts-kardz.myshopify.com",
      posExtensions: {
        redeem: "active",
        manage: "active",
        create: "active"
      }
    });
  } catch (error) {
    return json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
