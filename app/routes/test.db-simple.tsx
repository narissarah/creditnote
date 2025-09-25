import type { LoaderFunctionArgs } from "@remix-run/node";
import db from "../db-simple.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('[DB SIMPLE] Testing simple database connection...');

    // Basic database test with simple Prisma configuration
    const result = await db.$queryRaw`SELECT 1 as test`;

    return new Response(JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      dbTest: result,
      message: "Simple database configuration test successful"
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('[DB SIMPLE] Error:', error);

    return new Response(JSON.stringify({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      message: "Simple database test failed"
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}