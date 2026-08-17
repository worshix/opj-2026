"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StatusBadge from "@/components/status-badge";
import type { StudentWithStatus } from "@/lib/attendance";

interface EventDetail {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
}

interface EventResponse {
  event: EventDetail;
  students: StudentWithStatus[];
}

export default function EventDetailView({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EventResponse | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}`, { cache: "no-store" }).then(async (res) => {
      if (cancelled) return;
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) setData(await res.json());
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const backLink = (
    <Link
      href="/events"
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
    >
      <ArrowLeft size={14} />
      Back to events
    </Link>
  );

  if (notFound) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <p className="text-muted">Event not found.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  const { event, students } = data;
  const counts = {
    present: students.filter((s) => s.status === "present").length,
    left: students.filter((s) => s.status === "left").length,
    absent: students.filter((s) => s.status === "absent").length,
  };

  return (
    <div className="flex flex-col gap-6">
      {backLink}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{event.name}</h1>
          <p className="text-sm text-muted">
            Started {new Date(event.startedAt).toLocaleString()}
            {event.endedAt &&
              ` · Ended ${new Date(event.endedAt).toLocaleString()}`}
          </p>
        </div>
        {event.isActive ? (
          <span className="inline-flex items-center rounded-full border border-primary-strong/40 bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
            Ended
          </span>
        )}
      </div>

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
            {students.map((s) => (
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
            {students.length === 0 && (
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
