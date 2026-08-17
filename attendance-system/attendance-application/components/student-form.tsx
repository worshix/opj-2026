"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function StudentForm({ onCreated }: { onCreated: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [name, setName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [cardUid, setCardUid] = useState(searchParams.get("uid") ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, regNumber, cardUid }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Could not add student");
        return;
      }
      toast.success(`${name} registered`);
      setName("");
      setRegNumber("");
      setCardUid("");
      router.replace("/students");
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="font-medium">Add student</h2>
      {searchParams.get("uid") && (
        <p className="text-xs text-primary">
          Prefilled from a scanned card — confirm the name and reg. number.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Jane Doe"
          />
        </Field>
        <Field label="Registration number">
          <input
            required
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            className="input"
            placeholder="REG-0001"
          />
        </Field>
        <Field label="Card UID">
          <input
            required
            value={cardUid}
            onChange={(e) => setCardUid(e.target.value.toUpperCase())}
            className="input font-mono"
            placeholder="A1B2C3D4"
          />
        </Field>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-strong disabled:opacity-50"
      >
        <Plus size={16} />
        {submitting ? "Adding…" : "Add student"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}
