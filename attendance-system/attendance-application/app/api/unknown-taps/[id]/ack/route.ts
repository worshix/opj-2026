import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.unknownTap.updateMany({
    where: { id },
    data: { acknowledged: true },
  });
  return NextResponse.json({ ok: true });
}
