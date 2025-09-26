import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

// ENHANCED SERVERLESS: Advanced database connection optimization for Vercel
const DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
const DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL;

console.log('[DB SERVERLESS] Connection configuration:', {
  hasPooledUrl: !!process.env.POSTGRES_PRISMA_URL,
  hasDirectUrl: !!DIRECT_URL,
  hasFallbackUrl: !!process.env.DATABASE_URL,
  environment: process.env.NODE_ENV
});

if (!DATABASE_URL) {
  console.error('[DB ERROR] Missing database connection URLs. Required: POSTGRES_PRISMA_URL or DATABASE_URL');
  throw new Error("Database connection URL is required. Set POSTGRES_PRISMA_URL for pooled connections.");
}

// CRITICAL: Serverless-optimized Prisma client with connection pooling
if (process.env.NODE_ENV === "production") {
  // Production: Create single instance with optimized serverless settings
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL, // Use pooled connection URL
      },
    },
    log: ['error'], // Minimal logging for performance
    errorFormat: "minimal",
    // SERVERLESS OPTIMIZATION: Disable interactive queries and optimize for cold starts
    __internal: {
      debug: false,
      engine: {
        binaryPaths: undefined,
      },
    },
  });

  console.log('[DB PRODUCTION] Initialized Prisma with pooled connection for serverless');
} else {
  // Development: Use global instance for hot reloading
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      datasources: {
        db: {
          url: DATABASE_URL,
        },
      },
      log: ["error", "warn"], // Reduced logging for better performance
      errorFormat: "pretty",
    });

    console.log('[DB DEVELOPMENT] Initialized global Prisma instance');
  }
  prisma = global.__prisma;
}

// CRITICAL: Enhanced graceful shutdown for serverless
// Remove process handlers that cause FUNCTION_INVOCATION_FAILED
// Serverless functions should not use process.on handlers

// ENHANCED: Connection health check function for debugging
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
  latency?: number;
}> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    console.log(`[DB HEALTH] Connection successful in ${latency}ms`);
    return { connected: true, latency };
  } catch (error) {
    console.error('[DB HEALTH] Connection failed:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

// ENHANCED: Connection cleanup utility for serverless
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('[DB CLEANUP] Database connection closed');
  } catch (error) {
    console.warn('[DB CLEANUP] Error during disconnect:', error);
  }
}

export default prisma;