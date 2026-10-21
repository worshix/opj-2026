export const DEMO_MINES = [
  { name: "Bikita Minerals", lat: -20.08, lon: 32.63, annualSupplyT: 480_000, gradeNote: "Petalite/spodumene" },
  { name: "Arcadia Lithium", lat: -17.82, lon: 31.37, annualSupplyT: 420_000, gradeNote: "Petalite" },
  { name: "Zulu Lithium", lat: -20.35, lon: 29.05, annualSupplyT: 160_000, gradeNote: "Spodumene" },
  { name: "Sabi Star", lat: -20.25, lon: 32.45, annualSupplyT: 120_000, gradeNote: "Spodumene" },
  { name: "Kamativi", lat: -18.32, lon: 27.05, annualSupplyT: 80_000, gradeNote: "Tailings re-treatment" },
];

export const DEMO_SITES = [
  {
    name: "Goromonzi", lat: -17.85, lon: 31.36, capacityT: 450_000, waterMLPerDay: 8,
    gridReliability: 0.9, distanceToSettlementKm: 6.5, distanceToRailKm: 28,
    distanceToSubstationKm: 12, roadQuality: 8, onProtectedLand: false,
    protectedAreaBufferKm: 9, landAreaHa: 220, landPriceUsdPerHa: 8500,
    slopeIndex: 7, labourIndex: 8.5, envSensitivity: 4, seismicRisk: 2,
    tailingsSuitability: 7, fixedOpexUsd: 3_200_000,
  },
  {
    name: "Masvingo East", lat: -20.15, lon: 30.95, capacityT: 400_000, waterMLPerDay: 6,
    gridReliability: 0.78, distanceToSettlementKm: 4.2, distanceToRailKm: 65,
    distanceToSubstationKm: 30, roadQuality: 6, onProtectedLand: false,
    protectedAreaBufferKm: 12, landAreaHa: 300, landPriceUsdPerHa: 3200,
    slopeIndex: 8, labourIndex: 5.5, envSensitivity: 5, seismicRisk: 3,
    tailingsSuitability: 8, fixedOpexUsd: 2_600_000,
  },
  {
    name: "Kwekwe South", lat: -19.1, lon: 29.75, capacityT: 380_000, waterMLPerDay: 7.5,
    gridReliability: 0.85, distanceToSettlementKm: 5.8, distanceToRailKm: 15,
    distanceToSubstationKm: 9, roadQuality: 7.5, onProtectedLand: false,
    protectedAreaBufferKm: 14, landAreaHa: 180, landPriceUsdPerHa: 5400,
    slopeIndex: 6, labourIndex: 8, envSensitivity: 5.5, seismicRisk: 2.5,
    tailingsSuitability: 6.5, fixedOpexUsd: 2_900_000,
  },
  {
    name: "Insiza (Zulu adjacent)", lat: -20.4, lon: 29.2, capacityT: 250_000, waterMLPerDay: 2.8,
    gridReliability: 0.55, distanceToSettlementKm: 7, distanceToRailKm: 40,
    distanceToSubstationKm: 45, roadQuality: 4.5, onProtectedLand: false,
    protectedAreaBufferKm: 10, landAreaHa: 150, landPriceUsdPerHa: 1800,
    slopeIndex: 7, labourIndex: 4, envSensitivity: 6, seismicRisk: 3,
    tailingsSuitability: 7, fixedOpexUsd: 2_100_000,
  },
  {
    name: "Mutorashanga Wetland Margin", lat: -17.55, lon: 30.7, capacityT: 300_000,
    waterMLPerDay: 9, gridReliability: 0.72, distanceToSettlementKm: 1.2,
    distanceToRailKm: 22, distanceToSubstationKm: 18, roadQuality: 6,
    onProtectedLand: true, protectedAreaBufferKm: 0.8, landAreaHa: 90,
    landPriceUsdPerHa: 2400, slopeIndex: 8, labourIndex: 6, envSensitivity: 9,
    seismicRisk: 4, tailingsSuitability: 3.5, fixedOpexUsd: 2_400_000,
  },
];

