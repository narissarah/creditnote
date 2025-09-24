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
  // VERCEL OPTIMIZED: Simplified Prisma configuration for serverless stability
  prisma = new PrismaClient({
    log: ["error"],
    errorFormat: "minimal",
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // VERCEL FIX: Ensure proper connection handling in serverless
  prisma.$on('beforeExit', async () => {
    console.log('[PRISMA] Disconnecting before serverless function exit');
    await prisma.$disconnect();
  });

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