"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cedis } from "@/lib/utils";

type Row = { label: string; joined: number; members: number; income: number; expense: number };

const axis = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "#94a3b8", fontWeight: 600 } } as const;
const tooltip = { contentStyle: { borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600 } };

export function GrowthCharts({ data, hasMembers, hasMoney }: { data: Row[]; hasMembers: boolean; hasMoney: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Membership Growth" empty={!hasMembers && "No membership data available"}>
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" {...axis} />
          <YAxis allowDecimals={false} width={32} {...axis} />
          <Tooltip {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="members" name="Total members" stroke="#1e3a8a" strokeWidth={3} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="joined" name="New visitors" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </Panel>
      <Panel title="Monthly Revenue" empty={!hasMoney && "No financial data available"}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" {...axis} />
          <YAxis width={72} tickFormatter={(v: number) => cedis(v)} {...axis} />
          <Tooltip formatter={(v) => cedis(Number(v))} {...tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Income" fill="#16a34a" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expense" name="Expenses" fill="#f87171" radius={[6, 6, 0, 0]} />
        </BarChart>
      </Panel>
    </div>
  );
}

function Panel({ title, empty, children }: { title: string; empty: string | false; children: React.ReactElement }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{title}</h3>
      <div className="mt-4 h-[280px]">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{empty}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