export const DEMO_CRITERIA: {
  name: string; grp: string; fieldKey: string; direction: string;
  min: number; max: number; weight: number; unit: string;
  definition: string; evidence: string; source: string;
}[] = [
  // Industrial
  { name: "Plant capacity", grp: "Industrial", fieldKey: "capacityT", direction: "benefit", min: 200_000, max: 500_000, weight: 10, unit: "t/yr", definition: "Nameplate annual ore throughput the site can host; larger plants capture economies of scale.", evidence: "Engineering pre-feasibility design capacity and site layout showing room for the stated throughput.", source: "Plant design brief; developer pre-feasibility study" },
  { name: "Tailings suitability", grp: "Industrial", fieldKey: "tailingsSuitability", direction: "benefit", min: 0, max: 10, weight: 8, unit: "/10", definition: "Suitability of the site for a lined tailings storage facility (geology, drainage, footprint), 0-10.", evidence: "Geotechnical and hydrogeological assessment; tailings facility siting study.", source: "Geotechnical survey; EMA / EIA screening report" },
  { name: "Labour availability", grp: "Industrial", fieldKey: "labourIndex", direction: "benefit", min: 0, max: 10, weight: 6, unit: "/10", definition: "Availability of skilled and semi-skilled labour within commuting distance, 0-10.", evidence: "Local labour-market data and skills survey within 50 km.", source: "ZimStat census/labour survey; local council records" },
  // Logistical
  { name: "Distance to rail", grp: "Logistical", fieldKey: "distanceToRailKm", direction: "cost", min: 0, max: 100, weight: 8, unit: "km", definition: "Road distance from the site to the nearest rail siding able to handle concentrate.", evidence: "Mapped route to the nearest NRZ siding with confirmed handling capacity.", source: "NRZ network map; OpenStreetMap; field verification" },
  { name: "Road quality", grp: "Logistical", fieldKey: "roadQuality", direction: "benefit", min: 0, max: 10, weight: 7, unit: "/10", definition: "Condition and load-bearing capacity of access roads for heavy haulage, 0-10.", evidence: "Road condition survey and axle-load rating of the route to the site.", source: "ZINARA road condition reports; field inspection" },
  { name: "Supply-weighted mine distance", grp: "Logistical", fieldKey: "weightedMineDistanceKm", direction: "cost", min: 50, max: 400, weight: 12, unit: "km", definition: "Supply-weighted mean road distance from all feedstock mines to the site (derived).", evidence: "Mine coordinates and annual supply volumes; road route estimates.", source: "Mine records (Mines page); computed by the system" },
  // Utility
  { name: "Water supply", grp: "Utility", fieldKey: "waterMLPerDay", direction: "benefit", min: 0, max: 10, weight: 11, unit: "ML/day", definition: "Reliable water volume available to the site in megalitres per day.", evidence: "Water allocation permit or letter, source yield data and dry-season flow record.", source: "ZINWA permit; hydrological records" },
  { name: "Grid reliability", grp: "Utility", fieldKey: "gridReliability", direction: "benefit", min: 0.5, max: 1, weight: 10, unit: "fraction", definition: "Fraction of time grid supply is available at the site (1.0 = uninterrupted).", evidence: "Utility outage log and supply agreement for the nearest substation feeder.", source: "ZETDC outage records; ZERA reports" },
  { name: "Distance to substation", grp: "Utility", fieldKey: "distanceToSubstationKm", direction: "cost", min: 0, max: 60, weight: 5, unit: "km", definition: "Distance to a substation that can supply the plant load; drives connection capex.", evidence: "Mapped distance to the nearest adequate-capacity substation.", source: "ZETDC network data; connection quotation" },
  // Land
  { name: "Land price", grp: "Land", fieldKey: "landPriceUsdPerHa", direction: "cost", min: 1000, max: 10000, weight: 5, unit: "USD/ha", definition: "Acquisition cost of land per hectare.", evidence: "Valuation report, title status and recent comparable transactions.", source: "Registered valuer; Deeds Registry; local authority" },
  { name: "Land area", grp: "Land", fieldKey: "landAreaHa", direction: "benefit", min: 50, max: 350, weight: 4, unit: "ha", definition: "Contiguous developable land area available at the site.", evidence: "Surveyed plot boundaries and title/tenure confirmation.", source: "Surveyor-General cadastre; title deeds" },
  { name: "Terrain flatness", grp: "Land", fieldKey: "slopeIndex", direction: "benefit", min: 0, max: 10, weight: 3, unit: "/10", definition: "Terrain flatness for earthworks, 0-10 (10 = flat).", evidence: "Topographic survey or DEM slope analysis of the footprint.", source: "SRTM/ASTER DEM; topographic survey" },
  // Environmental
  { name: "Environmental sensitivity", grp: "Environmental", fieldKey: "envSensitivity", direction: "cost", min: 0, max: 10, weight: 7, unit: "/10", definition: "Sensitivity of surrounding ecosystems, water bodies and habitats, 0-10 (10 = highly sensitive).", evidence: "Environmental screening map overlay and EIA scoping findings.", source: "EMA screening; protected-area and wetland datasets" },
  { name: "Seismic risk", grp: "Environmental", fieldKey: "seismicRisk", direction: "cost", min: 0, max: 10, weight: 3, unit: "/10", definition: "Seismic hazard exposure at the site, 0-10 (10 = high risk).", evidence: "Seismic hazard map reading for the coordinates.", source: "Geological Survey of Zimbabwe; GSHAP hazard map" },
  { name: "Settlement buffer", grp: "Environmental", fieldKey: "distanceToSettlementKm", direction: "benefit", min: 0, max: 15, weight: 4, unit: "km", definition: "Distance to the nearest residential settlement; buffers dust, noise and emissions.", evidence: "Mapped distance to the nearest dwellings or settlement boundary.", source: "Satellite imagery; OpenStreetMap; field verification" },
];
