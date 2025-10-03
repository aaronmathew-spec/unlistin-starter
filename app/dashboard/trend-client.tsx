/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";

export type TrendPoint = { date: string; prepared: number; completed: number };

/**
 * Lightweight responsive SVG chart (no external deps).
 * Expects data: [{ date: 'YYYY-MM-DD', prepared: number, completed: number }]
 */
export default function TrendClient({ data }: { data: TrendPoint[] }) {
  const safe = Array.isArray(data) ? data : [];

  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 24, left: 32 };

  const { pointsPrepared, pointsCompleted, xTicks, yTicks } = useMemo(() => {
    const xs = safe.map((_, i) => i);
    const ys = [0, ...safe.map((d) => d.prepared || 0), ...safe.map((d) => d.completed || 0)];
    const xMin = 0;
    const xMax = Math.max(0, xs.length - 1);
    const yMin = 0;
    const yMax = Math.max(1, Math.max(...ys));

    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const sx = (x: number) =>
      padding.left + (xMax === 0 ? 0 : (x - xMin) / (xMax - xMin)) * innerW;
    const sy = (y: number) =>
      padding.top + innerH - (y - yMin) / (yMax - yMin) * innerH;

    const toPath = (arr: Array<{ x: number; y: number }>) =>
      arr.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ");

    const pointsPrepared = toPath(safe.map((d, i) => ({ x: i, y: d.prepared || 0 })));
    const pointsCompleted = toPath(safe.map((d, i) => ({ x: i, y: d.completed || 0 })));

    // simple ticks: 5 y-ticks
    const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((i * yMax) / 4));
    // x ticks: first, middle, last label
    const xTicksIdx = [0, Math.floor(xs.length / 2), xs.length - 1].filter(
      (v, i, a) => a.indexOf(v) === i && v >= 0
    );
    const xTicks = xTicksIdx.map((i) => ({
      i,
      label: safe[i]?.date?.slice(5) || "",
    }));

    return { pointsPrepared, pointsCompleted, xTicks, yTicks };
  }, [safe]);

  return (
    <div className="w-full h-56">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {/* Grid */}
        <g stroke="currentColor" opacity="0.1">
          {yTicks.map((_, idx) => (
            <line
              key={idx}
              x1={padding.left}
              x2={width - padding.right}
              y1={height - padding.bottom - ((height - padding.top - padding.bottom) * idx) / 4}
              y2={height - padding.bottom - ((height - padding.top - padding.bottom) * idx) / 4}
            />
          ))}
        </g>

        {/* Axes labels */}
        <g fill="currentColor" opacity="0.6" fontSize="10">
          {yTicks.map((t, idx) => (
            <text
              key={idx}
              x={4}
              y={height - padding.bottom - ((height - padding.top - padding.bottom) * idx) / 4 + 3}
            >
              {t}
            </text>
          ))}
          {xTicks.map((t) => (
            <text
              key={t.i}
              x={
                padding.left +
                (t.i / Math.max(1, safe.length - 1)) *
                  (width - padding.left - padding.right)
              }
              y={height - 6}
              textAnchor="middle"
            >
              {t.label}
            </text>
          ))}
        </g>

        {/* Lines */}
        <g fill="none" strokeWidth="2">
          <path d={pointsPrepared} stroke="currentColor" opacity="0.9" />
          <path d={pointsCompleted} stroke="currentColor" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}
