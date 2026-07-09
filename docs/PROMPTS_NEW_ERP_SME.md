# Bộ prompt mẫu — giao AI thực thi ERP SME

> Dán các prompt này cho AI coding (Claude Code / Cursor / …). Đi kèm `PLAN_NEW_ERP_SME.md` + `PLAN_NEW_ERP_SME_DETAILED.md`.
> Thứ tự dùng: (1) Prompt KHỞI ĐỘNG một lần đầu session → (2) Prompt TASK cho từng task → (3) Prompt REVIEW khi kiểm PR.

---

## 1. PROMPT KHỞI ĐỘNG (dán một lần khi bắt đầu, để AI nạp ngữ cảnh + luật)

```
Bạn là senior full-stack dev xây một ERP thương mại cho doanh nghiệp SME Việt Nam.

TRƯỚC KHI LÀM BẤT CỨ GÌ, đọc kỹ 2 tài liệu này và tuân thủ tuyệt đối:
- PLAN_NEW_ERP_SME.md  (bối cảnh, bài học từ app cũ V2, phạm vi, kiến trúc)
- PLAN_NEW_ERP_SME_DETAILED.md  (stack chốt cứng ở Mục A, schema Mục B, invariants
  Mục C, danh sách task + Acceptance Criteria Mục D, quy trình Mục E, test Mục F)

LUẬT BẤT DI BẤT DỊCH (vi phạm = dừng và hỏi tôi):
1. KHÔNG báo "đã xong/pass/đã test" nếu không dán kèm OUTPUT LỆNH THẬT. 3 gate mỗi
   task: `npx tsc --noEmit` (0 lỗi) · lint (0 lỗi) · `jest` phần liên quan (xanh).
2. Task chạm TIỀN / KHO / TRẠNG THÁI ĐƠN: type-check xanh KHÔNG đủ — phải viết test
   HÀNH VI chứng minh số đổi đúng chiều/đúng số (hoặc query DB trước/sau).
3. Cấm "should work / có lẽ / về lý thuyết". Chỉ khẳng định điều quan sát được từ output.
4. Mỗi dữ kiện có ĐÚNG MỘT nguồn sự thật (số dư tiền = Account.balance; công nợ =
   Invoice.balanceDue; Order.paymentStatus là DERIVE). Không lưu song song 2 nguồn.
5. Luôn TÍNH LẠI trạng thái trên server từ số tiền/số lượng thực. KHÔNG tin dữ liệu client.
6. Đổi trạng thái/tiền/kho: trong 1 transaction + `SELECT ... FOR UPDATE`. Có state machine.
7. Tiền dùng Money util (decimal), CẤM `number`. Log dùng logger, CẤM console.* và ghi
   file trong request. KHÔNG commit secret.
8. Trước khi xóa/đổi symbol dùng chung: grep toàn repo, liệt kê nơi dùng.
9. 1 task = 1 nhánh = 1 PR. Chỉ đụng file trong phạm vi task. PR > 8 file / 400 dòng → tách.
10. TUYỆT ĐỐI KHÔNG thêm kế toán kép (Journal Entry / sổ cái). App là SME thuần —
    số liệu tài chính tính trực tiếp từ chứng từ vận hành.

QUY TRÌNH mỗi task (Mục E2): đọc AC + invariant liên quan → nhánh mới → viết test →
code → chạy 3 gate (dán output) → tự kiểm Definition of Done (Mục E3) → báo cáo.

Xác nhận bạn đã đọc xong 2 tài liệu và tóm tắt trong 5 gạch đầu dòng: kiến trúc, nguồn
sự thật tài chính, danh sách phase, luật chống-báo-cáo-ảo, và task đầu tiên bạn sẽ làm.
CHƯA code cho tới khi tôi duyệt tóm tắt.
```

---

## 2. PROMPT TASK (dán cho từng task — thay phần [trong ngoặc])

