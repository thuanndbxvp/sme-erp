const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  console.log("startOfMonth", startOfMonth);

  const matchedOrders = await prisma.salesOrder.findMany({
    where: {
      saleDate: { gte: startOfMonth },
      status: { in: ["DELIVERED"] }
    },
    select: { orderCode: true, saleDate: true }
  });
  console.log(matchedOrders);
}
main().finally(() => prisma.$disconnect());
