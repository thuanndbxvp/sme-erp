import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";

const quickAddSchema = z.object({
  type: z.enum(["customer", "supplier", "product"]),
  name: z.string().min(1).transform(val => sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} })),
  phone: z.string().optional().transform(val => val ? sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} }) : undefined),
  unit: z.string().optional().transform(val => val ? sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} }) : undefined),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = quickAddSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const { type, name, phone, unit } = result.data;

    if (type === "customer") {
      const c = await prisma.customer.create({ data: { name, phone: phone || null } });
      return NextResponse.json(c, { status: 201 });
    }
    if (type === "supplier") {
      const s = await prisma.supplier.create({ data: { name } });
      return NextResponse.json(s, { status: 201 });
    }
    if (type === "product") {
      const p = await prisma.product.create({ data: { sku: `SP-${Date.now()}`, name, unit: unit || "cái" } });
      return NextResponse.json(p, { status: 201 });
    }
    
    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
