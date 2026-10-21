export const instant = false;
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import type { ScenarioResult } from "@/lib/pipeline";
import MapViewWrapper from "@/components/MapViewWrapper";
import HaulageChart from "@/components/HaulageChart";

const usd = (v: number) =>
  v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v).toLocaleString()}`;

const GROUP_COLORS: Record<string, string> = {
  Industrial: "bg-violet-500", Logistical: "bg-sky-500", Utility: "bg-emerald-500",
  Land: "bg-amber-500", Environmental: "bg-rose-500",
};

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenario = await prisma.scenario.findUnique({ where: { id: Number(id) } });
  if (!scenario) notFound();
  const r = JSON.parse(scenario.result) as ScenarioResult;
  const ranked = [...r.sites].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const maxScore = Math.max(...r.sites.map((s) => s.score ?? 0), 1);
  const byCost = [...r.sites].filter((s) => s.costRank != null).sort((a, b) => a.costRank! - b.costRank!);
  const flips = r.sensitivity.weightPerturbations.filter((w) => w.winnerChanged);
  const supplyRuns = r.sensitivity.supplyPerturbations ?? [];
  const fragileReasons = r.sensitivity.fragileReasons ?? [];
  const winner = r.sites.find((s) => s.siteId === r.winnerSiteId);
  const totalSupply = r.mines.reduce((a, m) => a + m.annualSupplyT, 0);
  const pctFmt = (v: number | null) => (v == null ? "n/a" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/" className="text-indigo-600 hover:underline">← Dashboard</Link>
        <span className="text-slate-400">/</span>
        <span className="font-semibold">{scenario.name}</span>
        <span className="ml-auto text-xs text-slate-400">
          {new Date(scenario.createdAt).toLocaleString()} · haul rate ${r.haulRateUsdPerTKm}/t·km
        </span>
      </div>

      {/* Winner banner */}
      {r.winnerName ? (
        <div className="rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-xl">
          <div className="text-sm font-medium uppercase tracking-wide text-purple-200">Recommended site (minimum annual cost)</div>
          <div className="mt-1 text-3xl font-extrabold">{r.winnerName}</div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span>Score: <b>{winner?.score?.toFixed(1)}</b>/100</span>
            <span>Est. annual cost: <b>{usd(winner?.annualCostUsd ?? 0)}</b></span>
            <span>{r.sites.filter((s) => s.gatePass).length}/{r.sites.length} sites passed gates</span>
          </div>
          {r.scoreLeaderName && r.scoreLeaderSiteId !== r.winnerSiteId && (
            <p className="mt-2 text-sm text-purple-100">
              Note: the highest weighted score belongs to <b>{r.scoreLeaderName}</b>; the cost-optimal site differs.
            </p>
          )}
          {r.sensitivity.fragile != null && (
            <p className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${r.sensitivity.fragile ? "bg-amber-300 text-amber-950" : "bg-emerald-300 text-emerald-950"}`}>
              {r.sensitivity.fragile ? "FRAGILE — gather better evidence before committing" : "ROBUST under tested perturbations"}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-rose-600 p-6 text-white shadow-xl">
          No site passed all feasibility gates.
        </div>
      )}

      {/* Map */}
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow">
        <h2 className="mb-3 font-bold text-slate-800">Spatial view</h2>
        <MapViewWrapper
          sites={r.sites.map((s) => ({
            id: s.siteId, name: s.name, lat: s.lat, lon: s.lon,
            status: s.siteId === r.winnerSiteId ? "winner" : s.gatePass ? "pass" : "fail",
            score: s.score,
          }))}
          mines={r.mines}
          legs={r.allocation?.allocations.map((a) => ({ mineId: a.mineId, tonnes: a.tonnes })) ?? []}
        />
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#7c3aed" }} />Recommended</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#059669" }} />Passed</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#e11d48" }} />Failed gates</span>
          <span><i className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#d97706" }} />Mine</span>
        </div>
      </section>

      {/* Optimisation model */}
      <section className="rounded-2xl border border-slate-300 bg-white/80 p-6 shadow">
        <h2 className="font-bold text-slate-800">Optimisation model</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{`Sets:      i = mines, j = candidate sites
Data:      S_i = annual supply of mine i, C_j = capacity of site j,
           d_ij = road km, r = haulage rate (USD/t·km),
           F_j = fixed opex, L_j = land cost / 20-yr amortisation
Variables: y_j ∈ {0,1} (site j selected), x_ij ≥ 0 (t/yr from mine i to site j)

min  Σ_j [ F_j + L_j ] y_j + Σ_i Σ_j r · d_ij · x_ij
s.t. Σ_j y_j = 1                      (exactly one facility)
     Σ_j x_ij ≤ S_i      ∀ i          (mine supply limit)
     Σ_i x_ij = C_j · y_j ∀ j         (plant fed to capacity if selected)
     y_j = 0 if site j fails any feasibility gate
     (water, grid, settlement buffer, protected land, capacity, land area,
      tailings, and Σ_i S_i ≥ C_j supply sufficiency)

Solution:  enumerate each gate-passing site, solve its transportation
           allocation exactly (cheapest road-km first), pick minimum total.`}</pre>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>Haulage rate r = <b>${r.haulRateUsdPerTKm}/t·km</b></span>
          <span>Total mine supply ΣS_i = <b>{totalSupply.toLocaleString()} t/yr</b></span>
          {r.allocation && (
            <span>
              Winner demand C_j = <b>{r.allocation.demandT.toLocaleString()} t/yr</b>
              {" "}(supply headroom {(totalSupply - r.allocation.demandT).toLocaleString()} t)
            </span>
          )}
        </div>
      </section>

      {/* Gates */}
      <section className="rounded-2xl border border-emerald-200 bg-white/80 p-6 shadow">
        <h2 className="font-bold text-emerald-800">Feasibility gates</h2>
        <div className="mt-3 space-y-4">
          {r.sites.map((s) => (
            <div key={s.siteId} className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{s.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  s.gatePass ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}>
                  {s.gatePass ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {s.gateOutcomes.map((g) => (
                  <span
                    key={g.label}
                    title={`${g.label}: ${String(g.value)} (threshold ${g.threshold} ${g.unit})`}
                    className={`rounded-lg px-2 py-1 text-xs font-medium ${
                      g.pass ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                    }`}
                  >
                    {g.pass ? "✓" : "✗"} {g.label}: {typeof g.value === "boolean" ? (g.value ? "yes" : "no") : g.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Scores */}
      <section className="rounded-2xl border border-violet-200 bg-white/80 p-6 shadow">
        <h2 className="font-bold text-violet-800">Weighted scores</h2>
        <div className="mt-4 space-y-3">
          {ranked.map((s) => (
            <details key={s.siteId} className="rounded-xl border border-slate-100 p-4 open:bg-violet-50/40">
              <summary className="flex cursor-pointer items-center gap-3">
                {s.rank && (
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
                    s.rank === 1 ? "bg-violet-600" : "bg-slate-400"
                  }`}>{s.rank}</span>
                )}
                <span className="font-semibold text-slate-800">{s.name}</span>
                {s.score != null ? (
                  <>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${s.rank === 1 ? "bg-gradient-to-r from-violet-500 to-fuchsia-500" : "bg-slate-400"}`}
                        style={{ width: `${(s.score / maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-bold text-violet-700">{s.score.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-sm text-rose-500">excluded by gates</span>
                )}
              </summary>
              {s.breakdown && (
                <table className="mt-3 w-full text-xs">
                  <thead className="text-left uppercase text-slate-400">
                    <tr><th className="pb-1">Criterion</th><th className="pb-1">Group</th><th className="pb-1">Raw</th><th className="pb-1">Normalised</th><th className="pb-1">Contribution</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {s.breakdown.map((b) => (
                      <tr key={b.criterionId}>
                        <td className="py-1.5 text-slate-700">{b.name}</td>
                        <td className="py-1.5">
                          <span className={`mr-1 inline-block h-2 w-2 rounded-full ${GROUP_COLORS[b.grp] ?? "bg-slate-400"}`} />
                          {b.grp}
                        </td>
                        <td className="py-1.5">{Number.isInteger(b.raw) ? b.raw : b.raw.toFixed(1)} {b.unit}</td>
                        <td className="py-1.5">{b.normalised.toFixed(0)}/100</td>
                        <td className="py-1.5 font-semibold text-violet-700">{b.contribution.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </details>
          ))}
        </div>
      </section>

      {/* Costs + allocation */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-amber-200 bg-white/80 p-6 shadow">
          <h2 className="font-bold text-amber-800">Estimated annual costs</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr><th className="pb-1">#</th><th className="pb-1">Site</th><th className="pb-1">Haulage</th><th className="pb-1">Fixed opex</th><th className="pb-1">Land amort.</th><th className="pb-1">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byCost.filter((s) => s.costBreakdown).map((s) => (
                <tr key={s.siteId} className={s.siteId === r.winnerSiteId ? "bg-amber-50 font-semibold" : ""}>
                  <td className="py-2">{s.costRank}</td>
                  <td className="py-2">{s.name}</td>
                  <td className="py-2">{usd(s.costBreakdown!.haulage)}</td>
                  <td className="py-2">{usd(s.costBreakdown!.fixedOpex)}</td>
                  <td className="py-2">{usd(s.costBreakdown!.landAmortisation)}</td>
                  <td className="py-2 font-bold text-amber-700">{usd(s.annualCostUsd!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-teal-200 bg-white/80 p-6 shadow">
          <h2 className="font-bold text-teal-800">Feedstock allocation — {r.winnerName ?? "n/a"}</h2>
          {r.allocation && r.allocation.allocations.length > 0 ? (
            <>
              <table className="mt-3 w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400">
                  <tr><th className="pb-1">Mine</th><th className="pb-1">Tonnes/yr</th><th className="pb-1">Road km</th><th className="pb-1">Cost</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.allocation.allocations.map((a) => (
                    <tr key={a.mineId}>
                      <td className="py-2 font-medium">{a.mineName}</td>
                      <td className="py-2">{a.tonnes.toLocaleString()}</td>
                      <td className="py-2">{a.distanceKm.toFixed(0)}</td>
                      <td className="py-2 font-semibold text-teal-700">{usd(a.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-sm">
                Total haulage: <b className="text-teal-700">{usd(r.allocation.totalHaulageUsd)}</b>
                {!r.allocation.feasible && (
                  <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                    Supply shortfall: {(r.allocation.demandT - r.allocation.suppliedT).toLocaleString()} t unmet
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No allocation — no site passed the gates.</p>
          )}
        </section>
      </div>

      {/* Sensitivity */}
      <section className="rounded-2xl border border-indigo-200 bg-white/80 p-6 shadow">
        <h2 className="font-bold text-indigo-800">Sensitivity</h2>
        {r.sensitivity.fragile != null && (
          <div className={`mt-3 rounded-xl p-4 text-sm font-medium ${r.sensitivity.fragile ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
            {r.sensitivity.fragile
              ? <>Fragile: {fragileReasons.join("; ")}.</>
              : "Robust: the recommendation is unchanged under all tested perturbations."}
          </div>
        )}
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-600">Lowest annual cost vs haulage rate</h3>
            <HaulageChart points={r.sensitivity.haulage} />
            <table className="mt-2 w-full text-xs">
              <thead className="text-left uppercase text-slate-400">
                <tr><th className="pb-1">Rate</th><th className="pb-1">Cost</th><th className="pb-1">Δ cost</th><th className="pb-1">Optimal site</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.sensitivity.haulage.map((p) => (
                  <tr key={p.multiplier}>
                    <td className="py-1">${p.haulRate.toFixed(3)} ({p.multiplier}×)</td>
                    <td className="py-1">{p.annualCostUsd != null ? usd(p.annualCostUsd) : "n/a"}</td>
                    <td className="py-1">{pctFmt(p.costChangePct ?? null)}</td>
                    <td className={`py-1 ${p.winnerChanged ? "font-semibold text-rose-600" : ""}`}>{p.winnerName ?? "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="mt-5 text-sm font-semibold text-slate-600">Mine supply perturbations (±15%)</h3>
            {supplyRuns.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Re-run the scenario to include supply sensitivity.</p>
            ) : (
              <table className="mt-2 w-full text-xs">
                <thead className="text-left uppercase text-slate-400">
                  <tr><th className="pb-1">Supply</th><th className="pb-1">Feasible sites</th><th className="pb-1">Optimal site</th><th className="pb-1">Cost</th><th className="pb-1">Δ cost</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplyRuns.map((p) => (
                    <tr key={p.label}>
                      <td className="py-1">{p.label}</td>
                      <td className="py-1">{p.feasibleSites}</td>
                      <td className={`py-1 ${p.winnerChanged ? "font-semibold text-rose-600" : ""}`}>{p.winnerName ?? "none"}</td>
                      <td className="py-1">{p.annualCostUsd != null ? usd(p.annualCostUsd) : "n/a"}</td>
                      <td className="py-1">{pctFmt(p.costChangePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-600">Weight perturbations (±10%) — top-scoring site</h3>
            {flips.length === 0 ? (
              <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                Robust: the top-scoring site never changes under ±10% perturbation of any single criterion weight.
              </p>
            ) : (
              <table className="mt-3 w-full text-xs">
                <thead className="text-left uppercase text-slate-400">
                  <tr><th className="pb-1">Criterion</th><th className="pb-1">Perturbation</th><th className="pb-1">New winner</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flips.map((w, i) => (
                    <tr key={i}>
                      <td className="py-1.5">{w.criterionName}</td>
                      <td className="py-1.5">{w.direction}</td>
                      <td className="py-1.5 font-semibold text-rose-600">{w.winnerName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
