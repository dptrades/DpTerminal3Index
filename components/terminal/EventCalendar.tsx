"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, AlertTriangle, Zap, BarChart3 } from "lucide-react";
import InfoPopover from "./InfoPopover";

interface CalendarEvent {
  date: string;
  label: string;
  type: string;
}

interface CalendarData {
  today: string;
  weekRisk: "Low" | "Moderate" | "High" | "Extreme";
  todayEvents: CalendarEvent[];
  weekEvents: CalendarEvent[];
}

const typeConfig: Record<string, { color: string; bg: string; border: string; icon: any; badge: string }> = {
  fomc:        { color: "text-[#FF2E2E]",  bg: "bg-[#FF2E2E]/10",  border: "border-[#FF2E2E]/20",  icon: AlertTriangle, badge: "FOMC" },
  macro:       { color: "text-[#FFB800]",  bg: "bg-[#FFB800]/10",  border: "border-[#FFB800]/20",  icon: BarChart3,     badge: "ECON" },
  opex:        { color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20", icon: Zap,           badge: "OPEX" },
  opex_weekly: { color: "text-white/40",   bg: "bg-white/5",       border: "border-white/10",      icon: Zap,           badge: "WKLY" },
};

const INFO = [
  "Tracks high-impact financial events that can cause outsized market moves.",
  "FOMC: Federal Reserve rate decisions (8/year) — markets often chop 3 days before the announcement.",
  "Monthly OPEX (3rd Friday): Options expiration can pin price near key strikes and spike volatility into the close.",
  "Triple Witching (Mar/Jun/Sep/Dec): Stocks, index options, and futures all expire — highest volume sessions of the quarter.",
  "CPI/PPI: Inflation reports that directly influence Fed rate expectations — large gap-risk events.",
  "NFP (Jobs Report): Non-Farm Payrolls on the first Friday of each month — moves both bonds and equities.",
  "Week Risk Rating summarizes the overall event risk — High or Extreme weeks call for reduced leverage.",
];

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const weekRiskConfig = {
  Low:      { color: "text-[#00FF94]", label: "Low Event Risk" },
  Moderate: { color: "text-[#FFB800]", label: "Moderate Event Risk" },
  High:     { color: "text-[#FF2E2E]", label: "High Event Risk" },
  Extreme:  { color: "text-[#FF2E2E]", label: "Extreme Event Risk" },
};

const EventCalendar: React.FC = () => {
  const [calData, setCalData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/calendar")
      .then(r => r.json())
      .then(d => { setCalData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const riskCfg = weekRiskConfig[calData?.weekRisk || "Low"];

  return (
    <div className="bg-[#0B0F17]/40 border border-white/5 rounded-xl p-5 backdrop-blur-md flex flex-col gap-4 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-white/40" />
          <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-white/60">Event Calendar</h3>
        </div>
        <div className="flex items-center gap-2">
          {calData && <span className={`text-xs font-bold ${riskCfg.color}`}>{riskCfg.label}</span>}
          <InfoPopover title="Event Calendar" bullets={INFO} />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-white/10 border-t-[#00FF94] rounded-full animate-spin" />
        </div>
      )}

      {calData && !loading && (
        <>
          {calData.todayEvents.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Today</span>
              {calData.todayEvents.map((ev, i) => {
                const cfg = typeConfig[ev.type] || typeConfig.macro;
                const Icon = cfg.icon;
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${cfg.border} ${cfg.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color} shrink-0`} />
                    <span className={`text-xs font-bold ${cfg.color} flex-1`}>{ev.label}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.border} ${cfg.color} uppercase`}>{cfg.badge}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg border border-white/5 bg-white/5">
              <span className="text-xs text-white/30">No major catalysts today</span>
            </div>
          )}

          {calData.weekEvents.filter(e => e.date !== calData.today && e.type !== "opex_weekly").length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">This Week</span>
              {calData.weekEvents
                .filter(e => e.date !== calData.today && e.type !== "opex_weekly")
                .slice(0, 6)
                .map((ev, i) => {
                  const cfg = typeConfig[ev.type] || typeConfig.macro;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] text-white/30 w-20 shrink-0">{formatDate(ev.date)}</span>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.color.replace("text-", "bg-")}`} />
                      <span className="text-xs text-white/60 font-medium">{ev.label}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventCalendar;
