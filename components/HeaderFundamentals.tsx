import React, { useEffect, useState } from 'react';
import { Shield, Activity, Target, Zap, Info, X } from 'lucide-react';

interface FundamentalData {
    marketCap: number;
    qualityScore: number;
    metrics: {
        epsGrowth: number;
        roe: number;
        peg: number;
        pe: number;
        de: number;
        fcf: number;
    };
    checks: {
        epsGrowth: boolean;
        roe: boolean;
        peg: boolean;
        pe: boolean;
        de: boolean;
        fcf: boolean;
    };
}

interface HeaderFundamentalsProps {
    symbol: string;
}

export default function HeaderFundamentals({ symbol }: HeaderFundamentalsProps) {
    const [data, setData] = useState<FundamentalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        let ignore = false;
        setShowDetails(false); // Reset on symbol change
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/fundamentals/${symbol}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const json = await res.json();
                if (!ignore) {
                    setData(json);
                }
            } catch (err) {
                console.error('Error fetching fundamentals:', err);
            } finally {
                if (!ignore) setLoading(false);
            }
        };

        fetchData();
        return () => { ignore = true; };
    }, [symbol]);

    if (loading) return <div className="h-10 w-48 bg-gray-800/50 rounded-xl animate-pulse" />;

    // Fallback if data is missing (common for ETFs in Finnhub Basic Metrics)
    if (!data || !data.marketCap) {
        return (
            <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-gray-900/60 border border-gray-800/50 opacity-60 grayscale cursor-help" title="Fundamentals only available for individual stocks.">
                <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-none">Market Cap</span>
                    <span className="text-sm font-black text-gray-500 leading-none">N/A</span>
                </div>
            </div>
        );
    }

    const formatMarketCap = (mc: number) => {
        if (mc >= 1000000) return `$${(mc / 1000000).toFixed(2)}T`;
        if (mc >= 1000) return `$${(mc / 1000).toFixed(2)}B`;
        return `$${mc.toFixed(2)}M`;
    };

    const getScoreColor = (score: number) => {
        if (score >= 5) return 'text-green-400';
        if (score >= 3) return 'text-yellow-400';
        return 'text-red-400';
    };

    const scoreTitle = data.qualityScore >= 5 ? "Elite" : data.qualityScore >= 3 ? "Strong" : "Weak";

    return (
        <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-gray-900/80 border border-gray-800 shadow-xl relative group">
            {/* Market Cap */}
            <div className="flex flex-col gap-1 pr-4 border-r border-gray-800">
                <span className="text-[8px] text-gray-200 font-bold uppercase tracking-widest leading-none">Market Cap</span>
                <span className="text-sm font-black text-white leading-none">
                    {formatMarketCap(data.marketCap)}
                </span>
            </div>

        </div>
    );
}

function MetricRow({ label, value, target, pass }: { label: string, value: string, target: string, pass: boolean }) {
    return (
        <div className="flex items-center justify-between text-[11px]">
            <div className="flex flex-col">
                <span className="text-gray-100 font-bold">{label}</span>
                <span className="text-[9px] text-gray-500">Target: {target}</span>
            </div>
            <div className="text-right">
                <div className={`font-mono font-bold ${pass ? 'text-green-400' : 'text-red-400'}`}>{value}</div>
                <div className={`text-[8px] font-black uppercase tracking-tighter ${pass ? 'text-green-500/60' : 'text-red-500/60'}`}>
                    {pass ? 'Pass' : 'Failed'}
                </div>
            </div>
        </div>
    );
}
