import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("Đang lấy danh sách các bảng...");
  const modelNames = [
    'User', 'Role', 'Permission', 'RolePermission', 'Product', 'Customer', 'Supplier', 
    'Warehouse', 'Account', 'WarehouseInventory', 'InventoryMovement', 'SalesOrder', 
    'SalesOrderItem', 'PurchaseOrder', 'PurchaseOrderItem', 'OrderStatusHistory', 
    'Transaction', 'Invoice', 'Payment', 'PaymentApplication', 'CommissionRule', 
    'Payout', 'EmployeeTransaction', 'OutboxEvent', 'AuditLog', 'SystemSetting'
  ];

  const backupData: Record<string, any[]> = {};

  for (const modelName of modelNames) {
    const propertyName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    try {
      if ((prisma as any)[propertyName]) {
        console.log(`Đang sao lưu bảng: ${modelName}...`);
        const data = await (prisma as any)[propertyName].findMany();
        backupData[modelName] = data;
      }
    } catch (e) {
      console.log(`Bỏ qua bảng ${modelName} do lỗi hoặc không tồn tại.`);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `database-backup-${timestamp}.json`;
  const filePath = path.join(process.cwd(), fileName);

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`\n✅ Sao lưu thành công! Dữ liệu đã được lưu tại:\n👉 ${filePath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
