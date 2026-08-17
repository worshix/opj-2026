"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import StudentForm from "@/components/student-form";
import ConfirmDialog from "@/components/confirm-dialog";

interface Student {
  id: string;
  name: string;
  regNumber: string;
  cardUid: string;
  createdAt: string;
}

export default function StudentsView() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/students", { cache: "no-store" });
    if (res.ok) {
      const body = await res.json();
      setStudents(body.students);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount, same-origin
    load();
  }, [load]);

  async function confirmDelete() {
    if (!studentToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/students/${studentToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Could not delete student");
        return;
      }
      toast.success(`${studentToDelete.name} removed`);
      setStudentToDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Students</h1>

      <Suspense fallback={null}>
        <StudentForm onCreated={load} />
      </Suspense>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Reg. No.</th>
              <th className="px-4 py-2 font-medium">Card UID</th>
              <th className="px-4 py-2 font-medium">Registered</th>
              <th className="px-4 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(students ?? []).map((s) => (
              <tr key={s.id} className="bg-background">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-muted">{s.regNumber}</td>
                <td className="px-4 py-2 font-mono text-muted">{s.cardUid}</td>
                <td className="px-4 py-2 text-muted">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setStudentToDelete(s)}
                    aria-label={`Delete ${s.name}`}
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {students?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No students registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {studentToDelete && (
        <ConfirmDialog
          title={`Delete ${studentToDelete.name}?`}
          description="This removes the student and their attendance history for every event. This can't be undone."
          pending={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setStudentToDelete(null)}
        />
      )}
    </div>
  );
}
