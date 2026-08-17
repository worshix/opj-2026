import type { StudentStatus } from "@/lib/attendance";

const STYLES: Record<StudentStatus, string> = {
  present: "bg-primary-soft text-primary border-primary-strong/40",
  left: "bg-surface-raised text-muted border-border",
  absent: "bg-surface text-muted/70 border-border border-dashed",
};

const LABELS: Record<StudentStatus, string> = {
  present: "Present",
  left: "Left",
  absent: "Absent",
};

export default function StatusBadge({ status }: { status: StudentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
