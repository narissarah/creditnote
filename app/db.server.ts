import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

let prisma: PrismaClient;

// Enhanced database connection validation
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

if (process.env.NODE_ENV === "production") {
  // VERCEL OPTIMIZED: Ultra-minimal Prisma configuration for serverless compatibility
  try {
    prisma = new PrismaClient({
      log: [], // No logging to avoid any potential issues
      errorFormat: "minimal",
      // Remove datasources override - let Prisma use DATABASE_URL directly
    });
  } catch (error) {
    console.error('[PRISMA] Initialization failed:', error);
    // Create a minimal fallback - this should never be used but prevents crashes
    throw error;
  }
} else {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      log: ["query", "error", "warn"],
      errorFormat: "pretty",
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  prisma = global.prismaGlobal;
}

export default prisma;