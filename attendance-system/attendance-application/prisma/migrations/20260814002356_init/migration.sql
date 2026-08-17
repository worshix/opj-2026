-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "regNumber" TEXT NOT NULL,
    "cardUid" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "arrivedAt" DATETIME,
    "leftAt" DATETIME,
    CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AttendanceRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnknownTap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardUid" TEXT NOT NULL,
    "tappedAt" DATETIME NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_regNumber_key" ON "Student"("regNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_cardUid_key" ON "Student"("cardUid");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_eventId_key" ON "AttendanceRecord"("studentId", "eventId");
