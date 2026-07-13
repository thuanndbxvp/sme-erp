import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emails = [
    "kho@viettung.vn",
    "ketoan@viettung.vn",
    "accountant@viettung.vn",
    "sales@viettung.vn"
  ];

  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`[BỎ QUA] Không tìm thấy user: ${email}`);
      continue;
    }

    console.log(`[ĐANG XỬ LÝ] Đang xóa dữ liệu của ${email} (ID: ${user.id})...`);
    
    try {
      // Xóa các bảng liên quan trước để tránh lỗi Khóa ngoại (P2003)
      await prisma.auditLog.deleteMany({ where: { userId: user.id } });
      await prisma.employeeTransaction.deleteMany({ where: { userId: user.id } });
      await prisma.payout.deleteMany({ where: { userId: user.id } });
      await prisma.salesOrder.deleteMany({ where: { userId: user.id } });
      await prisma.salesOrder.updateMany({ where: { salespersonId: user.id }, data: { salespersonId: null } });
      await prisma.purchaseOrder.deleteMany({ where: { userId: user.id } });
      
      // Xóa user chính
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`[THÀNH CÔNG] Đã xóa hoàn toàn ${email}`);
    } catch (e: any) {
      console.error(`[THẤT BẠI] Lỗi khi xóa ${email}:`, e.message);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
