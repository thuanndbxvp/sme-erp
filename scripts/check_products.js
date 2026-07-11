const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product.findMany({ take: 3 })
  .then(console.log)
  .finally(() => p.$disconnect());
