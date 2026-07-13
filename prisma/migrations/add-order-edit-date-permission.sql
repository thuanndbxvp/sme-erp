-- MSEW-edit-order-date: Thêm quyền "order.edit_date" cho phép sửa ngày tạo đơn hàng.
-- Idempotent: chạy nhiều lần không lỗi.
-- Áp dụng: Production DB (Neon) hoặc bất kỳ môi trường nào đã có schema.

-- 1) Tạo permission nếu chưa có
INSERT INTO "Permission" ("id", "code", "description")
SELECT gen_random_uuid(), 'order.edit_date', 'Cho phép sửa ngày tạo đơn hàng (backdate)'
WHERE NOT EXISTS (
  SELECT 1 FROM "Permission" WHERE "code" = 'order.edit_date'
);

-- 2) Gán permission cho role ADMIN (mặc định)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r, "Permission" p
WHERE r.name = 'ADMIN' AND p.code = 'order.edit_date'
ON CONFLICT DO NOTHING;