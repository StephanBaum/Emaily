import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "child_process";

let container: StartedPostgreSqlContainer | null = null;
let prisma: PrismaClient;
let usingLocalDb = false;

export async function setupTestDatabase() {
  let databaseUrl: string;

  // Try testcontainers first, fall back to local PostgreSQL with a test database
  try {
    container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
      .withDatabase("test_emailautomation")
      .withUsername("test")
      .withPassword("test")
      .withStartupTimeout(60000)
      .start();

    databaseUrl = container.getConnectionUri();
  } catch (err) {
    // Testcontainers failed (common on Docker Desktop for Windows) —
    // fall back to the local PostgreSQL with a separate test database
    console.warn(
      "Testcontainers failed, falling back to local PostgreSQL:",
      err instanceof Error ? err.message : err
    );

    databaseUrl = "postgresql://emaily:emaily@127.0.0.1:5432/emaily_test";
    usingLocalDb = true;

    // Create test database if it doesn't exist
    const adminUrl = "postgresql://emaily:emaily@127.0.0.1:5432/postgres";
    const adminPrisma = new PrismaClient({ datasources: { db: { url: adminUrl } } });
    try {
      await adminPrisma.$executeRawUnsafe("CREATE DATABASE emaily_test");
    } catch {
      // Database already exists, that's fine
    } finally {
      await adminPrisma.$disconnect();
    }
  }

  process.env.DATABASE_URL = databaseUrl;

  // Push schema to test database
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: __dirname + "/..",
    stdio: "pipe",
  });

  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  await prisma.$connect();
  return prisma;
}

export async function teardownTestDatabase() {
  if (prisma) {
    // Clean up test data when using local DB (keep schema for next run)
    if (usingLocalDb) {
      const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;
      for (const { tablename } of tables) {
        if (tablename !== "_prisma_migrations") {
          await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
        }
      }
    }
    await prisma.$disconnect();
  }
  if (container) {
    await container.stop();
  }
}

export function getTestPrisma() {
  return prisma;
}
