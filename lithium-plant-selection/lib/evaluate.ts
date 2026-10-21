import type { Criterion, Mine, Site } from "@/generated/prisma/client";
import { evaluateGates, type GateOutcome } from "./gates";
import { scoreSite, type CriterionScore } from "./scoring";
import { solveAllocation, type AllocationResult } from "./transport";
import { annualCost } from "./cost";

export interface SiteResult {
  siteId: number;
  name: string;
  lat: number;
  lon: number;
  gatePass: boolean;
  gateOutcomes: GateOutcome[];
  score: number | null;
  breakdown: CriterionScore[] | null;
  /** rank by weighted score among gate-passing sites */
  rank: number | null;
  /** rank by total annual cost (1 = optimal) among gate-passing sites */
  costRank: number | null;
  annualCostUsd: number | null;
  costBreakdown: { haulage: number; fixedOpex: number; landAmortisation: number } | null;
  allocation: AllocationResult | null;
}

export interface Evaluation {
  results: SiteResult[];
  /** cost-minimising feasible site: the optimiser's choice */
  costWinner: SiteResult | null;
  /** highest weighted-score feasible site */
  scoreLeader: SiteResult | null;
}

/**
 * Facility selection + allocation: for every site that passes all gates
 * (including feedstock supply sufficiency) solve the transportation
 * allocation, price it, and pick the single site minimising annual cost.
 */
export function evaluateSites(sites: Site[], mines: Mine[], criteria: Criterion[], haulRate: number): Evaluation {
  const results: SiteResult[] = sites.map((site) => {
    const gates = evaluateGates(site, mines);
    const base: SiteResult = {
      siteId: site.id, name: site.name, lat: site.lat, lon: site.lon,
      gatePass: gates.pass, gateOutcomes: gates.outcomes,
      score: null, breakdown: null, rank: null, costRank: null,
      annualCostUsd: null, costBreakdown: null, allocation: null,
    };
    if (!gates.pass) return base;
    const { total, breakdown } = scoreSite(site, criteria, mines);
    const allocation = solveAllocation(site, mines, haulRate);
    const cb = annualCost(site, allocation.totalHaulageUsd);
    return {
      ...base, score: total, breakdown, allocation,
      annualCostUsd: cb.haulage + cb.fixedOpex + cb.landAmortisation,
      costBreakdown: cb,
    };
  });

  const feasible = results.filter((r) => r.gatePass);
  [...feasible].sort((a, b) => b.score! - a.score!).forEach((r, i) => (r.rank = i + 1));
  [...feasible].sort((a, b) => a.annualCostUsd! - b.annualCostUsd!).forEach((r, i) => (r.costRank = i + 1));
  return {
    results,
    costWinner: feasible.find((r) => r.costRank === 1) ?? null,
    scoreLeader: feasible.find((r) => r.rank === 1) ?? null,
  };
}
