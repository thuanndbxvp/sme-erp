# MSEW: Fix ESLint errors (Unexpected any, unused variables)

## Bước 1: Sửa file `src/app/actions/debug-actions.ts`
- **Hành động:** Chuyển `e: any` thành `e: unknown`.
- **Tìm:**
```typescript
  } catch (e: any) {
    return e.message || String(e);
  }
```
- **Thay thế bằng:**
```typescript
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
```

## Bước 2: Sửa file `src/lib/action-result.ts`
- **Hành động:** Loại bỏ `any` khi xử lý thuộc tính message của `err`.
- **Tìm:**
```typescript
    return failure((err as any)?.message || "Có lỗi xảy ra, vui lòng thử lại");
```
- **Thay thế bằng:**
```typescript
    return failure(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
```

## Bước 3: Sửa file `src/services/order-orchestrator.service.ts`
- **Hành động:** Loại bỏ `as any` tại dòng 63.
- **Tìm:**
```typescript
        items: input.items.map((it) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, buyPrice: (it as any).buyPrice, taxAmount: (it as any).purchaseTaxAmount ?? "0" })),
```
- **Thay thế bằng:**
```typescript
        items: input.items.map((it) => ({ productId: it.productId, productName: it.productName, unit: it.unit, qty: it.qty, buyPrice: (it as { buyPrice: string }).buyPrice, taxAmount: (it as { purchaseTaxAmount?: string }).purchaseTaxAmount ?? "0" })),
```

## Bước 4: Sửa file `src/services/system-setting.service.ts`
- **Hành động:** Xóa biến `err: any` không sử dụng trong block catch (ở dòng 21).
- **Tìm:**
```typescript
    } catch (err: any) {
      // Fallback for Server Actions where unstable_cache might throw "incrementalCache missing"
```
- **Thay thế bằng:**
```typescript
    } catch {
      // Fallback for Server Actions where unstable_cache might throw "incrementalCache missing"
```

*Lưu ý cho Coder: Chạy lại `npm run build` sau khi thực hiện 4 bước trên.*
