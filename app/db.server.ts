import { PrismaClient } from "@prisma/client";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

declare global {
  var prismaGlobal: PrismaClient;
}

// Configure Neon for serverless environments
if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
  neonConfig.webSocketConstructor = ws;
}

function createPrismaClient() {
  console.log("[DB] Creating Prisma client", {
    nodeEnv: process.env.NODE_ENV,
    hasDatabase: !!process.env.DATABASE_URL,
    databaseHost: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0]
  });

  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    try {
      // Production: Use Neon adapter for better serverless performance
      const connectionString = process.env.DATABASE_URL;
      const pool = new Pool({ connectionString });
      const adapter = new PrismaNeon(pool);
      
      console.log("[DB] Using Neon adapter for production");
      
      return new PrismaClient({
        adapter,
        log: ["error", "warn"],
      });
    } catch (error) {
      console.error("[DB] Failed to create Neon client:", error);
      throw error;
    }
  } else {
    // Development: Direct connection
    console.log("[DB] Using direct connection for development");
    return new PrismaClient({
      log: ["query", "error", "warn"],
    });
  }
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
}

const prisma = global.prismaGlobal ?? createPrismaClient();

export default prisma;
