const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const matchedOrders = await prisma.salesOrder.findMany({
    where: {
      saleDate: { gte: startOfMonth },
      status: { in: ["DELIVERED"] }
    },
    include: { items: true }
  });
  
  let totalProfit = 0;
  for (const order of matchedOrders) {
    let profit = 0;
    for (const item of order.items) {
      profit += item.profit.toNumber();
    }
    console.log(`Order ${order.orderCode} - Profit: ${profit}`);
    totalProfit += profit;
  }
  console.log("Total Profit of these 7 orders:", totalProfit);
}
main().finally(() => prisma.$disconnect());
