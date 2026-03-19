"use client";

import React from "react";
import InfoPopover from "./InfoPopover";

interface SectorData {
  name: string;
  change: number;
  trending?: boolean;
}

interface SectorPerformanceTerminalProps {
  sectors: SectorData[];
}

const INFO = [
  "Displays the daily % change for all 11 SPDR sector ETFs (XLE, XLK, XLF, etc.).",
  "Sectors are sorted from best to worst performers, updated with each refresh.",
  "Green bar = positive on the day; Red bar = negative — gives a quick breadth snapshot.",
  "▲ indicator means the sector is trading above its own 20-day moving average (sustained strength).",
  "When most sectors are positive AND trending above 20d, market participation is broad and healthy.",
  "A narrow advance (only 1-2 sectors positive) is a warning sign of a weak or speculative rally.",
];

const SectorPerformanceTerminal: React.FC<SectorPerformanceTerminalProps> = ({ sectors }) => {
  const maxAbsChange = Math.max(...sectors.map(s => Math.abs(s.change)), 0.01);

  return (
    <div className="bg-[#0B0F17]/40 border border-white/5 rounded-xl p-5 backdrop-blur-md flex flex-col gap-4 hover:border-white/10 transition-colors h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-white/60">Sector Performance</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/20 font-medium">▲ = Above 20d</span>
          <InfoPopover title="Sector Performance" bullets={INFO} />
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 justify-center">
        {sectors.map((sector, i) => (
          <div key={i} className="flex items-center gap-3 group/item">
            <div className="flex items-center gap-1 w-[90px] shrink-0">
              <span className="text-xs font-semibold text-white/50 truncate group-hover/item:text-white/70 transition-colors">
                {sector.name}
              </span>
              {sector.trending && <span className="text-[#00FF94] text-[9px] font-bold ml-auto">▲</span>}
            </div>
            <div className="flex-1 relative h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`absolute h-full transition-all duration-700 ease-out rounded-full ${sector.change >= 0 ? "bg-[#00FF94]" : "bg-[#FF2E2E]"}`}
                style={{ width: `${(Math.abs(sector.change) / maxAbsChange) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-bold tabular-nums w-14 text-right ${sector.change >= 0 ? "text-[#00FF94]" : "text-[#FF2E2E]"}`}>
              {sector.change >= 0 ? "+" : ""}{sector.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectorPerformanceTerminal;
