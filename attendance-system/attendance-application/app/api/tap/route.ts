import { NextRequest, NextResponse } from "next/server";
import { processTap } from "@/lib/attendance";

interface TapBody {
  uid?: string;
  timestamp?: string | number;
}

export async function POST(req: NextRequest) {
  let body: TapBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const uid = body.uid?.trim().toUpperCase();
  if (!uid) {
    return NextResponse.json({ error: "missing_uid" }, { status: 400 });
  }

  const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
  const result = await processTap(uid, timestamp);

  return NextResponse.json(result);
}
