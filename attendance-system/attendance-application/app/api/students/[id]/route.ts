import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Cascades to the student's AttendanceRecord rows (see schema.prisma).
  await prisma.student.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
