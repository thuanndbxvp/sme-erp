import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

/**
 * Migration Script: Từ VietTung V2 sang SME ERP
 * Cách chạy: npx tsx scripts/migrate_v2_to_sme.ts
 */

const prisma = new PrismaClient();
const BACKUP_PATH = "D:/viettung-v2/backups/db_backup_2026-07-07T18-34-31-281Z.json";

async function main() {
  console.log(`Đang đọc file backup từ: ${BACKUP_PATH}...`);
  const fileContent = fs.readFileSync(BACKUP_PATH, "utf8");
  const data = JSON.parse(fileContent);

  console.log("--- BẮT ĐẦU MIGRATION ---");

  // 1. Import Master Data (Danh mục)
  // 1.1 Roles
  if (data.Role && data.Role.length > 0) {
    console.log(`Đang import ${data.Role.length} Roles...`);
    for (const role of data.Role) {
      const existing = await prisma.role.findFirst({ where: { OR: [{ id: role.id }, { name: role.name }] } });
      if (!existing) {
        await prisma.role.create({ data: { id: role.id, name: role.name, description: role.description || "" } });
      }
    }
  }

  // 1.2 Users
  if (data.User && data.User.length > 0) {
    console.log(`Đang import ${data.User.length} Users...`);
    for (const user of data.User) {
      const existing = await prisma.user.findFirst({ where: { OR: [{ id: user.id }, { email: user.email }] } });
      if (!existing) {
        let validRoleId = null;
        if (user.roleId) {
          const r = await prisma.role.findUnique({ where: { id: user.roleId } });
          if (r) validRoleId = user.roleId;
        }

        await prisma.user.create({
          data: {
            id: user.id, email: user.email, name: user.name, passwordHash: user.password || "",
            roleId: validRoleId, isActive: user.isActive, createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt),
          }
        });
      }
    }
  }

  // 1.3 Accounts
  if (data.Account && data.Account.length > 0) {
    console.log(`Đang import ${data.Account.length} Accounts...`);
    for (const acc of data.Account) {
      const code = acc.id.substring(0, 8).toUpperCase();
      const existing = await prisma.account.findFirst({ where: { OR: [{ id: acc.id }, { code }] } });
      if (!existing) {
        await prisma.account.create({
          data: { id: acc.id, code, name: acc.name, balance: acc.balance || "0", isActive: acc.isActive ?? true }
        });
      }
    }
  }

  // 1.4 Customers
  if (data.Customer && data.Customer.length > 0) {
    console.log(`Đang import ${data.Customer.length} Customers...`);
    for (const cus of data.Customer) {
      const existing = await prisma.customer.findUnique({ where: { id: cus.id } });
      if (!existing) {
        await prisma.customer.create({
          data: { id: cus.id, name: cus.name, phone: cus.phone, email: cus.email, isActive: cus.isActive ?? true }
        });
      }
    }
  }

  // 1.5 Suppliers
  if (data.Supplier && data.Supplier.length > 0) {
    console.log(`Đang import ${data.Supplier.length} Suppliers...`);
    for (const sup of data.Supplier) {
      const existing = await prisma.supplier.findUnique({ where: { id: sup.id } });
      if (!existing) {
        await prisma.supplier.create({
          data: { id: sup.id, name: sup.name, phone: sup.phone, email: sup.email, isActive: sup.isActive ?? true }
        });
      }
    }
  }

  // 1.6 Warehouses
  if (data.Warehouse && data.Warehouse.length > 0) {
    console.log(`Đang import ${data.Warehouse.length} Warehouses...`);
    for (const wh of data.Warehouse) {
      const code = wh.id.substring(0, 8).toUpperCase();
      const existing = await prisma.warehouse.findFirst({ where: { OR: [{ id: wh.id }, { code }] } });
      if (!existing) {
        await prisma.warehouse.create({
          data: { id: wh.id, code, name: wh.name, isActive: wh.isActive ?? true }
        });
      }
    }
  }

  // 1.7 Products
  if (data.Product && data.Product.length > 0) {
    console.log(`Đang import ${data.Product.length} Products...`);
    for (const prod of data.Product) {
      const sku = prod.sku || `SKU-${prod.id.substring(0, 6)}`;
      const existing = await prisma.product.findFirst({ where: { OR: [{ id: prod.id }, { sku }] } });
      if (!existing) {
        await prisma.product.create({
          data: { id: prod.id, sku, name: prod.name, unit: prod.unit || "Cái", sellPrice: prod.sellPrice || "0", isActive: prod.isActive ?? true }
        });
      }
    }
  }

  // 2. Import Orders & Invoices
  if (data.SalesOrder && data.SalesOrder.length > 0) {
    console.log(`Đang import ${data.SalesOrder.length} SalesOrders và tạo Invoice...`);
    
    // Gom nhóm items theo salesOrderId
    const itemsByOrder: Record<string, any[]> = {};
    if (data.SalesOrderItem) {
      for (const item of data.SalesOrderItem) {
        (itemsByOrder[item.salesOrderId] ??= []).push(item);
      }
    }

    for (const so of data.SalesOrder) {
      // Map status V2 sang SME
      let status = "PENDING";
      if (so.status === "COMPLETED" || so.status === "DELIVERED") status = "DELIVERED";
      if (so.status === "CANCELLED") status = "CANCELLED";

      const totalAmt = Number(so.totalAmount || 0);
      const paidAmt = Number(so.paidAmount || 0);
      const balanceDue = Math.max(0, totalAmt - paidAmt);
      
      let paymentStatus = "UNPAID";
      if (paidAmt > 0 && balanceDue <= 0) paymentStatus = "PAID";
      else if (paidAmt > 0 && balanceDue > 0) paymentStatus = "PARTIAL";

      const items = itemsByOrder[so.id] || [];

      // Kiểm tra Order đã có chưa
      const existingOrder = await prisma.salesOrder.findUnique({ where: { id: so.id } });
      if (existingOrder) continue;

      await prisma.$transaction(async (tx) => {
        // Tạo SalesOrder
        const newSo = await tx.salesOrder.create({
          data: {
            id: so.id,
            orderCode: so.orderCode,
            status: status as any,
            paymentStatus: paymentStatus as any,
            fulfillmentType: so.fulfillmentType || "WAREHOUSE",
            customerId: so.customerId,
            warehouseId: so.warehouseId,
            salespersonId: so.salespersonId,
            userId: so.userId,
            saleDate: so.saleDate ? new Date(so.saleDate) : null,
            deliveredDate: so.deliveredDate ? new Date(so.deliveredDate) : null,
            totalAmount: totalAmt.toString(),
            taxAmount: so.taxAmount || "0",
            createdAt: new Date(so.createdAt),
            items: {
              create: items.map(it => ({
                id: it.id,
                productId: it.productId,
                productName: it.productName,
                unit: it.unit || "Cái",
                qty: it.qty,
                sellPrice: it.sellPrice || "0",
                sellTotal: it.sellTotal || "0",
                baseCost: it.baseCost || "0",
                profit: it.profit || "0",
                taxAmount: it.taxAmount || "0",
              }))
            }
          }
        });

        // Tạo Invoice cho Order này
        let invStatus = "OPEN";
        if (balanceDue <= 0) invStatus = "PAID";
        else if (paidAmt > 0) invStatus = "PARTIAL";
        
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: `INV-${newSo.orderCode}`,
            type: "AR",
            status: invStatus as any,
            customerId: newSo.customerId,
            salesOrderId: newSo.id,
            totalAmount: totalAmt.toString(),
            paidAmount: paidAmt.toString(),
            balanceDue: balanceDue.toString(),
          }
        });

        // Nếu có trả tiền, sinh Payment & PaymentApplication (chọn Account đầu tiên hoặc Account ảo)
        if (paidAmt > 0) {
          const firstAccount = await tx.account.findFirst();
          if (firstAccount) {
            await tx.payment.create({
              data: {
                direction: "IN",
                amount: paidAmt.toString(),
                accountId: firstAccount.id,
                customerId: newSo.customerId,
                description: `Import tự động: Thanh toán cho ${newSo.orderCode}`,
                date: newSo.deliveredDate || newSo.saleDate || new Date(),
                applications: {
                  create: [{
                    invoiceId: invoice.id,
                    appliedAmount: paidAmt.toString()
                  }]
                }
              }
            });
          }
        }
      });
    }
  }

  // 2.5 Import PurchaseOrders & Invoices
  if (data.PurchaseOrder && data.PurchaseOrder.length > 0) {
    console.log(`Đang import ${data.PurchaseOrder.length} PurchaseOrders và tạo Invoice...`);
    
    // Gom nhóm items theo purchaseOrderId
    const pItemsByOrder: Record<string, any[]> = {};
    if (data.PurchaseOrderItem) {
      for (const item of data.PurchaseOrderItem) {
        (pItemsByOrder[item.purchaseOrderId] ??= []).push(item);
      }
    }

    for (const po of data.PurchaseOrder) {
      // Map status V2 sang SME
      let status = "ORDERED";
      if (po.status === "COMPLETED" || po.status === "RECEIVED") status = "RECEIVED";
      if (po.status === "CANCELLED") status = "CANCELLED";

      const totalAmt = Number(po.totalAmount || 0);
      const paidAmt = Number(po.paidAmount || 0);
      const balanceDue = Math.max(0, totalAmt - paidAmt);
      
      let paymentStatus = "UNPAID";
      if (paidAmt > 0 && balanceDue <= 0) paymentStatus = "PAID";
      else if (paidAmt > 0 && balanceDue > 0) paymentStatus = "PARTIAL";

      const items = pItemsByOrder[po.id] || [];

      // Kiểm tra Order đã có chưa
      const existingOrder = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
      if (existingOrder) continue;

      await prisma.$transaction(async (tx) => {
        // Tạo PurchaseOrder
        const newPo = await tx.purchaseOrder.create({
          data: {
            id: po.id,
            orderCode: po.orderCode,
            status: status as any,
            paymentStatus: paymentStatus as any,
            supplierId: po.supplierId,
            warehouseId: po.warehouseId,
            userId: po.userId,
            orderDate: po.orderDate ? new Date(po.orderDate) : null,
            receivedDate: po.receivedDate ? new Date(po.receivedDate) : null,
            totalAmount: totalAmt.toString(),
            taxAmount: po.taxAmount || "0",
            createdAt: new Date(po.createdAt),
            items: {
              create: items.map((it: any) => ({
                id: it.id,
                productId: it.productId,
                productName: it.productName,
                unit: it.unit || "Cái",
                qty: it.qty,
                buyPrice: it.buyPrice || "0",
                buyTotal: it.buyTotal || "0",
                taxAmount: it.taxAmount || "0",
              }))
            }
          }
        });

        // Tạo Invoice cho Order này
        let invStatus = "OPEN";
        if (balanceDue <= 0) invStatus = "PAID";
        else if (paidAmt > 0) invStatus = "PARTIAL";
        
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: `PINV-${newPo.orderCode}`,
            type: "AP",
            status: invStatus as any,
            supplierId: newPo.supplierId,
            purchaseOrderId: newPo.id,
            totalAmount: totalAmt.toString(),
            paidAmount: paidAmt.toString(),
            balanceDue: balanceDue.toString(),
          }
        });

        // Nếu có trả tiền, sinh Payment & PaymentApplication
        if (paidAmt > 0) {
          const firstAccount = await tx.account.findFirst();
          if (firstAccount) {
            await tx.payment.create({
              data: {
                direction: "OUT",
                amount: paidAmt.toString(),
                accountId: firstAccount.id,
                supplierId: newPo.supplierId,
                description: `Import tự động: Thanh toán cho ${newPo.orderCode}`,
                date: newPo.receivedDate || newPo.orderDate || new Date(),
                applications: {
                  create: [{
                    invoiceId: invoice.id,
                    appliedAmount: paidAmt.toString()
                  }]
                }
              }
            });
          }
        }
      });
    }
  }

  // 3. Import Transactions (Thu chi tự do)
  if (data.Transaction && data.Transaction.length > 0) {
    console.log(`Đang import ${data.Transaction.length} Transactions...`);
    for (const trx of data.Transaction) {
      await prisma.transaction.upsert({
        where: { id: trx.id },
        update: {},
        create: {
          id: trx.id,
          date: trx.date ? new Date(trx.date) : new Date(),
          type: trx.type || "EXPENSE",
          amount: trx.amount || "0",
          accountId: trx.accountId,
          cashFlowGroup: trx.cashFlowGroup || "OPERATIONAL",
          description: trx.category ? `[${trx.category}] ${trx.description || ""}` : (trx.description || "Nhập từ hệ thống cũ"),
          customerId: trx.customerId,
          supplierId: trx.supplierId,
        },
      });
    }
  }

  console.log("--- HOÀN TẤT MIGRATION DỮ LIỆU ---");
}

main()
  .catch((e) => {
    console.error("Lỗi Migration:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
