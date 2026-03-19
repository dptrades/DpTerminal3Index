"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  title?: string;
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  errorMsg: string;
}

export class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[WidgetErrorBoundary] ${this.props.title || "Widget"} crashed:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#0B0F17]/40 border border-[#FF2E2E]/10 rounded-xl p-5 flex flex-col items-center justify-center gap-3 min-h-[100px]">
          <AlertCircle className="w-5 h-5 text-[#FF2E2E]/50" />
          <div className="text-center">
            <p className="text-xs font-bold text-white/60 uppercase tracking-wider">
              {this.props.title || "Widget"} Unavailable
            </p>
            <p className="text-[10px] text-white/50 mt-1">Data could not be loaded</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: "" })}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-white/70 hover:text-white/90 transition-all"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default WidgetErrorBoundary;
