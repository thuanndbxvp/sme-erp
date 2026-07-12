# PLAN: Sửa lỗi Build Next.js (Chạy trên môi trường Git Bash / MINGW64)

## 1. Phân tích nguyên nhân
Trong lúc thực thi dọn dẹp môi trường ở tác vụ trước, Tầng 2 đã sử dụng lệnh `Remove-Item` của PowerShell, nhưng sếp lại đang dùng Terminal là **Git Bash (MINGW64)** nên bị báo lỗi `command not found`. 
Thêm vào đó, việc dùng tool phụ như `rimraf` đang chạy khá chậm và rề rà.

## 2. Giải pháp
Vì chúng ta đang ở môi trường Git Bash, công cụ mạnh mẽ và tốc độ nhất để xóa thư mục lớn (như `node_modules` hay `.next`) chính là lệnh native `rm -rf`. 
Chúng ta sẽ đập đi xây lại theo quy trình cực nhanh: xóa toàn bộ cache, xóa file lock, cài mới hoàn toàn và build lại.

## 3. Danh sách tác vụ
- Dọn dẹp siêu tốc bằng bash (`rm -rf`).
- Chạy lại `npm install`.
- Build lại hệ thống bằng `npm run build`.
