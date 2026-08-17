-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "arrivedAt" DATETIME,
    "leftAt" DATETIME,
    CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AttendanceRecord" ("arrivedAt", "eventId", "id", "leftAt", "studentId") SELECT "arrivedAt", "eventId", "id", "leftAt", "studentId" FROM "AttendanceRecord";
DROP TABLE "AttendanceRecord";
ALTER TABLE "new_AttendanceRecord" RENAME TO "AttendanceRecord";
CREATE UNIQUE INDEX "AttendanceRecord_studentId_eventId_key" ON "AttendanceRecord"("studentId", "eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
