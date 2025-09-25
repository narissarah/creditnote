import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[DEBUG DB] Database connectivity test starting...');

  try {
    // Test 1: Basic connection
    const startTime = Date.now();
    const result = await db.$queryRaw`SELECT 1 as connection_test`;
    const connectionTime = Date.now() - startTime;

    // Test 2: Database version and info
    const versionResult = await db.$queryRaw`SELECT version() as db_version`;

    // Test 3: Count existing tables
    const tables = await db.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    // Test 4: Check specific models
    let modelCounts = {};
    try {
      modelCounts = {
        sessions: await db.session.count(),
        creditNotes: await db.creditNote.count(),
        creditRedemptions: await db.creditRedemption.count(),
        shopSettings: await db.shopSettings.count(),
      };
    } catch (modelError) {
      console.warn('[DEBUG DB] Model count error:', modelError);
      modelCounts = { error: 'Failed to count models' };
    }

    // Test 5: Connection pool info
    const poolInfo = {
      database_url_set: !!process.env.DATABASE_URL,
      postgres_prisma_url_set: !!process.env.POSTGRES_PRISMA_URL,
      postgres_url_non_pooling_set: !!process.env.POSTGRES_URL_NON_POOLING,
    };

    console.log('[DEBUG DB] All tests completed successfully');

    return json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      connectionTest: result,
      connectionTime: `${connectionTime}ms`,
      databaseVersion: versionResult,
      tables: tables,
      modelCounts: modelCounts,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        ...poolInfo,
      },
      message: "Database connectivity tests passed"
    });

  } catch (error) {
    console.error('[DEBUG DB] Database test failed:', error);

    return json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: {
        message: error instanceof Error ? error.message : "Unknown database error",
        name: error instanceof Error ? error.name : "Unknown",
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        database_url_set: !!process.env.DATABASE_URL,
        postgres_prisma_url_set: !!process.env.POSTGRES_PRISMA_URL,
        postgres_url_non_pooling_set: !!process.env.POSTGRES_URL_NON_POOLING,
      },
      message: "Database connectivity test failed"
    }, { status: 500 });
  }
}