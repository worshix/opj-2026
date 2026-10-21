import type { Criterion, Mine, Site } from "@/generated/prisma/client";
import { roadKm } from "./geo";

/** Derived evidence values injected alongside raw site fields before scoring. */
export function evidenceValue(criterion: Criterion, site: Site, mines: Mine[]): number {
  if (criterion.fieldKey === "weightedMineDistanceKm") {
    const totalSupply = mines.reduce((a, m) => a + m.annualSupplyT, 0);
    if (totalSupply <= 0) return 0;
    return mines.reduce((a, m) => a + m.annualSupplyT * roadKm(site.lat, site.lon, m.lat, m.lon), 0) / totalSupply;
  }
  return Number((site as unknown as Record<string, unknown>)[criterion.fieldKey]);
}

export function normalize(value: number, c: Criterion): number {
  const span = c.max - c.min;
  if (span === 0) return 100;
  const raw = (value - c.min) / span;
  const clamped = Math.min(1, Math.max(0, raw));
  return (c.direction === "benefit" ? clamped : 1 - clamped) * 100;
}

export interface CriterionScore {
  criterionId: number;
  name: string;
  grp: string;
  unit: string;
  direction: string;
  weight: number;
  raw: number;
  normalised: number;
  contribution: number;
}

export function scoreSite(site: Site, criteria: Criterion[], mines: Mine[]): { total: number; breakdown: CriterionScore[] } {
  const weightSum = criteria.reduce((a, c) => a + c.weight, 0) || 1;
  const breakdown = criteria.map((c) => {
    const raw = evidenceValue(c, site, mines);
    const normalised = normalize(raw, c);
    return {
      criterionId: c.id,
      name: c.name,
      grp: c.grp,
      unit: c.unit,
      direction: c.direction,
      weight: c.weight,
      raw,
      normalised,
      contribution: (normalised * c.weight) / weightSum,
    };
  });
  return { total: breakdown.reduce((a, b) => a + b.contribution, 0), breakdown };
}
