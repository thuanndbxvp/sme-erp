import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Chống XSS (cross-site scripting) trên trình duyệt cũ
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Chống MIME-sniffing — trình duyệt không tự đoán content-type
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Content Security Policy — chặn XSS và script lạ
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.upstash.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
          },
          // Chống Clickjacking — cấm nhúng trang vào iframe
          { key: "X-Frame-Options", value: "DENY" },
          // Referrer chỉ gửi origin khi cross-origin — không lộ full URL
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Bắt buộc HTTPS (HSTS) — 1 năm, bao gồm subdomain
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Vô hiệu hóa quyền truy cập camera/micro/geo của trình duyệt
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
