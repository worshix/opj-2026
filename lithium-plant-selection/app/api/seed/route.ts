import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEMO_CRITERIA, DEMO_MINES, DEMO_SITES } from "@/lib/demo-data";

export const instant = false;

export async function GET() {
  await prisma.criterion.deleteMany();
  await prisma.site.deleteMany();
  await prisma.mine.deleteMany();
  await prisma.mine.createMany({ data: DEMO_MINES });
  await prisma.site.createMany({ data: DEMO_SITES });
  await prisma.criterion.createMany({ data: DEMO_CRITERIA });
  return NextResponse.json({
    mines: await prisma.mine.count(),
    sites: await prisma.site.count(),
    criteria: await prisma.criterion.count(),
  });
}
