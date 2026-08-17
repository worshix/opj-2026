import { NextRequest, NextResponse } from "next/server";
import { processTap, TapResult } from "@/lib/attendance";

interface SyncBody {
  taps?: { uid?: string; timestamp?: string | number }[];
}

// Batch replay of an ESP32's offline tap queue after reconnecting.
// Taps are applied in the order given, since arrival/departure state
// depends on ordering (first tap = arrival, second = departure).
export async function POST(req: NextRequest) {
  let body: SyncBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const taps = body.taps ?? [];
  const results: (TapResult & { uid: string })[] = [];

  for (const tap of taps) {
    const uid = tap.uid?.trim().toUpperCase();
    if (!uid) continue;
    const timestamp = tap.timestamp ? new Date(tap.timestamp) : new Date();
    const result = await processTap(uid, timestamp);
    results.push({ ...result, uid });
  }

  return NextResponse.json({ processed: results.length, results });
}
