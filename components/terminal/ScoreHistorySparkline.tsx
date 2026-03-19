"use client";

import React from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface ScoreHistorySparklineProps {
  history: number[];
  currentScore: number;
}

const ScoreHistorySparkline: React.FC<ScoreHistorySparklineProps> = ({ history, currentScore }) => {
  if (!history || history.length < 2) return null;

  const data = history.map((score, i) => ({ i, score }));
  const trend = history.length >= 2 ? history[history.length - 1] - history[history.length - 2] : 0;
  const strokeColor = currentScore >= 60 ? "#00FF94" : currentScore >= 40 ? "#FFB800" : "#FF2E2E";

  return (
    <div className="mt-4 w-full flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Score History</span>
        <span className={`text-[10px] font-bold ${trend >= 0 ? "text-[#00FF94]" : "text-[#FF2E2E]"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)} pts
        </span>
      </div>
      <div className="h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="score"
              stroke={strokeColor}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload?.length) {
                  return (
                    <div className="bg-[#0B0F17] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white font-bold">
                      {payload[0].value}
                    </div>
                  );
                }
                return null;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ScoreHistorySparkline;
