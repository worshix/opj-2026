# Lithium Site Selection (LiSelect·ZW)

A decision-support web application for choosing where to site a lithium
processing plant in Zimbabwe. It screens candidate sites against hard
feasibility gates, scores them against weighted criteria, selects the
minimum-cost site while allocating mine feedstock to it, and tests how
stable that recommendation is when assumptions change.

---

## 1. How the application meets the project objectives

### Objective 1 — Structured criteria framework with required evidence

> To develop a structured criteria framework that identifies and defines the
> industrial, logistical, utility, land and environmental factors influencing
> candidate-site suitability together with the evidence required to assess
> each factor.

| Requirement | Where it is met |
|---|---|
| Factors grouped as industrial, logistical, utility, land, environmental | **Criteria** page. The 15 criteria are stored in the `Criterion` table, each with a group (`grp`). |
| Each factor is defined | Every criterion has a `definition`. |
| Evidence required to assess each factor | Every criterion has `evidence` (what must be collected) and `source` (where it comes from). |
| Measurement basis | Each criterion has a data field, a direction (benefit or cost), a normalisation range (min–max) and a unit. |
| Hard feasibility requirements | The Criteria page lists the 8 feasibility gates, each with threshold, definition and required evidence (`lib/gates.ts`). |

### Objective 2 — Transparent mathematical optimisation model

> To formulate a transparent mathematical optimisation model for facility
> selection and inbound feedstock allocation incorporating clearly stated
> capacity, supply and feasibility constraints.

The model is implemented in `lib/evaluate.ts`, `lib/transport.ts` and
`lib/gates.ts`, and is printed with live figures in the **Optimisation model**
panel of every scenario page.

```
Sets:      i = mines, j = candidate sites
Data:      S_i = annual supply of mine i, C_j = capacity of site j,
           d_ij = road km, r = haulage rate (USD/t·km),
           F_j = fixed opex, L_j = land cost / 20-year amortisation
Variables: y_j ∈ {0,1} (site j selected), x_ij ≥ 0 (t/yr from mine i to site j)

min  Σ_j [ F_j + L_j ] y_j + Σ_i Σ_j r · d_ij · x_ij
s.t. Σ_j y_j = 1                      exactly one facility
     Σ_j x_ij ≤ S_i      ∀ i          mine supply limit
     Σ_i x_ij = C_j · y_j ∀ j         plant fed to capacity if selected
     y_j = 0 if site j fails any feasibility gate
```

- **Capacity constraint:** a selected plant must be fed exactly its capacity.
- **Supply constraint:** a mine cannot ship more than its annual supply, and a
  site is infeasible if total mine supply is below its capacity.
- **Feasibility constraints:** water, grid, settlement buffer, protected land,
  capacity, land area, tailings suitability and supply sufficiency.
- **Solution method:** every gate-passing site is evaluated. For each one the
  allocation is solved exactly (ship from the nearest mines first, which is
  optimal for a single destination with constant unit costs). The site with the
  lowest total annual cost is selected.
- **Weighted score:** a 0–100 score is also computed for every feasible site.
  It informs the decision and is reported alongside the cost result, and the
  scenario page flags when the top-scoring site differs from the cost-optimal one.

### Objective 3 — User-facing computational system

> To develop a user-facing computational system that reports feasibility-gate
> outcomes, estimated annual costs, allocation decisions and sensitivity to
> changing assumptions.

Each scenario page (`/scenarios/[id]`) reports:

| Required output | Section on the scenario page |
|---|---|
| Feasibility-gate outcomes | **Feasibility gates**: PASS/FAIL per site, with the measured value for each gate. |
| Estimated annual costs | **Estimated annual costs**: haulage, fixed opex, land amortisation and total, ranked by cost. |
| Allocation decisions | **Feedstock allocation**: tonnes per mine, road km and cost for the recommended site, plus a map of the haulage legs. |
| Sensitivity to assumptions | **Sensitivity**: haulage rate, mine supply and criterion weights, with a robust or fragile verdict. |

