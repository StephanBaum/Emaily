import { PrismaClient } from "@prisma/client";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "child_process";

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

export async function setupTestDatabase() {
  // Use testcontainers to spin up a fresh PostgreSQL instance
  container = await new PostgreSqlContainer("pgvector/pgvector:pg16")
    .withDatabase("test_emailautomation")
    .withUsername("test")
    .withPassword("test")
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;

  // Push schema to test database
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: __dirname + "/..",
  });

  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  await prisma.$connect();
  return prisma;
}

export async function teardownTestDatabase() {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (container) {
    await container.stop();
  }
}

export function getTestPrisma() {
  return prisma;
}
