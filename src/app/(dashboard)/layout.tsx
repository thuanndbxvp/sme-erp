import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  // Lấy role tươi từ DB dựa trên userId
  let userRole = "GUEST";
  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: { select: { name: true } } }
    });
    if (dbUser?.role?.name) {
      userRole = dbUser.role.name;
    }
  }

  const userName = session?.user?.name || "Người dùng";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg)" }}>
      <Sidebar userRole={userRole} userName={userName} />
      <main style={{ flex: 1, marginLeft: "var(--sidebar-width)", padding: "var(--space-8)" }}>
        {children}
      </main>
    </div>
  );
}
