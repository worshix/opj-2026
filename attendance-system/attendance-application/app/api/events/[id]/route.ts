import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEventRoster } from "@/lib/attendance";

// Drives the event detail page: a past (or active) event plus every
// student's computed Present/Left/Absent status against it, so finished
// events remain fully inspectable rather than only summarized in the list.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const students = await getEventRoster(id);
  return NextResponse.json({ event, students });
}
