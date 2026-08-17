import { prisma } from "@/lib/prisma";

export type TapResult =
  | { status: "unknown"; cardUid: string }
  | { status: "no_active_event"; cardUid: string }
  | { status: "arrived"; studentId: string; studentName: string }
  | { status: "left"; studentId: string; studentName: string }
  | { status: "already_recorded"; studentId: string; studentName: string };

/**
 * Handles a single tap (UID + timestamp) from a reader station.
 * Shared by /api/tap (live) and /api/sync (offline-queue replay) so both
 * paths apply identical arrival/departure/duplicate rules.
 */
export async function processTap(
  cardUid: string,
  timestamp: Date
): Promise<TapResult> {
  const student = await prisma.student.findUnique({ where: { cardUid } });

  if (!student) {
    await prisma.unknownTap.create({
      data: { cardUid, tappedAt: timestamp },
    });
    return { status: "unknown", cardUid };
  }

  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
  });

  if (!activeEvent) {
    return { status: "no_active_event", cardUid };
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: {
      studentId_eventId: { studentId: student.id, eventId: activeEvent.id },
    },
  });

  if (!existing) {
    await prisma.attendanceRecord.create({
      data: {
        studentId: student.id,
        eventId: activeEvent.id,
        arrivedAt: timestamp,
      },
    });
    return { status: "arrived", studentId: student.id, studentName: student.name };
  }

  if (existing.arrivedAt && !existing.leftAt) {
    await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { leftAt: timestamp },
    });
    return { status: "left", studentId: student.id, studentName: student.name };
  }

  // Already has both arrivedAt and leftAt — a duplicate re-tap. Left as a
  // no-op (see OVERVIEW.md open question #2); the reader gives a distinct
  // "already recorded" beep pattern rather than silently repeating the
  // normal ack.
  return {
    status: "already_recorded",
    studentId: student.id,
    studentName: student.name,
  };
}

export type StudentStatus = "present" | "left" | "absent";

export interface StudentWithStatus {
  id: string;
  name: string;
  regNumber: string;
  cardUid: string;
  status: StudentStatus;
  arrivedAt: string | null;
  leftAt: string | null;
}

/** Computes Present/Left/Absent for every student against the active event. */
export async function getActiveEventRoster(): Promise<{
  event: { id: string; name: string; startedAt: Date } | null;
  students: StudentWithStatus[];
}> {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
  });

  const students = await prisma.student.findMany({
    orderBy: { name: "asc" },
    include: activeEvent
      ? { records: { where: { eventId: activeEvent.id } } }
      : undefined,
  });

  const result: StudentWithStatus[] = students.map((s) => {
    const record = activeEvent
      ? (s as typeof s & { records?: { arrivedAt: Date | null; leftAt: Date | null }[] }).records?.[0]
      : undefined;

    let status: StudentStatus = "absent";
    if (record?.arrivedAt && record.leftAt) status = "left";
    else if (record?.arrivedAt) status = "present";

    return {
      id: s.id,
      name: s.name,
      regNumber: s.regNumber,
      cardUid: s.cardUid,
      status,
      arrivedAt: record?.arrivedAt ? record.arrivedAt.toISOString() : null,
      leftAt: record?.leftAt ? record.leftAt.toISOString() : null,
    };
  });

  return {
    event: activeEvent
      ? {
          id: activeEvent.id,
          name: activeEvent.name,
          startedAt: activeEvent.startedAt,
        }
      : null,
    students: result,
  };
}
