import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

// FIXED SERVERLESS: Enhanced database connection optimization for Vercel with proper pooling
let DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
const DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

// CRITICAL FIX: Add optimized connection pool parameters for Neon + Vercel Serverless
// Reference: https://neon.tech/docs/guides/prisma-connection-pooling
// Reference: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
// Reference: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool
if (DATABASE_URL && !DATABASE_URL.includes('connection_limit')) {
  const url = new URL(DATABASE_URL);

  // Optimized for Vercel Serverless + Neon PgBouncer
  url.searchParams.set('connection_limit', '1'); // Serverless: 1 connection per function instance
  url.searchParams.set('pool_timeout', '30'); // Increased timeout for serverless cold starts
  url.searchParams.set('connect_timeout', '30'); // Increased connect timeout for stability
  url.searchParams.set('pgbouncer', 'true'); // Enable PgBouncer compatibility mode

  // Additional Neon-specific optimizations
  if (DATABASE_URL.includes('neon.tech')) {
    url.searchParams.set('sslmode', 'require'); // Ensure SSL is enabled
  }

  DATABASE_URL = url.toString();
  console.log('[DB SERVERLESS] ✅ Enhanced connection URL with serverless-optimized pool parameters');
  console.log('[DB SERVERLESS] Pool config: connection_limit=1, pool_timeout=30s, connect_timeout=30s');
}

console.log('[DB SERVERLESS] Connection configuration:', {
  hasPooledUrl: !!process.env.POSTGRES_PRISMA_URL,
  hasPostgresUrl: !!process.env.POSTGRES_URL,
  hasDirectUrl: !!DIRECT_URL,
  hasFallbackUrl: !!process.env.DATABASE_URL,
  environment: process.env.NODE_ENV,
  hasPoolParams: DATABASE_URL?.includes('connection_limit')
});

if (!DATABASE_URL) {
  console.error('[DB ERROR] Missing database connection URLs. Required: POSTGRES_PRISMA_URL, POSTGRES_URL or DATABASE_URL');
  throw new Error("Database connection URL is required. Set POSTGRES_PRISMA_URL for pooled connections.");
}

// CRITICAL: Serverless-optimized Prisma client with enhanced connection pooling and retry logic
if (process.env.NODE_ENV === "production") {
  // Production: Create single instance with optimized serverless settings
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL, // Use pooled connection URL with optimized parameters
      },
    },
    log: process.env.DEBUG_DATABASE ? ['query', 'error', 'warn'] : ['error'], // Conditional verbose logging
    errorFormat: "minimal",
  });

  console.log('[DB PRODUCTION] ✅ Initialized Prisma with serverless-optimized pooled connection');
  console.log('[DB PRODUCTION] Connection: Neon PgBouncer pooler (1 connection per serverless function)');
} else {
  // Development: Use global instance for hot reloading
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      datasources: {
        db: {
          url: DATABASE_URL,
        },
      },
      log: process.env.DEBUG_DATABASE ? ["query", "error", "warn"] : ["error", "warn"],
      errorFormat: "pretty",
    });

    console.log('[DB DEVELOPMENT] ✅ Initialized global Prisma instance with connection pooling');
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

// ENHANCED: Database operation wrapper with retry logic for serverless
export const db = {
  async query<T>(operation: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`[DB RETRY] Operation failed (attempt ${retryCount + 1}):`, error);

      // Retry logic for connection issues
      if (retryCount < 2 && error instanceof Error) {
        const isConnectionError = error.message.includes('connection') ||
                                 error.message.includes('timeout') ||
                                 error.message.includes('ECONNRESET') ||
                                 error.message.includes('Pool');

        if (isConnectionError) {
          console.log(`[DB RETRY] Retrying after ${100 * (retryCount + 1)}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)));
          return this.query(operation, retryCount + 1);
        }
      }

      throw error;
    }
  },

  // Direct access to prisma client for backwards compatibility
  get client() {
    return prisma;
  },

  // Common operations with retry logic
  async creditNote() {
    return {
      findMany: async (args?: any) => this.query(() => prisma.creditNote.findMany(args)),
      findUnique: async (args: any) => this.query(() => prisma.creditNote.findUnique(args)),
      create: async (args: any) => this.query(() => prisma.creditNote.create(args)),
      update: async (args: any) => this.query(() => prisma.creditNote.update(args)),
      delete: async (args: any) => this.query(() => prisma.creditNote.delete(args)),
      count: async (args?: any) => this.query(() => prisma.creditNote.count(args)),
    };
  },

  async session() {
    return {
      findUnique: async (args: any) => this.query(() => prisma.session.findUnique(args)),
      create: async (args: any) => this.query(() => prisma.session.create(args)),
      update: async (args: any) => this.query(() => prisma.session.update(args)),
      delete: async (args: any) => this.query(() => prisma.session.delete(args)),
      deleteMany: async (args?: any) => this.query(() => prisma.session.deleteMany(args)),
    };
  }
};

export default prisma;