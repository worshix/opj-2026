import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Full list of known card UIDs, pulled periodically by the ESP32 to refresh
// its local cache so it can recognize newly-registered cards while offline.
export async function GET() {
  const students = await prisma.student.findMany({
    select: { cardUid: true },
  });
  return NextResponse.json({ uids: students.map((s) => s.cardUid) });
}
