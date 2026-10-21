export const instant = false;
import { prisma } from "@/lib/db";
import { updateCriterionWeights } from "../actions";
import { ALL_GATE_INFO } from "@/lib/gates";

const GROUP_COLORS: Record<string, string> = {
  Industrial: "bg-violet-500",
  Logistical: "bg-sky-500",
  Utility: "bg-emerald-500",
  Land: "bg-amber-500",
  Environmental: "bg-rose-500",
};

export default async function CriteriaPage() {
  const criteria = await prisma.criterion.findMany({ orderBy: [{ grp: "asc" }, { weight: "desc" }] });
  const groups = [...new Set(criteria.map((c) => c.grp))];
  const weightSum = criteria.reduce((a, c) => a + c.weight, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-extrabold text-violet-800">Criteria Framework</h1>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">
          Weight total: {weightSum}
        </span>
      </div>

      <section className="rounded-2xl border border-emerald-200 bg-white/80 p-5 shadow">
        <h2 className="font-bold text-emerald-800">Feasibility gates (pass/fail)</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr><th className="pb-1">Gate</th><th className="pb-1">Threshold</th><th className="pb-1">Definition</th><th className="pb-1">Evidence required</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 align-top">
            {ALL_GATE_INFO.map((g) => (
              <tr key={g.label}>
                <td className="py-2 font-medium text-slate-700">{g.label}</td>
                <td className="py-2 whitespace-nowrap text-slate-500">{g.threshold} {g.unit}</td>
                <td className="py-2 text-slate-600">{g.definition}</td>
                <td className="py-2 text-slate-600">{g.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form action={updateCriterionWeights} className="space-y-5">
        {groups.map((g) => (
          <section key={g} className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${GROUP_COLORS[g] ?? "bg-slate-400"}`} />
              <h2 className="font-bold text-slate-800">{g}</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-1">Criterion</th>
                  <th className="pb-1">Direction</th>
                  <th className="pb-1">Range</th>
                  <th className="pb-1 w-24">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {criteria.filter((c) => c.grp === g).map((c) => (
                  <tr key={c.id}>
                    <td className="py-2">
                      <div className="font-medium text-slate-700">{c.name}</div>
                      <div className="font-mono text-xs text-slate-400">{c.fieldKey}</div>
                      {c.definition && <p className="mt-1 text-xs text-slate-600">{c.definition}</p>}
                      {c.evidence && <p className="mt-1 text-xs text-slate-500"><b>Evidence:</b> {c.evidence}</p>}
                      {c.source && <p className="text-xs text-slate-500"><b>Source:</b> {c.source}</p>}
                    </td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        c.direction === "benefit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {c.direction}
                      </span>
                    </td>
                    <td className="py-2 text-slate-500">{c.min}–{c.max} {c.unit}</td>
                    <td className="py-2">
                      <input name={`weight_${c.id}`} type="number" step="0.5" min="0" defaultValue={c.weight} className="w-20" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <button className="btn bg-violet-600">Save weights</button>
      </form>
    </div>
  );
}
