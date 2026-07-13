# Micro-Step Execution Workflow: Sửa lỗi Build Vercel (Thiếu Dependencies)

Thực hiện cài đặt các thư viện bị thiếu mà Vercel báo lỗi: `lucide-react` và `recharts`.

## BƯỚC 1: Cài đặt Dependencies
**Hành động:** Chạy lệnh npm install để bổ sung thư viện.
**Lệnh thực thi:**
```bash
npm install lucide-react recharts
```

## BƯỚC 2: Kiểm tra lại Build ở Local (Tuỳ chọn)
**Hành động:** Đảm bảo rằng việc build ở local sẽ không còn báo lỗi `Module not found` tương tự.
**Lệnh thực thi:**
```bash
npm run build
```

## BƯỚC 3: Commit và Push
**Hành động:** Commit lại file `package.json` và `package-lock.json` sau khi đã cài thêm thư viện và push lên git để Vercel tự động deploy lại.
**Lệnh thực thi:**
```bash
git add package.json package-lock.json
git commit -m "Fix Vercel build: install missing dependencies lucide-react and recharts"
git push
```
