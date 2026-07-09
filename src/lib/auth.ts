import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * NextAuth (Auth.js v5) — credentials + JWT session.
 *
 * Quyết định (đã duyệt): dùng JWT session thay vì DB session vì credentials
 * provider của Auth.js v5 không hỗ trợ DB session. ĐỔI LẠI: quyền (RBAC) KHÔNG
 * đọc từ token — luôn load tươi từ DB mỗi request qua RbacService (bài học V2 #3).
 * Token chỉ mang `userId` để định danh; không tin role/permission trong token.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) {
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          logger.warn({ email }, "Đăng nhập thất bại: sai mật khẩu");
          return null;
        }
        // Chỉ trả định danh — KHÔNG nhét role/permission vào session.
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
