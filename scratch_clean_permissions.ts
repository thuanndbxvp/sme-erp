import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACTIVE_PERMISSIONS: Record<string, string> = {
  "system.admin": "Quản trị hệ thống (Toàn quyền)",
  "system.init_balance": "Khởi tạo số dư đầu kỳ",
  "product.read": "Xem danh mục Sản phẩm",
  "product.write": "Quản lý Sản phẩm (Thêm/Sửa/Xóa)",
  "customer.read": "Xem danh mục Khách hàng",
  "customer.write": "Quản lý Khách hàng (Thêm/Sửa/Xóa)",
  "supplier.read": "Xem danh mục Nhà cung cấp",
  "supplier.write": "Quản lý Nhà cung cấp (Thêm/Sửa/Xóa)",
  "warehouse.read": "Xem danh mục Kho",
  "warehouse.write": "Quản lý Kho (Thêm/Sửa/Xóa)",
  "order.create": "Tạo đơn hàng (Bán/Mua)",
  "sales.order.edit": "Sửa Đơn Bán Hàng",
  "purchase.order.edit": "Sửa Đơn Mua Hàng",
  "order.deliver": "Cập nhật Giao / Nhận hàng",
  "order.cancel": "Hủy đơn hàng",
  "debt.pay": "Thanh toán công nợ",
  "cashflow.create": "Lập Phiếu Thu / Chi",
  "cashflow.transaction.edit": "Sửa Giao dịch Quỹ",
  "cashflow.transaction.delete": "Xóa Giao dịch Quỹ",
  "cashflow.account.manage": "Quản lý Danh mục Quỹ (Tiền mặt/NH)",
  "cashflow.category.manage": "Quản lý Phân loại Thu/Chi",
  "inventory.adjust": "Điều chỉnh tồn kho (Kiểm kê/Hư hỏng)",
  "users.delete": "Xóa tài khoản người dùng",
  "hr.view": "Xem hồ sơ Nhân sự & Bảng lương",
  "hr.manage": "Quản lý Nhân sự (Tạm ứng/Chốt lương)",
  "commission.approve": "Duyệt Hoa hồng"
};

async function main() {
  console.log("=== BẮT ĐẦU DỌN DẸP QUYỀN (PERMISSIONS) ===");

  const activeCodes = Object.keys(ACTIVE_PERMISSIONS);

  // 1. Cập nhật (Upsert) các quyền CHUẨN để đảm bảo chúng có Description tiếng Việt
  for (const [code, description] of Object.entries(ACTIVE_PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description }, // Mặc áo mới cho quyền cũ
      create: { code, description }
    });
  }
  console.log("✅ Đã cập nhật mô tả Tiếng Việt cho các quyền đang sử dụng.");

  // 2. Tìm tất cả các quyền KHÔNG NẰM TRONG danh sách chuẩn (Quyền Rác)
  const allPermissions = await prisma.permission.findMany();
  const junkPermissions = allPermissions.filter(p => !activeCodes.includes(p.code));
  const junkIds = junkPermissions.map(p => p.id);

  if (junkIds.length > 0) {
    console.log(`🗑️ Phát hiện ${junkIds.length} quyền rác (bóng ma). Tiến hành gỡ bỏ...`);
    
    // 3. Xóa các quyền rác khỏi bảng liên kết RolePermission trước (để tránh lỗi khóa ngoại)
    const deleteRolePerms = await prisma.rolePermission.deleteMany({
      where: { permissionId: { in: junkIds } }
    });
    console.log(`- Đã gỡ ${deleteRolePerms.count} liên kết quyền khỏi các Role.`);

    // 4. Xóa quyền rác khỏi bảng Permission
    const deletePerms = await prisma.permission.deleteMany({
      where: { id: { in: junkIds } }
    });
    console.log(`- Đã xóa tận gốc ${deletePerms.count} quyền rác khỏi Database.`);
  } else {
    console.log("✨ Không có quyền rác nào cần dọn dẹp.");
  }

  // 5. Đảm bảo Role ADMIN có TOÀN BỘ quyền chuẩn
  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  if (adminRole) {
    const adminPerms = await prisma.permission.findMany({ where: { code: { in: activeCodes } } });
    
    // Gỡ hết liên kết cũ của ADMIN và gán lại trọn bộ mới cho sạch
    await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
    await prisma.rolePermission.createMany({
      data: adminPerms.map(p => ({ roleId: adminRole.id, permissionId: p.id }))
    });
    console.log("👑 Đã reset và cấp Full quyền chuẩn cho Role ADMIN.");
  }

  console.log("=== HOÀN TẤT DỌN DẸP ===");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
