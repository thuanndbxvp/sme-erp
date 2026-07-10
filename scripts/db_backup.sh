#!/bin/bash
# =============================================================================
# SME ERP — Tự động backup database PostgreSQL (Disaster Recovery)
# =============================================================================
# Cách sử dụng:
#   1. Cấp quyền thực thi:  chmod +x scripts/db_backup.sh
#   2. Thêm vào crontab (chạy mỗi ngày lúc 2h sáng):
#      crontab -e
#      0 2 * * * /absolute/path/to/scripts/db_backup.sh >> /var/log/db_backup.log 2>&1
#
# Yêu cầu máy chủ:
#   - Đã cài postgresql-client (lệnh pg_dump)
#   - Đã cài AWS CLI và chạy `aws configure` (nếu dùng S3)
#   - Hoặc gsutil (nếu dùng Google Cloud Storage)
#
# Best Practice (DevSecOps): KHÔNG xóa file backup bằng script thủ công.
# Dùng S3 Bucket Lifecycle Rule (Expire current versions after 30 days) để
# tự động dọn dẹp file cũ — tránh rủi ro xóa nhầm.
# =============================================================================

set -e # Dừng script ngay nếu có lỗi

# ---- Cấu hình (đọc từ biến môi trường, fallback giá trị mặc định) ----
DB_URL="${DATABASE_URL:-postgresql://user:password@localhost:5432/sme_erp}"
S3_BUCKET="${BACKUP_S3_BUCKET:-s3://your-company-sme-erp-backups/database}"
TIMESTAMP=$(date +"%Y-%m-%d")
BACKUP_DIR="/tmp/sme_erp_backups"
FILE_NAME="sme_erp_backup_${TIMESTAMP}.sql.gz"
FILE_PATH="${BACKUP_DIR}/${FILE_NAME}"

mkdir -p "$BACKUP_DIR"

echo "[${TIMESTAMP}] Bắt đầu backup database PostgreSQL..."
# Dump và nén ngay lập tức bằng gzip để tiết kiệm dung lượng
pg_dump "$DB_URL" | gzip > "$FILE_PATH"

echo "[${TIMESTAMP}] Uploading lên cloud storage (${S3_BUCKET})..."
# Yêu cầu máy chủ đã cài đặt AWS CLI và chạy `aws configure`
aws s3 cp "$FILE_PATH" "${S3_BUCKET}/${FILE_NAME}"

echo "[${TIMESTAMP}] Xóa file tạm trên local..."
rm -f "$FILE_PATH"

echo "[${TIMESTAMP}] Backup thành công! File: ${S3_BUCKET}/${FILE_NAME}"