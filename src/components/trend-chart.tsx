"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cedis } from "@/lib/utils";

/** Area chart of one money series by month label. */
export function TrendChart({ data, color = "#1e3a8a" }: { data: { label: string; value: number }[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={72}
          tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
          tickFormatter={(v: number) => cedis(v)}
        />
        <Tooltip
          formatter={(v) => [cedis(Number(v)), "Giving"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 700 }}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
