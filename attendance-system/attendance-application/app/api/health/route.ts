import { NextResponse } from "next/server";

// Liveness check the ESP32 polls to drive the "App reachable" LED.
export async function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() });
}
