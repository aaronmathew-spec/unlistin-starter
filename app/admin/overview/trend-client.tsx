/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";

/**
 * Admin trend chart (no external libs).
 * data: [{ date: 'YYYY-MM-DD', prepared: number, sent: number, completed: number }]
 */
export function TrendClientAdmin({
  data,
}: {
  data: Array<{ date: string; prepared: number; sent?: number; completed: number }>;
}) {
  const width = 820;
  const height = 260;
  const pad = { t: 16, r: 16, b: 28, l: 36 };

  const { pathPrepared, pathSent, pathCompleted, ticksX, ticksY } = useMemo(() => {
    const xs = data.map((_, i) => i);
    const ys = [
      0,
      ...data.map((d) => d.prepared || 0),
      ...data.map((d) => d.sent || 0),
      ...data.map((d) => d.completed || 0),
    ];
    const xMin = 0, xMax = Math.max(0, xs.length - 1);
    const yMin = 0, yMax = Math.max(1, Math.max(...ys));
    const innerW = width - pad.l - pad.r;
    const innerH = height - pad.t - pad.b;
    const sx = (x: number) => pad.l + (xMax === 0 ? 0 : (x - xMin) / (xMax - xMin)) * innerW;
    const sy = (y: number) => pad.t + innerH - (y - yMin) / (yMax - yMin) * innerH;

    const toPath = (ys: number[]) =>
      ys.map((y, i) => `${i === 0 ? "M" : "L"} ${sx(i)} ${sy(y)}`).join(" ");

    const pathPrepared = toPath(data.map((d) => d.prepared || 0));
    const pathSent = toPath(data.map((d) => d.sent || 0));
    const pathCompleted = toPath(data.map((d) => d.completed || 0));

    const ticksY = Array.from({ length: 5 }, (_, i) => Math.round((i * yMax) / 4));
    const idxs = [0, Math.floor(xs.length / 2), xs.length - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 0);
    const ticksX = idxs.map((i) => ({ i, label: data[i]?.date?.slice(5) || "" }));

    return { pathPrepared, pathSent, pathCompleted, ticksX, ticksY };
  }, [data]);

  return (
    <div className="w-full h-64">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {/* grid */}
        <g stroke="currentColor" opacity="0.1">
          {ticksY.map((_, i) => {
            const y = height - pad.b - ((height - pad.t - pad.b) * i) / 4;
            return <line key={i} x1={pad.l} x2={width - pad.r} y1={y} y2={y} />;
          })}
        </g>

        {/* axes labels */}
        <g fill="currentColor" opacity="0.6" fontSize="10">
          {ticksY.map((t, i) => {
            const y = height - pad.b - ((height - pad.t - pad.b) * i) / 4 + 3;
            return <text key={i} x={4} y={y}>{t}</text>;
          })}
          {ticksX.map((t) => (
            <text
              key={t.i}
              x={pad.l + (t.i / Math.max(1, data.length - 1)) * (width - pad.l - pad.r)}
              y={height - 8}
              textAnchor="middle"
            >
              {t.label}
            </text>
          ))}
        </g>

        {/* series */}
        <g fill="none" strokeWidth="2">
          <path d={pathPrepared} stroke="currentColor" opacity="0.9" />
          <path d={pathSent} stroke="currentColor" opacity="0.6" />
          <path d={pathCompleted} stroke="currentColor" opacity="0.4" />
        </g>
      </svg>
    </div>
  );
}
