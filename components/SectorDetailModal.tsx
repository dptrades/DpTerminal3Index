"use client";

import React, { useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, ArrowRight, Loader2 } from 'lucide-react';
import type { ConvictionStock } from '@/types/stock';
import ConvictionCard from './ConvictionCard';

interface SectorGroup {
    name: string;
    avgChange: number;
    stocks: ConvictionStock[];
    topPerformer?: ConvictionStock;
    worstPerformer?: ConvictionStock;
}

interface Props {
    sector: SectorGroup | null;
    onClose: () => void;
    onSelectStock: (symbol: string) => void;
}

// Skeleton card shown while conviction data is loading
function ConvictionCardSkeleton() {
    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3 animate-pulse">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <div className="h-7 w-20 bg-gray-700 rounded" />
                    <div className="h-3 w-24 bg-gray-700 rounded" />
                    <div className="h-8 w-28 bg-gray-700 rounded" />
                </div>
                <div className="h-14 w-14 bg-gray-700 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="space-y-1">
                        <div className="h-3 w-full bg-gray-700 rounded" />
                        <div className="h-1.5 w-full bg-gray-700 rounded" />
                    </div>
                ))}
            </div>
            <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-3 w-full bg-gray-700 rounded" />)}
            </div>
        </div>
    );
}

