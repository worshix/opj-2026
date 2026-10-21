import type { Mine, Site } from "@/generated/prisma/client";

export interface GateInfo {
  label: string;
  threshold: number;
  unit: string;
  definition: string;
  evidence: string;
}

export interface Gate extends GateInfo {
  key: keyof Site | "protected";
  /** returns the measured value and whether it passes */
  evaluate: (s: Site) => { value: number | boolean; pass: boolean };
}

export const GATES: Gate[] = [
  {
    key: "waterMLPerDay",
    label: "Minimum water supply",
    threshold: 4,
    unit: "ML/day",
    definition: "Reliable water available to the plant must meet the minimum process demand.",
    evidence: "Water allocation permit and source yield records (ZINWA).",
    evaluate: (s) => ({ value: s.waterMLPerDay, pass: s.waterMLPerDay >= 4 }),
  },
  {
    key: "gridReliability",
    label: "Minimum grid reliability",
    threshold: 0.7,
    unit: "fraction",
    definition: "Grid supply must be available for at least the stated fraction of time.",
    evidence: "Utility outage log and feeder supply agreement (ZETDC).",
    evaluate: (s) => ({ value: s.gridReliability, pass: s.gridReliability >= 0.7 }),
  },
  {
    key: "distanceToSettlementKm",
    label: "Settlement buffer",
    threshold: 3,
    unit: "km",
    definition: "Minimum separation from residential settlements for dust, noise and emissions.",
    evidence: "Mapped distance from plant footprint to nearest dwellings.",
    evaluate: (s) => ({ value: s.distanceToSettlementKm, pass: s.distanceToSettlementKm >= 3 }),
  },
  {
    key: "protected",
    label: "Not on protected land",
    threshold: 0,
    unit: "",
    definition: "The site must not lie inside a protected area, wetland or forest reserve.",
    evidence: "Overlay of the site on protected-area and wetland datasets; EMA screening.",
    evaluate: (s) => ({ value: s.onProtectedLand, pass: !s.onProtectedLand }),
  },
  {
    key: "capacityT",
    label: "Minimum plant capacity",
    threshold: 200_000,
    unit: "t/yr",
    definition: "Site must host a plant above the minimum economically viable throughput.",
    evidence: "Pre-feasibility design capacity and site layout.",
    evaluate: (s) => ({ value: s.capacityT, pass: s.capacityT >= 200_000 }),
  },
  {
    key: "landAreaHa",
    label: "Minimum land area",
    threshold: 50,
    unit: "ha",
    definition: "Contiguous developable area needed for plant, stockpiles and tailings.",
    evidence: "Surveyed plot boundaries and title confirmation.",
    evaluate: (s) => ({ value: s.landAreaHa, pass: s.landAreaHa >= 50 }),
  },
  {
    key: "tailingsSuitability",
    label: "Tailings suitability",
    threshold: 5,
    unit: "/10",
    definition: "Ground and drainage must support a safe tailings storage facility.",
    evidence: "Geotechnical and hydrogeological assessment.",
    evaluate: (s) => ({ value: s.tailingsSuitability, pass: s.tailingsSuitability >= 5 }),
  },
];

export const SUPPLY_GATE: GateInfo = {
  label: "Feedstock supply sufficiency",
  threshold: 0,
  unit: "t/yr shortfall",
  definition: "Total annual mine supply must cover the plant's capacity (unmet feedstock must be zero).",
  evidence: "Mine supply limits (Mines page) against the plant's annual capacity.",
};

export const ALL_GATE_INFO: GateInfo[] = [...GATES, SUPPLY_GATE];

export interface GateOutcome {
  label: string;
  value: number | boolean;
  threshold: number;
  unit: string;
  pass: boolean;
}

export function evaluateGates(site: Site, mines?: Mine[]): { pass: boolean; outcomes: GateOutcome[] } {
  const outcomes: GateOutcome[] = GATES.map((g) => ({ label: g.label, threshold: g.threshold, unit: g.unit, ...g.evaluate(site) }));
  if (mines) {
    const shortfall = Math.max(0, site.capacityT - mines.reduce((a, m) => a + m.annualSupplyT, 0));
    outcomes.push({ label: SUPPLY_GATE.label, threshold: SUPPLY_GATE.threshold, unit: SUPPLY_GATE.unit, value: shortfall, pass: shortfall <= 0 });
  }
  return { pass: outcomes.every((o) => o.pass), outcomes };
}
