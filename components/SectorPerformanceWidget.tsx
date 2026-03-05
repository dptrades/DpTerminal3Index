"use client";

import React, { useEffect, useState } from 'react';
import { LayoutGrid, TrendingUp, TrendingDown } from 'lucide-react';
import type { ConvictionStock } from '@/types/stock';

interface SlimStock {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    volume: number;
    sector: string;
}

// Minimal ConvictionStock shape for sector grouping — rich data lazy-loaded in modal
function toSlimConvictionStock(s: SlimStock): ConvictionStock {
    return {
        symbol: s.symbol,
        name: s.name,
        price: s.price,
        change24h: s.change24h,
        volume: s.volume,
        sector: s.sector,
        score: 0,
        technicalScore: 0,
        fundamentalScore: 0,
        analystScore: 0,
        sentimentScore: 0,
        metrics: {
            rsi: 0,
            trend: 'NEUTRAL',
            socialSentiment: '',
        },
        reasons: [],
    };
}

interface SectorGroup {
    name: string;
    avgChange: number;
    stocks: ConvictionStock[];
    topPerformer?: ConvictionStock;
    worstPerformer?: ConvictionStock;
}

interface Props {
    onSectorClick: (sector: SectorGroup) => void;
}

export default function SectorPerformanceWidget({ onSectorClick }: Props) {
    const [sectors, setSectors] = useState<SectorGroup[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSectors = async () => {
            setLoading(true);
            try {
                // ✅ Fast endpoint: batch quote + sector map only (~1-3s vs 30-120s)
                const res = await fetch('/api/sectors');
                if (!res.ok) throw new Error('API Error');
                const allStocks: SlimStock[] = await res.json();

                // Group by sector
                const groups: Record<string, ConvictionStock[]> = {};
                allStocks.forEach(stock => {
                    const sector = stock.sector || 'Other';
                    if (!groups[sector]) groups[sector] = [];
                    groups[sector].push(toSlimConvictionStock(stock));
                });

                // Calculate performance and format
                const sectorList = Object.keys(groups).map(name => {
                    const stocks = groups[name];
                    const avgChange = stocks.reduce((acc, s) => acc + s.change24h, 0) / stocks.length;

                    let topPerformer = stocks[0];
                    let worstPerformer = stocks[0];
                    stocks.forEach(s => {
                        if (s.change24h > topPerformer.change24h) topPerformer = s;
                        if (s.change24h < worstPerformer.change24h) worstPerformer = s;
                    });

                    return { name, avgChange, stocks, topPerformer, worstPerformer };
                });

                setSectors(sectorList.sort((a, b) => b.avgChange - a.avgChange));
            } catch (e) {
                console.error('Failed to fetch sector data', e);
            } finally {
                setLoading(false);
            }
        };

        fetchSectors();
    }, []);

    if (loading) {
        return (
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 mb-6 backdrop-blur-sm animate-pulse">
                <div className="flex items-center space-x-2 mb-4">
                    <div className="w-5 h-5 bg-gray-700 rounded" />
                    <div className="w-48 h-5 bg-gray-700 rounded" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-16 bg-gray-900/40 rounded-lg border border-gray-700/30" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5 mb-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wider flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-purple-400" /> Sector Performance
                </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {sectors.map((sector) => (
                    <button
                        key={sector.name}
                        onClick={() => onSectorClick(sector)}
                        className="flex flex-col p-3 rounded-lg bg-gray-900/50 border border-gray-700/50 hover:border-gray-500 hover:bg-gray-800 transition-all text-left group gap-1 outline-none w-full"
                    >
                        <div className="flex w-full justify-between items-center mb-1">
                            <span className="text-[10px] text-gray-200 font-bold uppercase tracking-tight group-hover:text-white truncate pr-2">
                                {sector.name}
                            </span>
                            <div className={`text-xs font-mono font-bold ${sector.avgChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {sector.avgChange > 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
                            </div>
                        </div>

                        {sector.topPerformer && (
                            <div className="flex w-full justify-between items-center text-[10px] bg-green-900/20 px-1.5 py-0.5 rounded border border-green-900/30">
                                <span className="text-gray-300">Top <span className="text-white font-bold ml-1">{sector.topPerformer.symbol}</span></span>
                                <span className="text-green-400 font-mono">+{sector.topPerformer.change24h.toFixed(2)}%</span>
                            </div>
                        )}
                        {sector.worstPerformer && (
                            <div className="flex w-full justify-between items-center text-[10px] bg-red-900/20 px-1.5 py-0.5 rounded border border-red-900/30">
                                <span className="text-gray-300">Worst <span className="text-white font-bold ml-1">{sector.worstPerformer.symbol}</span></span>
                                <span className="text-red-400 font-mono">{sector.worstPerformer.change24h.toFixed(2)}%</span>
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
