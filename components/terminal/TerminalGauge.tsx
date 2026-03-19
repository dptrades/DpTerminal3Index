"use client";

import React from "react";

interface TerminalGaugeProps {
  score: number;
  label?: string;
  threshold?: number;
}

const TerminalGauge: React.FC<TerminalGaugeProps> = ({ score, label = "Swing Trading", threshold = 60 }) => {
  const isPositive = score >= threshold;
  const strokeColor = isPositive ? "#00FF94" : "#FF2E2E";
  const percentage = Math.min(Math.max(score, 0), 100);
  
  // SVG Arc calculations
  const radius = 80;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-[#0B0F17]/50 border border-white/5 rounded-2xl backdrop-blur-sm">
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* Background Circle */}
        <svg className="absolute w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r={normalizedRadius}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Circle */}
          <circle
            cx="96"
            cy="96"
            r={normalizedRadius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            style={{ 
              strokeDashoffset,
              transition: "stroke-dashoffset 1s ease-in-out, stroke 0.5s ease"
            }}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        
        {/* Score Display */}
        <div className="flex flex-col items-center justify-center z-10">
          <span className="text-5xl font-bold tracking-tight text-white mb-1">
            {score}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-white/40 font-medium">
            / 100
          </span>
        </div>
        
        {/* Glow Effect */}
        <div 
          className="absolute inset-0 rounded-full blur-2xl opacity-20 pointer-events-none"
          style={{ backgroundColor: strokeColor }}
        />
      </div>

      {/* Decision Badge */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <div className={`px-6 py-1.5 rounded-md text-sm font-bold uppercase tracking-widest ${
          isPositive 
            ? "bg-[#00FF94]/10 text-[#00FF94] border border-[#00FF94]/30" 
            : "bg-[#FF2E2E]/10 text-[#FF2E2E] border border-[#FF2E2E]/30"
        }`}>
          {isPositive ? "YES" : "NO"}
        </div>
        <span className="text-[11px] text-white/50 font-medium tracking-wide">
          {label}
        </span>
      </div>
    </div>
  );
};

export default TerminalGauge;
