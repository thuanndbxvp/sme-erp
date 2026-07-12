# Micro-Step Execution Workflow: Refactor Cashflow UI

**File mục tiêu:** `d:\sme-erp\src\app\(dashboard)\cashflow\CashflowClient.tsx`

## Bước 1: Thay thế khối Header và Summary trong CashflowTab
Yêu cầu Tầng 2 tìm đến phần return của `CashflowTab` (khoảng dòng 68 trở đi), và thay thế toàn bộ từ thẻ `<div style={{ display: "flex", justifyContent: "flex-end"...>` cho đến hết thẻ bọc `Summary` (trước bảng danh sách giao dịch).

**Đoạn code MỚI cần thay thế vào:**
```tsx
      {/* Header Container */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        
        {/* Summary */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", flex: 1 }}>
          <div style={{ background: "var(--color-primary)10", border: "2px solid var(--color-primary)", borderRadius: "var(--radius-lg)", padding: "var(--space-3)", minWidth: 220 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-1)" }}>
              <span style={{ fontWeight: 800, fontSize: "var(--text-sm)", color: "var(--color-primary)", textTransform: "uppercase" }}>TỔNG QUỸ</span>
              <span style={{ fontWeight: 800, color: "var(--color-primary)", fontSize: "var(--text-lg)" }}>{totalBal.toLocaleString("vi-VN")} đ</span>
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-subtle)" }}>
              <span style={{ display: "inline-block", marginRight: "var(--space-3)" }}>Thu: <span style={{ color: "var(--color-success)", fontWeight: 600 }}>{totalInc.toLocaleString("vi-VN")}</span></span>
              <span style={{ display: "inline-block" }}>Chi: <span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>{totalExp.toLocaleString("vi-VN")}</span></span>
            </div>
          </div>
          {summary.map((a: any) => (
            <div key={a.id} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-3)", minWidth: 200 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-1)", gap: "var(--space-3)" }}>
                <span style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{a.code}</span>
                <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: Number(a.balance) >= 0 ? "var(--color-success)" : "var(--color-destructive)" }}>{Number(a.balance).toLocaleString("vi-VN")} đ</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-foreground-subtle)" }}>
                <span style={{ display: "inline-block", marginRight: "var(--space-3)" }}>Thu: <span style={{ color: "var(--color-success)", fontWeight: 600 }}>{a.income.toLocaleString("vi-VN")}</span></span>
                <span style={{ display: "inline-block" }}>Chi: <span style={{ color: "var(--color-destructive)", fontWeight: 600 }}>{a.expense.toLocaleString("vi-VN")}</span></span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setShowForm(!showForm)} style={{...btn, whiteSpace: "nowrap"}}>+ Ghi nhận</button>
      </div>

      {showForm && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)", marginBottom: "var(--space-4)" }}>
          {error && <div style={{ padding: "var(--space-2)", background: "var(--color-destructive-bg)", color: "var(--color-destructive)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-xs)", marginBottom: "var(--space-3)" }}>{error}</div>}
          <form action={onSubmit} style={{ display: "grid", gap: "var(--space-3)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Phân loại *</label>
                <select name="categoryId" style={S} required>
                  <option value="">-- Chọn --</option>
                  {roots.map((r: any) => (
                    <optgroup key={r.id} label={r.name}>
                      <option value={r.id}>{r.name} (chung)</option>
                      {children(r.id).map((c: any) => <option key={c.id} value={c.id}>  {c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "block", marginBottom: 2 }}>Tài khoản *</label>
                <select name="accountId" style={S}>{accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} ({(Number(a.balance)||0).toLocaleString("vi-VN")} đ)</option>)}</select>
              </div>
            </div>
            
            <select name="type" style={S}><option value="INCOME">Thu vào</option><option value="EXPENSE">Chi ra</option></select>
            <input name="amount" type="number" step="0.01" placeholder="Số tiền" style={S} required />
            <input name="description" placeholder="Diễn giải" style={{...S, gridColumn: "1 / -1"}} />
            
            <div style={{ display: "flex", gap: "var(--space-3)", gridColumn: "1 / -1" }}>
              <button type="submit" disabled={pending} style={btn}>{pending ? "..." : "Xác nhận Ghi nhận"}</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...btn, background: "var(--color-surface)", color: "var(--color-foreground)", border: "1px solid var(--color-border-strong)" }}>Hủy</button>
            </div>
          </form>
        </div>
      )}
```

## Bước 2: Kiểm tra lại (Audit)
Tầng 2 sau khi copy paste phải đảm bảo:
- Form tạo giao dịch mới vẫn hoạt động (Submit form không lỗi).
- Hiển thị đầy đủ số dư, tiền thu, tiền chi trên các card dẹt.
- UI không bị vỡ trên trình duyệt.
