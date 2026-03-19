"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

interface InfoPopoverProps {
  title: string;
  bullets: string[];
}

interface Position {
  top: number;
  left: number;
  transformOrigin: string;
}

const POPOVER_WIDTH = 288; // w-72
const POPOVER_ESTIMATED_HEIGHT = 320;

const InfoPopover: React.FC<InfoPopoverProps> = ({ title, bullets }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, transformOrigin: "top right" });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer opening to the right of button, flush right
    let left = rect.right - POPOVER_WIDTH;
    let top  = rect.bottom + 8;
    let transformOrigin = "top right";

    // Flip left if it would overflow the left edge
    if (left < 8) {
      left = rect.left;
      transformOrigin = "top left";
    }

    // Flip upward if it would overflow the bottom
    if (top + POPOVER_ESTIMATED_HEIGHT > vh - 8) {
      top = rect.top - POPOVER_ESTIMATED_HEIGHT - 8;
      transformOrigin = transformOrigin.replace("top", "bottom");
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, vw - POPOVER_WIDTH - 8));
    top  = Math.max(8, top);

    setPos({ top, left, transformOrigin });
  }, []);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    calcPosition();
    setOpen(v => !v);
  };

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  // Recalculate if window resizes while open
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", calcPosition);
    return () => window.removeEventListener("resize", calcPosition);
  }, [open, calcPosition]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1 rounded-md text-white/50 hover:text-white/80 hover:bg-white/5 transition-all shrink-0"
        aria-label={`Info: ${title}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: POPOVER_WIDTH,
            transformOrigin: pos.transformOrigin,
            zIndex: 9999,
          }}
          className="bg-[#0E1420] border border-white/10 rounded-xl shadow-2xl shadow-black/80 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
            <span className="text-xs font-bold text-white uppercase tracking-wider">{title}</span>
            <button
              onClick={() => setOpen(false)}
              className="p-0.5 hover:bg-white/10 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/70 hover:text-white" />
            </button>
          </div>

          {/* Bullets */}
          <ul className="flex flex-col gap-2.5 px-4 py-3 max-h-72 overflow-y-auto">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF94] mt-[5px] shrink-0" />
                <span className="text-[11px] text-white/60 leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </>
  );
};

export default InfoPopover;
