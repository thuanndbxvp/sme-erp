const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  console.log("startOfMonth", startOfMonth);

  const profitData = await prisma.salesOrderItem.aggregate({
    _sum: { profit: true },
    where: {
      salesOrder: {
        saleDate: { gte: startOfMonth },
        status: { in: ["DELIVERED"] }
      }
    }
  });
  console.log("monthlyProfit using saleDate:", profitData._sum.profit?.toNumber() || 0);

  const profitDataDelivered = await prisma.salesOrderItem.aggregate({
    _sum: { profit: true },
    where: {
      salesOrder: {
        deliveredDate: { gte: startOfMonth },
        status: { in: ["DELIVERED"] }
      }
    }
  });
  console.log("monthlyProfit using deliveredDate:", profitDataDelivered._sum.profit?.toNumber() || 0);

  const profitDataCreated = await prisma.salesOrderItem.aggregate({
    _sum: { profit: true },
    where: {
      salesOrder: {
        createdAt: { gte: startOfMonth },
        status: { in: ["DELIVERED"] }
      }
    }
  });
  console.log("monthlyProfit using createdAt:", profitDataCreated._sum.profit?.toNumber() || 0);
}
main().finally(() => prisma.$disconnect());
