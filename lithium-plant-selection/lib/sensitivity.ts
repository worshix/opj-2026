import type { Criterion, Mine, Site } from "@/generated/prisma/client";
import { evaluateSites } from "./evaluate";

export interface HaulRatePoint {
  multiplier: number;
  haulRate: number;
  annualCostUsd: number | null;
  costChangePct: number | null;
  winnerName: string | null;
  winnerChanged: boolean;
}

export interface WeightPerturbation {
  criterionName: string;
  direction: "+10%" | "-10%";
  /** highest-scoring site under the perturbed weights */
  winnerName: string | null;
  winnerChanged: boolean;
}

export interface SupplyPerturbation {
  factor: number;
  label: string;
  feasibleSites: number;
  winnerName: string | null;
  winnerChanged: boolean;
  annualCostUsd: number | null;
  costChangePct: number | null;
}

export interface SensitivityResult {
  haulage: HaulRatePoint[];
  weightPerturbations: WeightPerturbation[];
  supplyPerturbations: SupplyPerturbation[];
  /** true if the optimal site or the score leader changes under any tested perturbation */
  fragile: boolean;
  fragileReasons: string[];
}

const pct = (v: number | null, base: number | null) => (v != null && base ? ((v - base) / base) * 100 : null);

export function sensitivityAnalysis(sites: Site[], mines: Mine[], criteria: Criterion[], haulRate: number): SensitivityResult {
  const base = evaluateSites(sites, mines, criteria, haulRate);
  const baseCost = base.costWinner?.annualCostUsd ?? null;

  const haulage: HaulRatePoint[] = [0.5, 0.8, 1, 1.2, 1.5, 2].map((mult) => {
    const w = evaluateSites(sites, mines, criteria, haulRate * mult).costWinner;
    return {
      multiplier: mult,
      haulRate: haulRate * mult,
      annualCostUsd: w?.annualCostUsd ?? null,
      costChangePct: pct(w?.annualCostUsd ?? null, baseCost),
      winnerName: w?.name ?? null,
      winnerChanged: w?.siteId !== base.costWinner?.siteId,
    };
  });

  const weightPerturbations: WeightPerturbation[] = criteria.flatMap((c) =>
    ([1.1, 0.9] as const).map((f) => {
      const perturbed = criteria.map((x) => (x.id === c.id ? { ...x, weight: x.weight * f } : x));
      const w = evaluateSites(sites, mines, perturbed, haulRate).scoreLeader;
      return {
        criterionName: c.name,
        direction: f > 1 ? ("+10%" as const) : ("-10%" as const),
        winnerName: w?.name ?? null,
        winnerChanged: w?.siteId !== base.scoreLeader?.siteId,
      };
    })
  );

  const supplyPerturbations: SupplyPerturbation[] = ([0.85, 1.15] as const).map((f) => {
    const ev = evaluateSites(sites, mines.map((m) => ({ ...m, annualSupplyT: m.annualSupplyT * f })), criteria, haulRate);
    const w = ev.costWinner;
    return {
      factor: f,
      label: f > 1 ? "+15%" : "-15%",
      feasibleSites: ev.results.filter((r) => r.gatePass).length,
      winnerName: w?.name ?? null,
      winnerChanged: w?.siteId !== base.costWinner?.siteId,
      annualCostUsd: w?.annualCostUsd ?? null,
      costChangePct: pct(w?.annualCostUsd ?? null, baseCost),
    };
  });

  const fragileReasons: string[] = [];
  const hf = haulage.filter((p) => p.winnerChanged).length;
  if (hf) fragileReasons.push(`optimal site changes at ${hf} haulage-rate setting(s)`);
  const sf = supplyPerturbations.filter((p) => p.winnerChanged).length;
  if (sf) fragileReasons.push(`optimal site changes under ${sf} mine-supply perturbation(s)`);
  const wf = weightPerturbations.filter((p) => p.winnerChanged).length;
  if (wf) fragileReasons.push(`top-scoring site changes under ${wf} weight perturbation(s)`);
  if (base.costWinner && base.scoreLeader && base.costWinner.siteId !== base.scoreLeader.siteId)
    fragileReasons.push("cost-optimal site differs from the top-scoring site");

  return { haulage, weightPerturbations, supplyPerturbations, fragile: fragileReasons.length > 0, fragileReasons };
}
