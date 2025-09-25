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
  // ULTRA-SIMPLIFIED: Minimal Prisma for serverless compatibility
  prisma = new PrismaClient({
    log: ['error'],
    errorFormat: "minimal",
  });
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