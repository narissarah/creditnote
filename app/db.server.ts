import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

let prisma: PrismaClient;

// Enhanced database connection validation with fallback support [CACHE-BUST v2025.09.25-16:25]
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
const DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;

console.log('[DB] Using database URL:', DATABASE_URL ? 'SET' : 'NOT SET');
console.log('[DB] Using direct URL:', DIRECT_URL ? 'SET' : 'NOT SET');

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Global singleton pattern for serverless optimization
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (process.env.NODE_ENV === "production") {
  // VERCEL + NEON OPTIMIZED: Advanced Prisma configuration for serverless
  try {
    prisma = globalForPrisma.prisma ?? new PrismaClient({
      // Serverless-optimized logging
      log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: "minimal",
      // Connection pool configuration
      transactionOptions: {
        maxWait: 5000, // 5 seconds
        timeout: 10000, // 10 seconds
      },
    });

    // Enhanced error handling with detailed logging
    prisma.$on('error', (e) => {
      console.error('[PRISMA ERROR]', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp,
      });
    });

    // Connection health check for serverless
    prisma.$on('beforeExit', async () => {
      console.log('[PRISMA] Disconnecting from database...');
      await prisma.$disconnect();
    });

    if (process.env.NODE_ENV === "production") {
      globalForPrisma.prisma = prisma;
    }

  } catch (error) {
    console.error('[PRISMA] Initialization failed:', error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
} else {
  // Development configuration with detailed logging
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      log: ["query", "error", "warn", "info"],
      errorFormat: "pretty",
    });
  }
  prisma = global.prismaGlobal;
}

export default prisma;