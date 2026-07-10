import { prisma } from "@/lib/prisma";
import RolesClient from "./RolesClient";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const [roles, permissions, users] = await Promise.all([
    prisma.role.findMany({ include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    prisma.permission.findMany({ orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, include: { role: true }, orderBy: { name: "asc" }, take: 50 }),
  ]);
  return <RolesClient roles={JSON.parse(JSON.stringify(roles))} permissions={JSON.parse(JSON.stringify(permissions))} users={JSON.parse(JSON.stringify(users))} />;
}
