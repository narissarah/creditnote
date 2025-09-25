import { PrismaClient } from "@prisma/client";

// Ultra-simplified Prisma configuration for serverless debugging
let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({
    log: ['error'],
    errorFormat: "minimal",
  });
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['error'],
      errorFormat: "minimal",
    });
  }
  prisma = global.__prisma;
}

export default prisma;