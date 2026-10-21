-- CreateTable
CREATE TABLE "Mine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "annualSupplyT" REAL NOT NULL,
    "gradeNote" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "capacityT" REAL NOT NULL,
    "waterMLPerDay" REAL NOT NULL,
    "gridReliability" REAL NOT NULL,
    "distanceToSettlementKm" REAL NOT NULL,
    "distanceToRailKm" REAL NOT NULL,
    "distanceToSubstationKm" REAL NOT NULL,
    "roadQuality" REAL NOT NULL,
    "onProtectedLand" BOOLEAN NOT NULL,
    "protectedAreaBufferKm" REAL NOT NULL,
    "landAreaHa" REAL NOT NULL,
    "landPriceUsdPerHa" REAL NOT NULL,
    "slopeIndex" REAL NOT NULL,
    "labourIndex" REAL NOT NULL,
    "envSensitivity" REAL NOT NULL,
    "seismicRisk" REAL NOT NULL,
    "tailingsSuitability" REAL NOT NULL,
    "fixedOpexUsd" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "grp" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "min" REAL NOT NULL,
    "max" REAL NOT NULL,
    "weight" REAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL
);
