"use client";

import React from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import InfoPopover from "./InfoPopover";

interface AITerminalAssessmentProps {
  assessment: string;
  suggestedAction: string;
  riskLevel: "Low" | "Moderate" | "High" | "Extreme";
}

const INFO = [
  "AI-generated 2-sentence market assessment powered by Gemini 1.5 Flash.",
  "Analysis considers RSI Divergence (Bullish/Bearish), MACD, VIX, Breadth, and trend alignment.",
  "Assessment synthesizes the quantitative data into plain language — what the numbers collectively mean.",
  "Suggested Action is derived from the overall score, VIX level, and divergence signals.",
  "Risk Level: Low = VIX < 22 + trend intact. Moderate = mixed signals. High = breakdown. Extreme = crash risk.",
];

const getRiskColor = (level: string) => {
  switch (level) {
    case "Low":     return "text-[#00FF94]";
    case "Moderate":return "text-[#FFB800]";
    case "High":    return "text-[#FF2E2E]";
    case "Extreme": return "text-[#FF2E2E] animate-pulse";
    default:        return "text-white/70";
  }
};

const AITerminalAssessment: React.FC<AITerminalAssessmentProps> = ({ assessment, suggestedAction, riskLevel }) => (
  <div className="bg-[#0B0F17]/60 border border-white/5 rounded-xl p-5 backdrop-blur-xl flex flex-col gap-5 hover:border-white/10 transition-all group shadow-2xl">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
          <Sparkles className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
        </div>
        <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-white/60">Terminal Analysis</h3>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 uppercase tracking-widest font-bold">Risk:</span>
          <span className={`text-sm font-bold uppercase ${getRiskColor(riskLevel)}`}>{riskLevel}</span>
        </div>
        <InfoPopover title="Terminal Analysis" bullets={INFO} />
      </div>
    </div>

    <p className="text-sm leading-relaxed text-white/75 font-medium">{assessment}</p>

    <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-[#00FF94]" />
        <span className="text-[11px] uppercase tracking-widest font-bold text-white/70">Suggested Action</span>
      </div>
      <p className={`text-sm font-bold ${
        suggestedAction.toLowerCase().includes("avoid") ||
        suggestedAction.toLowerCase().includes("wait") ||
        suggestedAction.toLowerCase().includes("preserve")
          ? "text-[#FFB800]" : "text-[#00FF94]"
      }`}>{suggestedAction}</p>
    </div>
  </div>
);

export default AITerminalAssessment;
