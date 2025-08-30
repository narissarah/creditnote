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
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL) {
    // Production: Use Neon adapter for better serverless performance
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    
    return new PrismaClient({
      adapter,
      log: ["error", "warn"],
    });
  } else {
    // Development: Direct connection
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
