/**
 * Sinh mã đơn hàng server-side. Prefix + timestamp + random ngắn để tránh trùng;
 * cột orderCode có @unique nên nếu hiếm hoi trùng, DB sẽ chặn (caller retry).
 *
 * `now` truyền vào để test tất định (không gọi Date.now ngầm trong service).
 */
export function generateOrderCode(prefix: "SO" | "PO", now: Date, random: number): string {
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const ms = String(now.getTime() % 100000).padStart(5, "0");
  const rnd = String(Math.floor(random * 1000)).padStart(3, "0");
  return `${prefix}${yy}${mm}${dd}-${ms}${rnd}`;
}
