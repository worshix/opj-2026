import type { Site } from "@/generated/prisma/client";

export const DEFAULT_HAUL_RATE = 0.25; // USD per tonne-km
export const LAND_AMORT_YEARS = 20;

export function annualCost(site: Site, haulage: number): { haulage: number; fixedOpex: number; landAmortisation: number } {
  return {
    haulage,
    fixedOpex: site.fixedOpexUsd,
    landAmortisation: (site.landPriceUsdPerHa * site.landAreaHa) / LAND_AMORT_YEARS,
  };
}
