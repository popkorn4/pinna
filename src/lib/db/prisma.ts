import { PrismaClient } from "@prisma/client";

// Singleton PrismaClient.
// почему: в dev Next.js HMR пересоздаёт модули — без singleton каждый ре-маунт
// плодит новые подключения, и БД быстро упирается в лимит коннекций.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
