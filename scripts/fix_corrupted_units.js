const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function fixCorruptedUnits() {
  const products = await p.product.findMany({ select: { id: true, unit: true } });
  
  let count = 0;
  for (const prod of products) {
    if (prod.unit && prod.unit.includes('\uFFFD')) {
      let newUnit = prod.unit;
      newUnit = newUnit.replace(/C\uFFFDi/g, 'Cái');
      newUnit = newUnit.replace(/T\uFFFDi/g, 'Túi');
      newUnit = newUnit.replace(/L\uFFFDt/g, 'Lít');
      newUnit = newUnit.replace(/Đ\uFFFDi/g, 'Đôi');
      
      // lowercase
      newUnit = newUnit.replace(/c\uFFFDi/g, 'cái');
      newUnit = newUnit.replace(/t\uFFFDi/g, 'túi');
      newUnit = newUnit.replace(/l\uFFFDt/g, 'lít');
      newUnit = newUnit.replace(/đ\uFFFDi/g, 'đôi');
      
      if (newUnit !== prod.unit) {
        await p.product.update({
          where: { id: prod.id },
          data: { unit: newUnit }
        });
        count++;
      }
    }
  }
  
  console.log(`Fixed ${count} corrupted units.`);
}

fixCorruptedUnits().finally(() => p.$disconnect());
