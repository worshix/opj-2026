import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";

export const instant = false;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string; haulRate?: number };
  const [sites, mines, criteria] = await Promise.all([
    prisma.site.findMany(),
    prisma.mine.findMany(),
    prisma.criterion.findMany(),
  ]);
  const result = runPipeline(sites, mines, criteria, body.haulRate);
  const scenario = await prisma.scenario.create({
    data: { name: body.name ?? "API scenario", result: JSON.stringify(result) },
  });
  return NextResponse.json({ id: scenario.id, winner: result.winnerName });
}
