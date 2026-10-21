"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HaulRatePoint } from "@/lib/sensitivity";

export default function HaulageChart({ points }: { points: HaulRatePoint[] }) {
  const data = points.map((p) => ({
    rate: p.haulRate.toFixed(2),
    cost: p.annualCostUsd ? Math.round(p.annualCostUsd) : null,
    winner: p.winnerName,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="rate" label={{ value: "Haulage rate USD/t·km", position: "insideBottom", offset: -2, fontSize: 12 }} />
        <YAxis tickFormatter={(v: number) => `$${(v / 1e6).toFixed(1)}M`} width={70} />
        <Tooltip formatter={(v) => (typeof v === "number" ? `$${(v / 1e6).toFixed(2)}M` : "n/a")} />
        <Legend />
        <Line
          type="monotone"
          dataKey="cost"
          name="Lowest annual cost"
          stroke="#7c3aed"
          strokeWidth={3}
          dot={{ r: 5, fill: "#059669" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
