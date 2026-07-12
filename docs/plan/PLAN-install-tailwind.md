# PLAN: Tích hợp Tailwind CSS (Fix lỗi vỡ giao diện)

## Kiến trúc tổng quan
Thưa sếp, lỗi "trắng trơn" (Vỡ giao diện hoàn toàn) xuất phát từ một sự lệch pha về công nghệ giữa bản vẽ và hệ thống:
1. Trong các Lựa chọn (Epic) nâng cấp giao diện gần đây, tôi đã sử dụng bộ CSS chuẩn công nghiệp là **Tailwind CSS** (Bắt buộc phải có để lên đời giao diện FinTech bằng Shadcn UI).
2. Tuy nhiên, source code hiện tại của sếp đang xài một bộ CSS "tự trồng" (Custom CSS) thuần túy trong file `globals.css`. Nó hoàn toàn không được cài Tailwind!
3. Hậu quả: Trình duyệt đọc các class xịn xò như `grid-cols-4`, `p-6`, `bg-white`... nhưng không hiểu gì cả, nên nó hiển thị text trần trụi.

**Quyết định kiến trúc của Tầng 1:**
- Bắt buộc phải **Cài đặt Tailwind CSS** vào Next.js ngay lập tức. Đây là nền tảng sống còn để nâng cấp UI.
- Vẫn giữ lại toàn bộ các biến màu sắc (CSS Variables) cũ của sếp trong `globals.css` để không làm hỏng các trang cũ, chỉ bơm thêm bộ máy Tailwind vào trên cùng.

## Luồng dữ liệu (Data Flow)
1. Cài đặt các thư viện lõi của Tailwind (`tailwindcss`, `postcss`, `autoprefixer`).
2. Sinh ra file `tailwind.config.ts` để nó tự động quét toàn bộ thư mục `src/` và tạo ra mã CSS tương ứng.
3. Nhúng 3 dòng lệnh `@tailwind` vào đầu file `globals.css` để khởi động bộ máy.

## Danh sách file cần sửa / tạo mới
1. Terminal: Chạy lệnh cài package.
2. Tạo mới: `tailwind.config.ts` và `postcss.config.js`.
3. Cập nhật: `src/app/globals.css` (Chỉ thêm 3 dòng ở đầu).
