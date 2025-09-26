import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

// FIXED SERVERLESS: Enhanced database connection optimization for Vercel with proper pooling
const DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
const DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

console.log('[DB SERVERLESS] Connection configuration:', {
  hasPooledUrl: !!process.env.POSTGRES_PRISMA_URL,
  hasPostgresUrl: !!process.env.POSTGRES_URL,
  hasDirectUrl: !!DIRECT_URL,
  hasFallbackUrl: !!process.env.DATABASE_URL,
  environment: process.env.NODE_ENV
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
        url: DATABASE_URL, // Use pooled connection URL
      },
    },
    log: ['error'], // Minimal logging for performance
    errorFormat: "minimal",
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