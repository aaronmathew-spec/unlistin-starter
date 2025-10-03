/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function TrendClient({ data }: { data: Array<{ date: string; prepared: number; completed: number }> }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="prepared" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopOpacity={0.6}/>
              <stop offset="95%" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="completed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopOpacity={0.6}/>
              <stop offset="95%" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" fontSize={12} />
          <YAxis allowDecimals={false} fontSize={12} />
          <Tooltip />
          <Area type="monotone" dataKey="prepared" strokeWidth={2} fillOpacity={0.25} fill="url(#prepared)" />
          <Area type="monotone" dataKey="completed" strokeWidth={2} fillOpacity={0.25} fill="url(#completed)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