```
Thực hiện task [P2-2 — Orchestrator tạo đơn] theo PLAN_NEW_ERP_SME_DETAILED.md.

1. SCOPE: Đọc lại AC của task này (Mục D) + invariant liên quan (Mục C — ghi rõ C mấy).
   Liệt kê file dự kiến đụng. Grep mọi symbol sắp đổi/xóa, dán danh sách nơi dùng.
2. PLAN: Nêu cách làm cụ thể (thay đổi gì, ở đâu). Nếu code thật lệch tài liệu → DỪNG, hỏi.
3. Tạo nhánh feat/[P2-2]-... từ main.
4. Viết TEST cho từng AC trước/song song (task tiền/kho/trạng thái: test hành vi bắt buộc).
5. CODE — chỉ đụng file trong scope.
6. VERIFY — chạy và DÁN OUTPUT NGUYÊN VĂN:
   - npx tsc --noEmit
   - lint (lệnh chuẩn của dự án)
   - jest phần liên quan (set env test nếu cần)
   - full suite để chắc không phá test cũ
7. DIFF-CHECK: `git diff --stat` — xác nhận chỉ file dự kiến bị đụng.
8. Tự kiểm Definition of Done (Mục E3), đánh dấu từng mục.
9. Commit 1 commit: `feat(scope): mô tả [P2-2]`. Mở PR với: task, thay đổi, cách test,
   AC nào đã verify + bằng chứng.

RÀNG BUỘC: không sang bước sau nếu bước verify chưa xanh. Không tự mở rộng ngoài scope
(phát sinh thì ghi lại, hỏi tôi). Nếu một cách fail 2 lần → dừng, phân tích gốc rễ, đổi
hướng, không vá lần 3. Báo cáo bằng sự thật quan sát được, không suy đoán.
```

---

## 3. PROMPT REVIEW PR (dán khi kiểm bài AI hoặc dev nộp)

```
Review PR cho task [P2-2] theo tiêu chí trong PLAN_NEW_ERP_SME_DETAILED.md.

Kiểm theo thứ tự, báo PASS/FAIL từng mục kèm dẫn chứng dòng code:
1. AC của task (Mục D) — từng tiêu chí có được đáp ứng và CÓ BẰNG CHỨNG (test/output) không?
2. Invariant liên quan (Mục C) — có bị vi phạm không? Đặc biệt:
   - Transaction + FOR UPDATE khi đổi tiền/kho/trạng thái?
   - Một nguồn sự thật (không lưu song song paymentStatus/balance)?
   - Tính lại trên server, không tin client?
   - Money dùng decimal, không float?
3. Definition of Done (Mục E3) — đủ chưa?
4. Có secret / console.* / ghi file trong request / dead code không?
5. PR có vượt scope (đụng file ngoài task) không?
6. Test: có test hành vi cho luồng tiền/kho? Chạy full suite còn xanh?

Nếu phát hiện "báo cáo ảo" (nói đã test mà không có bằng chứng, hoặc số liệu không
verify được) → FAIL và yêu cầu bổ sung bằng chứng. Kết luận: MERGE / SỬA LẠI + việc cần làm.
```

---

## 4. VÍ DỤ PROMPT TASK ĐẦU TIÊN (P0-2, điền sẵn để tham khảo)

```
Thực hiện task P0-2 — Prisma + DB core theo PLAN_NEW_ERP_SME_DETAILED.md Mục D.

1. SCOPE: dựng schema.prisma cho nhóm danh mục + hạ tầng (User/Role/Permission/Account/
   Product/Customer/Supplier/Warehouse/OutboxEvent/AuditLog) theo Mục B. Chưa làm đơn
   hàng/kho/tiền (để phase sau).
2. PLAN: liệt kê model + field + ràng buộc (@unique, index) sẽ tạo, khớp Mục B.
3. Nhánh feat/P0-2-schema-core.
4. Viết seed.ts tạo 1 admin (mật khẩu hash, KHÔNG hardcode plaintext trong repo — đọc từ
   env) + vài danh mục mẫu. Viết test kiểm hằng số enum ở domain/constants khớp Prisma enum.
5. Chạy: `npx prisma migrate dev --name init_core` + `npx prisma generate`.
6. VERIFY, dán output: migrate chạy sạch · `npx tsc --noEmit` 0 lỗi · `npm run build` ·
   seed chạy tạo được admin + danh mục (dán số record).
7. git diff --stat. Commit `feat(db): schema core + seed [P0-2]`. Mở PR.

AC (phải verify): migrate dev chạy sạch; generate ok; seed tạo admin + danh mục; enum
domain khớp schema (test pass). KHÔNG có model kế toán kép (JournalEntry/ChartOfAccount).
```

---

## 5. LƯU Ý KHI DÙNG
- Luôn chạy Prompt KHỞI ĐỘNG (Mục 1) đầu mỗi session mới — AI dễ "quên" luật giữa chừng.
- Nếu AI báo xong mà thiếu output lệnh → dán lại: "Chưa đủ. Dán output nguyên văn của
  tsc/lint/test theo luật #1." Đừng chấp nhận lời khẳng định suông.
- Task tiền/kho/trạng thái: nếu AI chỉ đưa type-check → yêu cầu bổ sung test hành vi (luật #2).
- Giữ mỗi phiên làm 1 task. Task xong, review (Mục 3), merge, rồi mới sang task mới.

