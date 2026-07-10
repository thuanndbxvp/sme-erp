import { prisma } from "@/lib/prisma";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, include: { role: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, marginBottom: "var(--space-6)" }}>Quản lý người dùng</h1>
      <UsersClient users={JSON.parse(JSON.stringify(users))} roles={JSON.parse(JSON.stringify(roles))} />
    </div>
  );
}
