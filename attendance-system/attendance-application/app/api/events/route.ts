import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ events });
}

interface CreateEventBody {
  name?: string;
}

// Starting a new event auto-closes any currently active one (OVERVIEW.md
// open question #4) so the admin never has to remember to end the last
// event manually before the next one starts.
export async function POST(req: NextRequest) {
  let body: CreateEventBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const event = await prisma.$transaction(async (tx) => {
    await tx.event.updateMany({
      where: { isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });
    return tx.event.create({ data: { name } });
  });

  return NextResponse.json({ event }, { status: 201 });
}
