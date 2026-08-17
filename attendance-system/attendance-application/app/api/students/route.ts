import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const students = await prisma.student.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ students });
}

interface CreateStudentBody {
  name?: string;
  regNumber?: string;
  cardUid?: string;
}

export async function POST(req: NextRequest) {
  let body: CreateStudentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = body.name?.trim();
  const regNumber = body.regNumber?.trim();
  const cardUid = body.cardUid?.trim().toUpperCase();

  if (!name || !regNumber || !cardUid) {
    return NextResponse.json(
      { error: "name, regNumber and cardUid are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.student.findFirst({
    where: { OR: [{ regNumber }, { cardUid }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A student with that registration number or card is already registered" },
      { status: 409 }
    );
  }

  const student = await prisma.student.create({
    data: { name, regNumber, cardUid },
  });

  // Registering the card resolves any pending "unknown tap" toasts for it.
  await prisma.unknownTap.updateMany({
    where: { cardUid, acknowledged: false },
    data: { acknowledged: true },
  });

  return NextResponse.json({ student }, { status: 201 });
}
