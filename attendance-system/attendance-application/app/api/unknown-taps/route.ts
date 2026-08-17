import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Polled by the dashboard to surface sonner toasts for cards that were
// tapped but don't match any registered student.
export async function GET() {
  const taps = await prisma.unknownTap.findMany({
    where: { acknowledged: false },
    orderBy: { tappedAt: "asc" },
  });
  return NextResponse.json({ taps });
}
