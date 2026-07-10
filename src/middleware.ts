import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware Go-Live — Security Hardening (Phase 3.2)
 *
 * 1. Rate Limiting cho API Login (/api/auth/callback/credentials):
 *    Chặn Brute-force — tối đa 5 requests / 1 phút / IP.
 *    Dùng @upstash/ratelimit + @upstash/redis (serverless-friendly).
 *
 * 2. Auth Choke: Chặn truy cập các trang nội bộ nếu chưa có session cookie.
 *    Trừ /login, /api/auth/* (NextAuth cần các route này để đăng nhập/đăng xuất).
 *
 * 3. Security Headers: X-Frame-Options, X-Content-Type-Options, HSTS.
 *    (Bổ sung cho middleware; next.config.ts headers() cũng có set — phòng thủ sâu.)
 *
 * LƯU Ý: Nếu chưa cấu hình UPSTASH_REDIS_REST_URL / TOKEN (dev local), rate limit
 * sẽ tự động bỏ qua (fail-open) để không chặn dev. Production BẮT BUỘC cấu hình.
 */

// ---- Rate Limiter (lazy init — chỉ tạo khi có env) ----
let loginRateLimit: ReturnType<typeof createRatelimit> | null = null;

function createRatelimit() {
  // Dynamic import để không crash khi chưa cài @upstash/redis (mặc dù đã add).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Ratelimit } = require("@upstash/ratelimit");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis");

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 requests / 1 phút
    prefix: "sme-erp:login-rl",
  });
}

function getRatelimiter() {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    loginRateLimit ??= createRatelimit();
    return loginRateLimit;
  }
  return null; // Dev mode — chưa cấu hình Upstash → bỏ qua rate limit
}

// ---- Danh sách path công khai (kh cần session) ----
const PUBLIC_PATHS = [
  "/login",
  "/api/auth", // NextAuth routes: signin, signout, callback, session
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate Limit cho API Login (chống Brute-force)
  if (pathname === "/api/auth/callback/credentials") {
    const limiter = getRatelimiter();
    if (limiter) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "127.0.0.1";
      const { success } = await limiter.limit(ip);
      if (!success) {
        return new NextResponse(
          "Too Many Requests. Tài khoản tạm khóa do thử quá nhiều lần.",
          { status: 429 },
        );
      }
    }
  }

  // 2. Auth Choke — chặn truy cập trang nội bộ nếu chưa có session cookie
  //    NextAuth v5 JWT session dùng cookie "authjs.session-token" (dev) hoặc
  //    "__Secure-authjs.session-token" (prod HTTPS).
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken && !isPublicPath(pathname)) {
    // Nếu là API request → trả 401 JSON thay vì redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. Security Headers chống XSS & Clickjacking (phòng thủ sâu cùng next.config.ts)
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  return response;
}

export const config = {
  // Chạy middleware trên mọi route TRỪ static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};