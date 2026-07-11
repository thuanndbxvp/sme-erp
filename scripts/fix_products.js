const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function fixProducts() {
  const data = JSON.parse(fs.readFileSync('D:/viettung-v2/backups/db_backup_2026-07-07T18-34-31-281Z.json'));
  
  if (data.Product && data.Product.length > 0) {
    console.log(`Đang update ${data.Product.length} Products...`);
    
    // Batch update since there are many
    const chunks = [];
    for (let i = 0; i < data.Product.length; i += 50) {
      chunks.push(data.Product.slice(i, i + 50));
    }

    for (let i = 0; i < chunks.length; i++) {
      await Promise.all(chunks[i].map(async prod => {
        try {
          await p.product.update({
            where: { id: prod.id },
            data: {
              unit: prod.baseUnit || prod.unit || "Cái",
              buyPrice: prod.buyPrice ? String(prod.buyPrice) : "0"
            }
          });
        } catch (err) {
          // Ignore if product doesn't exist
        }
      }));
      console.log(`Processed ${i + 1}/${chunks.length} chunks`);
    }
  }
  
  console.log('Fixed Product units and buyPrice.');
}

fixProducts().finally(() => p.$disconnect());
