import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    // Simply querying to ensure the DB is alive and the table exists
    const count = await prisma.agentConfig.count();
    console.log(`DB is alive. Current AgentConfig count: ${count}`);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
