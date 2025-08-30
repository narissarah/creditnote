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
  neonConfig.fetchConnectionCache = true;
}

function createPrismaClient() {
  console.log("[DB] Creating Prisma client", {
    nodeEnv: process.env.NODE_ENV,
    hasDatabase: !!process.env.DATABASE_URL,
    databaseHost: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0]
  });

  // In production, use Neon adapter with WebSocket support
  if (process.env.NODE_ENV === "production") {
    try {
      // Ensure DATABASE_URL is a string
      const connectionString = String(process.env.DATABASE_URL || "");
      
      if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
      }
      
      console.log("[DB] Using Neon adapter for production with connection to:", 
        connectionString.split("@")[1]?.split("/")[0] || "unknown"
      );
      
      // Create pool with the connection string directly
      const pool = new Pool(connectionString);
      const adapter = new PrismaNeon(pool);
      
      return new PrismaClient({
        adapter,
        log: ["error", "warn"],
      });
    } catch (error) {
      console.error("[DB] Failed to create Neon client:", error);
      // Fallback to direct connection if Neon adapter fails
      console.log("[DB] Falling back to direct connection");
      return new PrismaClient({
        log: ["error", "warn"],
      });
    }
  }
  
  // Development: Direct connection without adapter
  console.log("[DB] Using direct connection for development");
  return new PrismaClient({
    log: ["query", "error", "warn"],
  });
}

// Create singleton instance
let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = createPrismaClient();
} else {
  // In development, use global to prevent multiple instances
  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
  prisma = global.prismaGlobal;
}

export default prisma;