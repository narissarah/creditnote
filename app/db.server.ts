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
  // ENHANCED SERVERLESS: Optimized Prisma configuration for Vercel + Neon
  try {
    prisma = new PrismaClient({
      log: ['error'], // Log only errors to avoid noise
      errorFormat: "minimal",
      // CRITICAL: Serverless connection optimization
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // CRITICAL: Enhanced connection error handling for serverless
    prisma.$on('error', (e) => {
      console.error('[PRISMA ERROR]', e);
    });

  } catch (error) {
    console.error('[PRISMA] Initialization failed:', error);
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