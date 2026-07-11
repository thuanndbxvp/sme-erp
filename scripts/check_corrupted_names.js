const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.product.findMany({ select: { name: true } })
  .then(res => {
    const corrupted = res.filter(r => r.name.includes(''));
    console.log(corrupted.length > 0 ? corrupted : 'No corrupted names');
  })
  .finally(() => p.$disconnect());