---

## 2. Running the application

Requires Node.js and pnpm.

```bash
pnpm install
npx prisma migrate deploy   # create / update the SQLite database (prisma/dev.db)
npx prisma generate         # generate the Prisma client
pnpm dev                    # http://localhost:3000
```

On first start the Dashboard shows **Load Zimbabwe demo dataset**. Click it to
load 5 candidate sites, 5 mines and 15 criteria.

Other commands: `pnpm build`, `pnpm start`, `pnpm lint`.

---

## 3. Recommended workflow

1. **Mines**: enter the feedstock sources and their annual supply.
2. **Sites**: enter the candidate sites and their measured attributes.
3. **Criteria**: review the definitions and evidence, then adjust the weights.
4. **Dashboard**: set the haulage rate and run a scenario.
5. **Scenario page**: read the recommendation, then check the gates, costs, allocation and sensitivity.

---

## 4. Pages and inputs

### Dashboard (`/`)

Purpose: run scenarios and open past results.

| Input | Purpose |
|---|---|
| Load Zimbabwe demo dataset (only when the database is empty) | Seeds example sites, mines and criteria. |
| Scenario name | Label for the saved run. Defaults to a timestamp. |
| Haulage rate (USD/t·km) | Unit cost of road transport, `r` in the model. Default is 0.25. |
| Run selection pipeline | Runs the full analysis and saves the result as a scenario. |
| Recent scenarios list | Opens or deletes the last 10 runs. Each run is a saved snapshot. |

The tiles show how many sites, mines and criteria are loaded and the total criterion weight.

### Mines (`/mines`)

Purpose: define the feedstock supply that the plant draws on.

| Input | Purpose |
|---|---|
| Name | Identifies the mine in allocations and on the map. |
| Latitude / Longitude | Used to compute road distance to each site (straight-line distance × 1.3 road factor). |
| Annual supply (t) | Supply limit `S_i`. A mine never ships more than this, and total supply must cover a site's capacity. |
| Notes | Free text, such as ore type. It is not used in calculations. |

### Sites (`/sites`)

Purpose: define candidate plant locations. The table shows a live PASS or FAIL
on the site-only gates. The supply gate is added when a scenario runs.

| Input | Purpose |
|---|---|
| Name, Latitude, Longitude | Identification, map position and distance to mines. |
| Capacity (t/yr) | Plant throughput `C_j`. This is the feedstock demand in the allocation. It is a gate (at least 200,000) and a score criterion. |
| Water (ML/day) | Gate (at least 4) and score criterion. |
| Grid reliability (0–1) | Fraction of time power is available. Gate (at least 0.7) and score criterion. |
| Settlement distance (km) | Gate (at least 3) and score criterion. |
| On protected land (checkbox) | Gate: any protected site is excluded. |
| Protected buffer (km) | Recorded for reference. |
| Land area (ha) | Gate (at least 50), score criterion and land cost. |
| Land price (USD/ha) | Score criterion. Land cost is price × area ÷ 20 years. |
| Tailings suitability (/10) | Gate (at least 5) and score criterion. |
| Rail distance, substation distance (km) | Score criteria. |
| Road quality, flatness, labour, environmental sensitivity, seismic risk (/10) | Score criteria. |
| Fixed opex (USD/yr) | Fixed annual operating cost, part of the total cost. |

### Criteria (`/criteria`)

Purpose: document the framework and set how much each factor matters.

- The feasibility gates table gives each gate's threshold, definition and
  required evidence. It is read-only. Thresholds are set in `lib/gates.ts`.
- Criteria are grouped by Industrial, Logistical, Utility, Land and
  Environmental. Each shows its data field, definition, required evidence and
  source, direction, range and unit.
- **Weight inputs:** a higher weight gives the criterion more influence on the
  score. Weights are normalised, so only their relative size matters. Click
  **Save weights** to store them. Changes apply to the next scenario you run.

