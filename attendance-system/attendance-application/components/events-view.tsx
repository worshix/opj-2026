"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Play, Square } from "lucide-react";

interface Event {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
}

export default function EventsView() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/events", { cache: "no-store" });
    if (res.ok) setEvents((await res.json()).events);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount, same-origin
    load();
  }, [load]);

  const activeEvent = events?.find((e) => e.isActive);

  async function startEvent(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Could not start event");
        return;
      }
      toast.success(`"${name}" started`);
      setName("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function endEvent(id: string) {
    const res = await fetch(`/api/events/${id}/end`, { method: "POST" });
    if (res.ok) {
      toast.success("Event ended");
      load();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Events</h1>

      <form
        onSubmit={startEvent}
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-muted">New event name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Orientation Day"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-strong disabled:opacity-50"
        >
          <Play size={16} />
          {activeEvent ? "Start (ends current)" : "Start event"}
        </button>
      </form>

      {activeEvent && (
        <div className="flex items-center justify-between rounded-lg border border-primary-strong/40 bg-primary-soft p-4">
          <div>
            <p className="text-sm text-primary">Active event</p>
            <p className="font-medium">{activeEvent.name}</p>
          </div>
          <button
            onClick={() => endEvent(activeEvent.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-surface-raised"
          >
            <Square size={14} />
            End event
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium">Ended</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(events ?? []).map((e) => (
              <tr key={e.id} className="bg-background">
                <td className="px-4 py-2 font-medium">
                  <Link
                    href={`/events/${e.id}`}
                    className="text-primary hover:underline"
                  >
                    {e.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted">
                  {new Date(e.startedAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-muted">
                  {e.endedAt ? new Date(e.endedAt).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2">
                  {e.isActive ? (
                    <span className="inline-flex items-center rounded-full border border-primary-strong/40 bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
                      Ended
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {events?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
