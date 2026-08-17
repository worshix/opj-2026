import { NextResponse } from "next/server";
import { getActiveEventRoster } from "@/lib/attendance";

// Drives the dashboard: the active event plus every student's computed
// Present/Left/Absent status against it.
export async function GET() {
  const roster = await getActiveEventRoster();
  return NextResponse.json(roster);
}
