"use client";

import React from "react";
import InfoPopover from "./InfoPopover";

interface WeightItem {
  label: string;
  score: number;
  weight: number;
  contribution: number;
  type: "positive" | "negative" | "warning";
}

interface ScoringWeightsProps {
  weights: WeightItem[];
  totalScore: number;
}

const INFO = [
  "Shows exactly how each factor contributes to the 0-100 Market Quality Score.",
  "Momentum Score (25% wt) now factors in RSI Divergence (Bullish +15, Bearish -15).",
  "Short-Term (Tactical) mode: Momentum/Volatility weighted higher for intraday signals.",
  "Swing (Positional) mode: Trend/Macro weighted higher for structural reliability.",
  "Score ≥ 60 = Supportive. Score < 45 = Risk-reduction suggested.",
  "Market Closed: Displays the 'Settlement Cache' snapshot from 4:00 PM ET close.",
];

const ScoringWeights: React.FC<ScoringWeightsProps> = ({ weights, totalScore }) => {
  const getColor = (type: string) => {
    if (type === "positive") return { bar: "bg-[#00FF94]", text: "text-[#00FF94]" };
    if (type === "warning")  return { bar: "bg-[#FFB800]", text: "text-[#FFB800]" };
    return { bar: "bg-[#FF2E2E]", text: "text-[#FF2E2E]" };
  };

  return (
    <div className="bg-[#0B0F17]/40 border border-white/5 rounded-xl p-5 backdrop-blur-md flex flex-col gap-4 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-white/60">Score Breakdown</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 font-medium tabular-nums">Total: {totalScore}/100</span>
          <InfoPopover title="Score Breakdown" bullets={INFO} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {weights.map((item, i) => {
          const c = getColor(item.type);
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50 font-medium">{item.label}</span>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-white/60">{item.weight}% wt</span>
                  <span className={`font-bold ${c.text}`}>{item.score}</span>
                  <span className="text-white/50">+{item.contribution}pts</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${c.bar}`} style={{ width: `${item.score}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-white/50 font-bold uppercase tracking-wider">Quality Score</span>
          <span className={`font-black text-sm tabular-nums ${totalScore >= 60 ? "text-[#00FF94]" : totalScore >= 45 ? "text-[#FFB800]" : "text-[#FF2E2E]"}`}>{totalScore}/100</span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${totalScore >= 60 ? "bg-[#00FF94]" : totalScore >= 45 ? "bg-[#FFB800]" : "bg-[#FF2E2E]"}`} style={{ width: `${totalScore}%` }} />
        </div>
        <div className="flex justify-between text-[9px] text-white/50 mt-1 uppercase tracking-wider">
          <span>Risk-Off</span>
          <span>60 — Deploy</span>
          <span>Strong</span>
        </div>
      </div>
    </div>
  );
};

export default ScoringWeights;
