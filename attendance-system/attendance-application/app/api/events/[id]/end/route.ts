import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!event.isActive) {
    return NextResponse.json({ event });
  }

  const updated = await prisma.event.update({
    where: { id },
    data: { isActive: false, endedAt: new Date() },
  });

  return NextResponse.json({ event: updated });
}
