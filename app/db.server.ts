import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

let prisma: PrismaClient;

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set. Database operations will fail.");
}

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({
    log: ["error"],
    errorFormat: "minimal",
  });
} else {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      log: ["query", "error", "warn"],
      errorFormat: "pretty",
    });
  }
  prisma = global.prismaGlobal;
}

export default prisma;