const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product.findMany({ select: { unit: true } })
  .then(res => {
    const bad = res.find(r => r.unit && Buffer.from(r.unit).toString('hex').includes('efbfbd')); // efbfbd is U+FFFD
    if (bad) console.log(bad.unit, Buffer.from(bad.unit).toString('hex'));
  })
  .finally(() => p.$disconnect());
