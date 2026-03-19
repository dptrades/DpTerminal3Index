"use client";

import React from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import InfoPopover from "./InfoPopover";

interface SignalItem {
  question: string;
  answer: string;
  status: "positive" | "negative" | "warning";
  detail: string;
}

interface SignalReadinessProps {
  signals: SignalItem[];
  score: number;
}

const INFO = [
  "4 binary checks that evaluate whether market conditions support entering new trades right now.",
  "Momentum Confirming: MACD is bullish AND RSI > 50 — internal buying pressure supports the trend.",
  "Structure Intact: Price is above both the daily 50 EMA and 200 EMA — the trend channel is unbroken.",
  "Dip Demand Active: Market breadth > 50% AND relative volume confirms buyers are stepping in on dips.",
  "Sector Rotation Healthy: Most sectors trend above their 20-day average — participation is broad, not narrow.",
  "3-4 confirmed = strong execution window. 0-1 confirmed = wait for a better setup.",
];

const SignalReadiness: React.FC<SignalReadinessProps> = ({ signals, score }) => {
  const passed = signals.filter(s => s.status === "positive").length;

  const getIcon = (status: string) => {
    if (status === "positive") return <CheckCircle2 className="w-4 h-4 text-[#00FF94] shrink-0" />;
    if (status === "warning")  return <AlertCircle className="w-4 h-4 text-[#FFB800] shrink-0" />;
    return <XCircle className="w-4 h-4 text-[#FF2E2E]/60 shrink-0" />;
  };

  const getValueColor = (status: string) => {
    if (status === "positive") return "text-[#00FF94]";
    if (status === "warning")  return "text-[#FFB800]";
    return "text-[#FF2E2E]";
  };

  return (
    <div className="bg-[#0B0F17]/40 border border-white/5 rounded-xl p-5 backdrop-blur-md flex flex-col gap-4 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-white/60">Signal Readiness</h3>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${passed >= 3 ? "text-[#00FF94]" : passed >= 2 ? "text-[#FFB800]" : "text-[#FF2E2E]"}`}>
            {passed}/{signals.length} Confirmed
          </span>
          <InfoPopover title="Signal Readiness" bullets={INFO} />
        </div>
      </div>

      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${passed >= 3 ? "bg-[#00FF94]" : passed >= 2 ? "bg-[#FFB800]" : "bg-[#FF2E2E]"}`}
          style={{ width: `${(passed / signals.length) * 100}%` }} />
      </div>

      <div className="flex flex-col gap-3">
        {signals.map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            {getIcon(s.status)}
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white/70 truncate">{s.question}</span>
                <span className={`text-xs font-bold shrink-0 ${getValueColor(s.status)}`}>{s.answer}</span>
              </div>
              <span className="text-[10px] text-white/30 truncate">{s.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SignalReadiness;
