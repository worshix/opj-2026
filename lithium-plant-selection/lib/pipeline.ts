import type { Criterion, Mine, Site } from "@/generated/prisma/client";
import { evaluateSites, type SiteResult } from "./evaluate";
import type { AllocationResult } from "./transport";
import { sensitivityAnalysis, type SensitivityResult } from "./sensitivity";
import { DEFAULT_HAUL_RATE } from "./cost";

export { DEFAULT_HAUL_RATE };
export type { SiteResult };

export interface ScenarioResult {
  haulRateUsdPerTKm: number;
  generatedAt: string;
  mines: { id: number; name: string; lat: number; lon: number; annualSupplyT: number }[];
  sites: SiteResult[];
  /** cost-optimal feasible site */
  winnerSiteId: number | null;
  winnerName: string | null;
  scoreLeaderSiteId: number | null;
  scoreLeaderName: string | null;
  allocation: AllocationResult | null;
  sensitivity: SensitivityResult;
}

export function runPipeline(
  sites: Site[],
  mines: Mine[],
  criteria: Criterion[],
  haulRate = DEFAULT_HAUL_RATE
): ScenarioResult {
  const { results, costWinner, scoreLeader } = evaluateSites(sites, mines, criteria, haulRate);
  return {
    haulRateUsdPerTKm: haulRate,
    generatedAt: new Date().toISOString(),
    mines: mines.map((m) => ({ id: m.id, name: m.name, lat: m.lat, lon: m.lon, annualSupplyT: m.annualSupplyT })),
    sites: results,
    winnerSiteId: costWinner?.siteId ?? null,
    winnerName: costWinner?.name ?? null,
    scoreLeaderSiteId: scoreLeader?.siteId ?? null,
    scoreLeaderName: scoreLeader?.name ?? null,
    allocation: costWinner?.allocation ?? null,
    sensitivity: sensitivityAnalysis(sites, mines, criteria, haulRate),
  };
}
