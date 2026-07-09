import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/authorize";

/**
 * Bọc một server action: lấy session hiện tại (NextAuth), enforce quyền `code`,
 * rồi chạy `fn` với userId đã xác thực. Dùng trong app/ cho mọi mutation.
 *
 * Tách khỏi authorize.ts vì file này import next-auth (ESM); giữ lõi
 * requirePermission thuần để test không cần mock ESM.
 */
export function withPermission<TArgs extends unknown[], TResult>(
  code: string,
  fn: (userId: string, ...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const session = await auth();
    const userId = await requirePermission(session?.user?.id, code);
    return fn(userId, ...args);
  };
}
