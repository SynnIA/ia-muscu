"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Couleur de marque validée (dataviz : bande de luminance + contraste, mode sombre). */
const MARK = "#65a30d"; // lime-600
const GRID = "#27272a"; // zinc-800
const INK_MUTED = "#71717a"; // zinc-500

export type ChartOutput = {
  ok: boolean;
  title?: string;
  unit?: string;
  kind?: "line" | "bar";
  points?: { x: string; y: number }[];
  error?: string;
};

function formatDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function TooltipBox({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-zinc-900 px-3 py-2 text-xs ring-1 ring-zinc-700">
      <p className="text-zinc-400">{label ? formatDay(label) : ""}</p>
      <p className="font-semibold text-zinc-100">
        {payload[0].value} {unit}
      </p>
    </div>
  );
}

export default function ChartRenderer({ output }: { output: ChartOutput }) {
  if (!output.ok || !output.points?.length) return null;
  const { title, unit, kind, points } = output;
  const last = points[points.length - 1];

  const axisProps = {
    stroke: "none",
    tick: { fill: INK_MUTED, fontSize: 11 },
    tickLine: false,
    axisLine: false,
  } as const;

  return (
    <figure className="my-2 w-full min-w-[240px]">
      <figcaption className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-medium text-zinc-300">
          {title} <span className="text-zinc-500">({unit})</span>
        </span>
        {/* étiquette directe sélective : dernière valeur */}
        <span className="text-xs font-semibold text-zinc-100">
          {last.y} {unit?.split("/")[0]}
        </span>
      </figcaption>

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "line" ? (
            <LineChart data={points} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={GRID} strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="x"
                {...axisProps}
                tickFormatter={formatDay}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis {...axisProps} domain={["auto", "auto"]} width={52} />
              <Tooltip
                content={<TooltipBox unit={unit} />}
                cursor={{ stroke: INK_MUTED, strokeDasharray: "3 3" }}
              />
              <Line
                type="monotone"
                dataKey="y"
                stroke={MARK}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: MARK, stroke: "#09090b", strokeWidth: 2 }}
              />
            </LineChart>
          ) : (
            <BarChart data={points} margin={{ top: 6, right: 6, left: -18, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid stroke={GRID} strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="x"
                {...axisProps}
                tickFormatter={formatDay}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis {...axisProps} width={52} />
              <Tooltip
                content={<TooltipBox unit={unit} />}
                cursor={{ fill: "#ffffff", fillOpacity: 0.04 }}
              />
              <Bar dataKey="y" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Accessibilité : vue tableau des données */}
      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-zinc-600 hover:text-zinc-400">
          Voir les données
        </summary>
        <table className="mt-1 w-full text-[11px] text-zinc-400">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-0.5 font-normal">Date</th>
              <th className="py-0.5 font-normal">{title} ({unit})</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.x}>
                <td className="py-0.5">{formatDay(p.x)}</td>
                <td className="py-0.5 text-zinc-200">{p.y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
