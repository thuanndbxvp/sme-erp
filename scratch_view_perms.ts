import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const permissions = await prisma.permission.findMany();
  console.log("Danh sách quyền trong DB:");
  permissions.forEach(p => {
    console.log(`- Code: ${p.code} | Description: ${p.description}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
