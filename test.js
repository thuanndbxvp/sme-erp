const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const orders = await prisma.salesOrder.findMany({
    select: { id: true, orderCode: true, saleDate: true, deliveredDate: true, createdAt: true, status: true, totalAmount: true }
  });
  console.log(orders);
}
main().finally(() => prisma.$disconnect());
