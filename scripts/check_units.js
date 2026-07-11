const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product.findMany({ select: { unit: true } })
  .then(res => {
    console.log([...new Set(res.map(r=>r.unit))]);
  })
  .finally(() => p.$disconnect());