### Scenario page (`/scenarios/[id]`)

Purpose: the results report. Nothing is entered here.

1. **Recommendation banner:** the minimum-cost site, its score, its annual
   cost and how many sites passed. It notes when the top-scoring site differs
   and shows the ROBUST or FRAGILE verdict.
2. **Spatial view:** map of mines, sites and haulage legs. The recommended
   site is purple, passed sites green, failed sites red and mines amber.
3. **Optimisation model:** the formulation with the run's haulage rate, total
   supply and supply headroom.
4. **Feasibility gates:** every gate for every site. Hover a badge for the
   measured value against the threshold.
5. **Weighted scores:** score ranking with a per-criterion breakdown (raw
   value, normalised 0–100, weighted contribution).
6. **Estimated annual costs:** haulage + fixed opex + land amortisation for
   each feasible site, ranked by total.
7. **Feedstock allocation:** tonnes, road km and cost per mine for the
   recommended site.
8. **Sensitivity:**
   - Haulage rate at 0.5×, 0.8×, 1×, 1.2×, 1.5× and 2×: cost and the percent
     change from the base cost.
   - Mine supply at ±15%: how many sites stay feasible, the optimal site and the cost change.
   - Criterion weights at ±10%, one at a time: whether the top-scoring site changes.
   - **FRAGILE** means the optimal site or top-scoring site changes under a
     tested perturbation, or the cost-optimal and top-scoring sites differ.
     Gather better evidence before committing. **ROBUST** means neither changes.

---

## 5. How a scenario is computed

1. **Gates:** each site is tested against the 7 site gates plus supply
   sufficiency. Failing any gate excludes it.
2. **Scoring:** for each remaining site, each criterion value is normalised to
   0–100 using its min–max range (inverted for cost-type criteria). The score is
   the weight-averaged sum.
3. **Allocation:** each feasible site's feedstock demand is filled from the
   nearest mines first, up to each mine's supply.
4. **Cost:** annual cost = haulage + fixed opex + land price × area ÷ 20.
5. **Selection:** the feasible site with the lowest annual cost is
   recommended.
6. **Sensitivity:** the steps above are repeated under each perturbation.

The *supply-weighted mine distance* criterion is derived by the system. It is
the mean road distance to all mines, weighted by their supply, so it needs no
input.

## 6. Data and assumptions

- Data is stored in a local SQLite file, `prisma/dev.db`. Back it up to keep it.
- Distances are straight-line distances times 1.3, not routed roads.
- Cost covers haulage, fixed opex and land amortisation only. Capital cost,
  processing cost and revenue are not modelled.
- The model selects one plant. The allocation is solved per site, which is exact for a
  single destination.
- Gate thresholds, the 20-year land amortisation and the 1.3 road factor are
  set in code (`lib/gates.ts`, `lib/cost.ts`, `lib/geo.ts`).
- Seeded demo values are illustrative and need replacing with surveyed data
  for a real decision.

## 7. Project layout

| Path | Contents |
|---|---|
| `app/` | Pages (dashboard, sites, mines, criteria, scenarios) and server actions (`actions.ts`). |
| `lib/gates.ts` | Gate definitions, thresholds and evaluation. |
| `lib/scoring.ts` | Normalisation and weighted scoring. |
| `lib/transport.ts` | Feedstock allocation. |
| `lib/cost.ts` | Annual cost model. |
| `lib/evaluate.ts` | Per-site evaluation and cost-optimal selection. |
| `lib/sensitivity.ts` | Perturbation analysis. |
| `lib/pipeline.ts` | Scenario assembly. |
| `lib/demo-data.ts` | Demo sites, mines and criteria with evidence text. |
| `prisma/` | Database schema and migrations. |
| `components/` | Map and chart components. |

Built with Next.js, React, Prisma (SQLite), Leaflet and Recharts.
