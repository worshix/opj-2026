"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { DEMO_CRITERIA, DEMO_MINES, DEMO_SITES } from "@/lib/demo-data";

const num = (v: FormDataEntryValue | null) => Number(v ?? 0);

const siteSchema = z.object({
  name: z.string().min(1),
  lat: z.number(), lon: z.number(),
  capacityT: z.number().positive(),
  waterMLPerDay: z.number().min(0),
  gridReliability: z.number().min(0).max(1),
  distanceToSettlementKm: z.number().min(0),
  distanceToRailKm: z.number().min(0),
  distanceToSubstationKm: z.number().min(0),
  roadQuality: z.number().min(0).max(10),
  onProtectedLand: z.boolean(),
  protectedAreaBufferKm: z.number().min(0),
  landAreaHa: z.number().positive(),
  landPriceUsdPerHa: z.number().min(0),
  slopeIndex: z.number().min(0).max(10),
  labourIndex: z.number().min(0).max(10),
  envSensitivity: z.number().min(0).max(10),
  seismicRisk: z.number().min(0).max(10),
  tailingsSuitability: z.number().min(0).max(10),
  fixedOpexUsd: z.number().min(0),
});

export async function addSite(fd: FormData) {
  const data = siteSchema.parse({
    name: fd.get("name"),
    lat: num(fd.get("lat")), lon: num(fd.get("lon")),
    capacityT: num(fd.get("capacityT")),
    waterMLPerDay: num(fd.get("waterMLPerDay")),
    gridReliability: num(fd.get("gridReliability")),
    distanceToSettlementKm: num(fd.get("distanceToSettlementKm")),
    distanceToRailKm: num(fd.get("distanceToRailKm")),
    distanceToSubstationKm: num(fd.get("distanceToSubstationKm")),
    roadQuality: num(fd.get("roadQuality")),
    onProtectedLand: fd.get("onProtectedLand") === "on",
    protectedAreaBufferKm: num(fd.get("protectedAreaBufferKm")),
    landAreaHa: num(fd.get("landAreaHa")),
    landPriceUsdPerHa: num(fd.get("landPriceUsdPerHa")),
    slopeIndex: num(fd.get("slopeIndex")),
    labourIndex: num(fd.get("labourIndex")),
    envSensitivity: num(fd.get("envSensitivity")),
    seismicRisk: num(fd.get("seismicRisk")),
    tailingsSuitability: num(fd.get("tailingsSuitability")),
    fixedOpexUsd: num(fd.get("fixedOpexUsd")),
  });
  await prisma.site.create({ data });
  revalidatePath("/sites");
}

export async function deleteSite(fd: FormData) {
  await prisma.site.delete({ where: { id: num(fd.get("id")) } });
  revalidatePath("/sites");
}

const mineSchema = z.object({
  name: z.string().min(1),
  lat: z.number(), lon: z.number(),
  annualSupplyT: z.number().positive(),
  gradeNote: z.string(),
});

export async function addMine(fd: FormData) {
  const data = mineSchema.parse({
    name: fd.get("name"),
    lat: num(fd.get("lat")), lon: num(fd.get("lon")),
    annualSupplyT: num(fd.get("annualSupplyT")),
    gradeNote: String(fd.get("gradeNote") ?? ""),
  });
  await prisma.mine.create({ data });
  revalidatePath("/mines");
}

export async function deleteMine(fd: FormData) {
  await prisma.mine.delete({ where: { id: num(fd.get("id")) } });
  revalidatePath("/mines");
}

export async function updateCriterionWeights(fd: FormData) {
  const criteria = await prisma.criterion.findMany();
  for (const c of criteria) {
    const w = Number(fd.get(`weight_${c.id}`));
    if (Number.isFinite(w) && w >= 0 && w !== c.weight) {
      await prisma.criterion.update({ where: { id: c.id }, data: { weight: w } });
    }
  }
  revalidatePath("/criteria");
}

export async function runScenario(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim() || `Scenario ${new Date().toLocaleString()}`;
  const haulRate = num(fd.get("haulRate")) || 0.25;
  const [sites, mines, criteria] = await Promise.all([
    prisma.site.findMany(),
    prisma.mine.findMany(),
    prisma.criterion.findMany(),
  ]);
  const result = runPipeline(sites, mines, criteria, haulRate);
  const scenario = await prisma.scenario.create({
    data: { name, result: JSON.stringify(result) },
  });
  redirect(`/scenarios/${scenario.id}`);
}

export async function deleteScenario(fd: FormData) {
  await prisma.scenario.delete({ where: { id: num(fd.get("id")) } });
  revalidatePath("/");
}

export async function seedDemoData() {
  await prisma.scenario.deleteMany();
  await prisma.criterion.deleteMany();
  await prisma.site.deleteMany();
  await prisma.mine.deleteMany();
  await prisma.mine.createMany({ data: DEMO_MINES });
  await prisma.site.createMany({ data: DEMO_SITES });
  await prisma.criterion.createMany({ data: DEMO_CRITERIA });
  revalidatePath("/");
}