export default function SectorDetailModal({ sector, onClose, onSelectStock }: Props) {
    // Lazy-loaded full conviction data for this sector
    const [convictionStocks, setConvictionStocks] = useState<ConvictionStock[]>([]);
    const [loadingConviction, setLoadingConviction] = useState(false);
    const [convictionError, setConvictionError] = useState(false);

    // When a sector is opened, trigger background fetch of full conviction data
    useEffect(() => {
        if (!sector) return;

        setConvictionStocks([]);
        setConvictionError(false);
        setLoadingConviction(true);

        const sectorSymbols = new Set(sector.stocks.map(s => s.symbol));

        fetch('/api/conviction?all=true')
            .then(r => r.json())
            .then((all: ConvictionStock[]) => {
                // Filter to just this sector's stocks
                const filtered = all.filter(s => sectorSymbols.has(s.symbol));
                setConvictionStocks(filtered);
            })
            .catch(() => setConvictionError(true))
            .finally(() => setLoadingConviction(false));
    }, [sector?.name]); // re-fetch only when sector changes

    if (!sector) return null;

    // Slim stock list sorted by change (always available instantly)
    const gainers = [...sector.stocks]
        .filter(s => s.change24h > 0)
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 5);

    const losers = [...sector.stocks]
        .filter(s => s.change24h < 0)
        .sort((a, b) => a.change24h - b.change24h)
        .slice(0, 5);

    // Rich conviction stocks for the cards (top 5 gainers/losers by conviction score)
    const richGainers = convictionStocks
        .filter(s => s.change24h > 0)
        .sort((a, b) => b.change24h - a.change24h)
        .slice(0, 5);

    const richLosers = convictionStocks
        .filter(s => s.change24h < 0)
        .sort((a, b) => a.change24h - b.change24h)
        .slice(0, 5);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Content */}
            <div className="relative bg-gray-900 border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-10 p-6 border-b border-gray-800 bg-gray-900/95 backdrop-blur-md flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold text-white tracking-tight">{sector.name}</h2>
                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${sector.avgChange >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                {sector.avgChange > 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <p className="text-gray-300 text-sm font-medium border-r border-gray-700 pr-4">{sector.stocks.length} Assets Tracked</p>
                            {sector.topPerformer && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-gray-400 text-xs uppercase tracking-wider">Top:</span>
                                    <span className="font-bold text-white">{sector.topPerformer.symbol}</span>
                                    <span className="text-green-400 font-mono">+{sector.topPerformer.change24h.toFixed(2)}%</span>
                                </div>
                            )}
                            {sector.worstPerformer && (
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="text-gray-400 text-xs uppercase tracking-wider">Worst:</span>
                                    <span className="font-bold text-white">{sector.worstPerformer.symbol}</span>
                                    <span className="text-red-400 font-mono">{sector.worstPerformer.change24h.toFixed(2)}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-100 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-12 pb-12">
                    {/* Gainers Section — ConvictionCards (lazy) */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="bg-green-500/10 p-2 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Top Gainers</h3>
                            <span className="text-xs text-gray-200 bg-gray-800 px-2 py-0.5 rounded ml-2">Relative Strength</span>
                            {loadingConviction && (
                                <span className="flex items-center gap-1.5 text-xs text-gray-400 ml-2">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Loading full analysis…
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {loadingConviction ? (
                                gainers.slice(0, 3).map((s) => <ConvictionCardSkeleton key={s.symbol} />)
                            ) : richGainers.length > 0 ? (
                                richGainers.map(stock => (
                                    <ConvictionCard key={stock.symbol} stock={stock} onSelect={(s) => { onSelectStock(s); onClose(); }} />
                                ))
                            ) : gainers.length > 0 ? (
                                // Fallback: slim gain list if conviction filtered to 0
                                gainers.map(s => (
                                    <button key={s.symbol} onClick={() => { onSelectStock(s.symbol); onClose(); }}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gray-800 border border-gray-700 hover:border-green-500/40 transition-all text-left">
                                        <span className="font-bold text-white text-lg">{s.symbol}</span>
                                        <span className="text-green-400 font-mono font-bold">+{s.change24h.toFixed(2)}%</span>
                                    </button>
                                ))
                            ) : (
                                <div className="col-span-full py-12 text-center text-gray-100 border border-dashed border-gray-800 rounded-xl">
                                    No significant gainers found in this sector today.
                                </div>
                            )}
                            {convictionError && (
                                <div className="col-span-full text-xs text-amber-400/70 text-center">
                                    Full analysis unavailable — showing price data only.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Losers Section — ConvictionCards (lazy) */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <div className="bg-red-500/10 p-2 rounded-lg">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Top Losers</h3>
                            <span className="text-xs text-gray-200 bg-gray-800 px-2 py-0.5 rounded ml-2">Potential Value / Oversold</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {loadingConviction ? (
                                losers.slice(0, 3).map((s) => <ConvictionCardSkeleton key={s.symbol} />)
                            ) : richLosers.length > 0 ? (
                                richLosers.map(stock => (
                                    <ConvictionCard key={stock.symbol} stock={stock} onSelect={(s) => { onSelectStock(s); onClose(); }} />
                                ))
                            ) : losers.length > 0 ? (
                                losers.map(s => (
                                    <button key={s.symbol} onClick={() => { onSelectStock(s.symbol); onClose(); }}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gray-800 border border-gray-700 hover:border-red-500/40 transition-all text-left">
                                        <span className="font-bold text-white text-lg">{s.symbol}</span>
                                        <span className="text-red-400 font-mono font-bold">{s.change24h.toFixed(2)}%</span>
                                    </button>
                                ))
                            ) : (
                                <div className="col-span-full py-12 text-center text-gray-100 border border-dashed border-gray-800 rounded-xl">
                                    No significant losers found in this sector today.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* All Tickers — always available instantly from slim data */}
                    <div className="pt-6 border-t border-gray-800">
                        <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-xl font-bold text-white">All Tracked Assets</h3>
                            <span className="text-xs text-gray-400">({sector.stocks.length})</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {sector.stocks.sort((a, b) => a.symbol.localeCompare(b.symbol)).map(stock => (
                                <button
                                    key={`all-${stock.symbol}`}
                                    onClick={() => { onSelectStock(stock.symbol); onClose(); }}
                                    className="flex items-center justify-between p-3 rounded-xl bg-gray-900/50 border border-gray-700/50 hover:border-gray-500 hover:bg-gray-800 transition-all text-left"
                                >
                                    <span className="font-bold text-gray-200">{stock.symbol}</span>
                                    <span className={`text-xs font-mono font-medium ${stock.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stock.change24h > 0 ? '+' : ''}{stock.change24h.toFixed(2)}%
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-center">
                    <button onClick={onClose} className="text-gray-100 hover:text-white transition-colors flex items-center gap-2 font-medium">
                        Close Exploration <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
