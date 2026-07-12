# PLAN: Xóa Tab "Tài khoản" thừa thãi trong Sổ quỹ

## 1. Bối cảnh
Người dùng nhận thấy Tab "Tài khoản" (AccountsTab) trong giao diện Tài chính đang bị thừa và lặp lại thông tin. 
- Tại Tab "Sổ quỹ", chúng ta đã có một thanh tóm tắt hiển thị trực quan thông tin của tất cả các tài khoản (Tổng quỹ, BANK, CASH, số dư, tổng thu/chi).
- Tab "Tài khoản" hiện tại chỉ hiển thị lại một bảng danh sách dạng read-only các tài khoản đó mà không mang lại giá trị gia tăng nào (không có tính năng Thêm/Sửa/Xóa tài khoản).

Do đó, việc xóa Tab này sẽ giúp tinh gọn UI, giảm Cognitive Load (gánh nặng nhận thức) cho người dùng.

## 2. Chi tiết công việc
Tập trung sửa đổi file `src/app/(dashboard)/cashflow/CashflowClient.tsx`:
1. Xoá định nghĩa trạng thái tab `accounts`:
   - Giảm kiểu dữ liệu của state `tab` từ `"cashflow" | "accounts" | "categories"` xuống chỉ còn `"cashflow" | "categories"`.
2. Xoá component `<TabBtn />` tương ứng:
   - Bỏ dòng: `<TabBtn active={tab === "accounts"} onClick={() => setTab("accounts")} label="🏦 Tài khoản" />`
3. Xoá dòng render component:
   - Bỏ dòng: `{tab === "accounts" && <AccountsTab accounts={accounts} />}`
4. **Xoá toàn bộ component `AccountsTab`**:
   - Xoá từ `function AccountsTab({ accounts }: { accounts: any[] }) { ... }` cho đến hết.

*(Nếu sau này hệ thống cần tính năng Thêm/Sửa/Khóa tài khoản ngân hàng, chúng ta sẽ đưa nó vào mục "Cấu hình" hoặc một trang Quản lý Tài khoản chuyên biệt, thay vì để lẫn lộn trong Sổ quỹ).*
