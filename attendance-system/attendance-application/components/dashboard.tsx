"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import StatusBadge from "@/components/status-badge";
import type { StudentWithStatus } from "@/lib/attendance";

interface ActiveEventResponse {
  event: { id: string; name: string; startedAt: string } | null;
  students: StudentWithStatus[];
}

interface UnknownTap {
  id: string;
  cardUid: string;
  tappedAt: string;
}

const POLL_MS = 4000;

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<ActiveEventResponse | null>(null);
  const seenTaps = useRef<Set<string>>(new Set());

  const pollRoster = useCallback(async () => {
    const res = await fetch("/api/events/active", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  const pollUnknownTaps = useCallback(async () => {
    const res = await fetch("/api/unknown-taps", { cache: "no-store" });
    if (!res.ok) return;
    const { taps }: { taps: UnknownTap[] } = await res.json();

    for (const tap of taps) {
      if (seenTaps.current.has(tap.id)) continue;
      seenTaps.current.add(tap.id);

      toast(`Unknown card ${tap.cardUid} tapped`, {
        description: new Date(tap.tappedAt).toLocaleTimeString(),
        icon: <UserPlus size={16} />,
        action: {
          label: "Register",
          onClick: () => router.push(`/students?uid=${tap.cardUid}`),
        },
        duration: 15000,
      });
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch for a same-origin poll loop, not a race-prone subscription
    pollRoster();
    pollUnknownTaps();
    const rosterId = setInterval(pollRoster, POLL_MS);
    const tapsId = setInterval(pollUnknownTaps, POLL_MS);
    return () => {
      clearInterval(rosterId);
      clearInterval(tapsId);
    };
  }, [pollRoster, pollUnknownTaps]);

  if (!data) {
    return <p className="text-muted">Loading…</p>;
  }

  const counts = {
    present: data.students.filter((s) => s.status === "present").length,
    left: data.students.filter((s) => s.status === "left").length,
    absent: data.students.filter((s) => s.status === "absent").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {data.event ? data.event.name : "No active event"}
          </h1>
          {data.event && (
            <p className="text-sm text-muted">
              Started {new Date(data.event.startedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {!data.event && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted">
          No event is active. Start one from the{" "}
          <a href="/events" className="text-primary hover:underline">
            Events
          </a>{" "}
          page so taps are recorded.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Present" value={counts.present} />
        <StatCard label="Left" value={counts.left} />
        <StatCard label="Absent" value={counts.absent} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Reg. No.</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Arrived</th>
              <th className="px-4 py-2 font-medium">Left</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.students.map((s) => (
              <tr key={s.id} className="bg-background">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-muted">{s.regNumber}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-2 text-muted">
                  {s.arrivedAt ? new Date(s.arrivedAt).toLocaleTimeString() : "—"}
                </td>
                <td className="px-4 py-2 text-muted">
                  {s.leftAt ? new Date(s.leftAt).toLocaleTimeString() : "—"}
                </td>
              </tr>
            ))}
            {data.students.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No students registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold text-primary">{value}</p>
    </div>
  );
}
