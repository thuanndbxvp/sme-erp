# PLAN: Khởi động lại Dev Server (Fix sập CSS)

## Kiến trúc tổng quan
Hiện tượng toàn bộ giao diện biến thành HTML thuần (chữ đen, nền trắng, Sidebar biến mất, các text dính đè lên nhau) là biểu hiện của việc **sập pipeline CSS**.

**Nguyên nhân:**
Tiến trình `npm run dev` đã chạy ngầm liên tục từ 15 phút trước. Khi tôi nâng cấp lõi Tailwind v4 và thay đổi file `postcss.config.js` dưới hệ thống, Next.js Dev Server không thể "Hot Reload" (tải nóng) các file cấu hình cấp thấp như PostCSS. Kết quả là bộ biên dịch CSS của nó bị "ngáo", ném ra file HTML không đính kèm bất kỳ dòng CSS nào.

**Giải pháp:**
Việc này rất đơn giản và thường gặp. Chỉ cần Kill tiến trình Node đang chạy (để tắt Dev Server cũ), dọn sạch rác trong thư mục `.next` (cache biên dịch), và khởi động lại `npm run dev`. Trình biên dịch sẽ đọc lại cấu hình Tailwind v4 chuẩn chỉ từ đầu.

## Danh sách file/hành động
1. `Terminal`: Tắt Node, xóa `.next`, chạy lại `npm run dev`.
