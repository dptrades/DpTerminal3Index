"use client";

import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import InfoPopover from "./InfoPopover";

interface ChecklistItem {
  label: string;
  met: boolean;
}

interface ConditionsChecklistProps {
  checklist: ChecklistItem[];
}

const INFO = [
  "A binary readiness scan — all 8 conditions should ideally be TRUE before entering new positions.",
  "Price > Daily EMA50: The most reliable single indicator of an active uptrend on the daily chart.",
  "Price > Weekly EMA50: Confirms the secular bull market structure is intact on a longer timeframe.",
  "VIX < 20: Low fear environment — institutional buyers are active and risk appetite is healthy.",
  "RSI 40-70: Momentum is in a 'Goldilocks' zone — not overbought, not capitulating.",
  "Breadth > 60%: More than 6 of 11 sectors are up on the day — rally has broad participation.",
  "MACD Bullish: Short-term momentum is accelerating upward — confirms the trend direction.",
  "Price > D-EMA200: The long-term bull/bear dividing line — broken = potential bear market.",
  "Rel Volume > 1x: Today's trading volume exceeds the 20-day average — institutional activity is elevated.",
];

const ConditionsChecklist: React.FC<ConditionsChecklistProps> = ({ checklist }) => {
  const metCount = checklist.filter(c => c.met).length;
  const pct = Math.round((metCount / checklist.length) * 100);

  return (
    <div className="bg-[#0B0F17]/40 border border-white/5 rounded-xl p-5 backdrop-blur-md flex flex-col gap-4 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-white/60">Conditions Met</h3>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${pct >= 70 ? "text-[#00FF94]" : pct >= 50 ? "text-[#FFB800]" : "text-[#FF2E2E]"}`}>
            {metCount}/{checklist.length}
          </span>
          <InfoPopover title="Conditions Checklist" bullets={INFO} />
        </div>
      </div>

      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${pct >= 70 ? "bg-[#00FF94]" : pct >= 50 ? "bg-[#FFB800]" : "bg-[#FF2E2E]"}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-col gap-2.5">
        {checklist.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {item.met
              ? <CheckCircle2 className="w-4 h-4 text-[#00FF94] shrink-0" />
              : <XCircle className="w-4 h-4 text-[#FF2E2E]/50 shrink-0" />
            }
            <span className={`text-xs font-medium ${item.met ? "text-white/80" : "text-white/30 line-through"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConditionsChecklist;
