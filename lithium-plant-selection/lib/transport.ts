import type { Mine, Site } from "@/generated/prisma/client";
import { roadKm } from "./geo";

export interface Allocation {
  mineId: number;
  mineName: string;
  tonnes: number;
  distanceKm: number;
  costUsd: number;
}

export interface AllocationResult {
  demandT: number;
  suppliedT: number;
  feasible: boolean;
  totalHaulageUsd: number;
  allocations: Allocation[];
}

/**
 * Single-sink transportation solve: feed the plant from the cheapest
 * sources first until demand is met. For one destination this greedy
 * ordering is exactly optimal (equivalent to the LP optimum since all
 * unit costs are constant and only supply/demand constraints apply).
 */
export function solveAllocation(site: Site, mines: Mine[], haulRateUsdPerTKm: number): AllocationResult {
  const demand = site.capacityT;
  const legs = mines
    .map((m) => ({ mine: m, distanceKm: roadKm(site.lat, site.lon, m.lat, m.lon) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  let remaining = demand;
  const allocations: Allocation[] = [];
  for (const { mine, distanceKm } of legs) {
    if (remaining <= 0) break;
    const tonnes = Math.min(mine.annualSupplyT, remaining);
    if (tonnes <= 0) continue;
    allocations.push({
      mineId: mine.id,
      mineName: mine.name,
      tonnes,
      distanceKm,
      costUsd: tonnes * distanceKm * haulRateUsdPerTKm,
    });
    remaining -= tonnes;
  }

  const suppliedT = demand - Math.max(0, remaining);
  return {
    demandT: demand,
    suppliedT,
    feasible: remaining <= 0,
    totalHaulageUsd: allocations.reduce((a, x) => a + x.costUsd, 0),
    allocations,
  };
}
