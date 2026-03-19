"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import InfoPopover from "./InfoPopover";

interface SubMetric {
  label: string;
  value: string | number;
  status?: "positive" | "negative" | "neutral" | "warning";
  statusLabel?: string;
}

interface MetricCardProps {
  title: string;
  value: number;
  icon?: LucideIcon;
  subMetrics: SubMetric[];
  status?: string;
  statusType?: "positive" | "negative" | "neutral" | "warning";
  info?: string[];
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, icon: Icon, subMetrics, status, statusType = "neutral", info
}) => {
  const getStatusColor = (type?: string) => {
    switch (type) {
      case "positive": return "text-[#00FF94]";
      case "negative": return "text-[#FF2E2E]";
      case "warning":  return "text-[#FFB800]";
      default:         return "text-white/70";
    }
  };

  return (
    <div className="bg-[#0B0F17]/40 border border-white/5 rounded-xl p-5 backdrop-blur-md flex flex-col gap-4 hover:border-white/10 transition-colors group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-4 h-4 text-white/70 group-hover:text-white transition-colors" />}
          <h3 className="text-xs uppercase tracking-[0.15em] font-bold text-white/60">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <span className={`text-xs font-bold uppercase ${getStatusColor(statusType)}`}>{status}</span>
          )}
          <span className="text-3xl font-bold text-white tabular-nums">{value}</span>
          {info && <InfoPopover title={title} bullets={info} />}
        </div>
      </div>

      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-out rounded-full ${
            statusType === "positive" ? "bg-[#00FF94]" :
            statusType === "negative" ? "bg-[#FF2E2E]" :
            statusType === "warning"  ? "bg-[#FFB800]" : "bg-white/20"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>

      <div className="flex flex-col gap-2">
        {subMetrics.map((metric, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-white/50 font-medium truncate pr-2">{metric.label}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`font-bold tabular-nums ${getStatusColor(metric.status)}`}>{metric.value}</span>
              {metric.statusLabel && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  metric.status === "positive" ? "text-[#00FF94] bg-[#00FF94]/10" :
                  metric.status === "negative" ? "text-[#FF2E2E] bg-[#FF2E2E]/10" :
                  metric.status === "warning"  ? "text-[#FFB800] bg-[#FFB800]/10" : "text-white/70 bg-white/5"
                }`}>{metric.statusLabel}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetricCard;
