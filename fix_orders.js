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
    }
  });
  
  for (const order of matchedOrders) {
    const newDate = new Date(order.saleDate);
    newDate.setDate(newDate.getDate() - 2); // Move to June 29
    
    await prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        saleDate: newDate,
        deliveredDate: order.deliveredDate ? newDate : undefined
      }
    });
    console.log(`Updated order ${order.orderCode} to date ${newDate}`);
  }
}
main().finally(() => prisma.$disconnect());
