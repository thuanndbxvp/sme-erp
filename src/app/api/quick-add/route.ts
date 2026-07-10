import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { type, name, phone, unit } = await req.json();
    if (!name) return NextResponse.json({ error: "Thiếu tên" }, { status: 400 });

    if (type === "customer") {
      const c = await prisma.customer.create({ data: { name, phone: phone || null } });
      return NextResponse.json(c);
    }
    if (type === "supplier") {
      const s = await prisma.supplier.create({ data: { name } });
      return NextResponse.json(s);
    }
    if (type === "product") {
      const p = await prisma.product.create({ data: { sku: `SP-${Date.now()}`, name, unit: unit || "cái" } });
      return NextResponse.json(p);
    }
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
