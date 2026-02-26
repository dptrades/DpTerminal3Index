"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, Activity, Zap, Clock, RefreshCw, Loader2, Newspaper, MessageCircle, BarChart2 } from 'lucide-react';
import { PreMarketMover } from '../lib/pre-market-engine';

export default function PreMarketMovers() {
    const [movers, setMovers] = useState<PreMarketMover[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchMovers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/pre-market');
            if (res.ok) {
                const data = await res.json();
                setMovers(data);
                setLastUpdated(new Date());
            }
        } catch (e) {
            console.error("Failed to fetch pre-market movers", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMovers();

        const interval = setInterval(() => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const timeInMinutes = hours * 60 + minutes;

            // 4:00 AM = 240 mins, 9:30 AM = 570 mins
            if (timeInMinutes >= 240 && timeInMinutes <= 570) {
                fetchMovers();
            }
        }, 10 * 60 * 1000); // 10 minutes

        return () => clearInterval(interval);
    }, []);

    if (loading && movers.length === 0) {
        return (
            <div className="bg-[#0d0d0d] border border-white/5 rounded-[2rem] p-8 flex flex-col items-center justify-center min-h-[200px]">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <Zap className="w-4 h-4 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <p className="text-gray-400 mt-4 text-sm font-medium animate-pulse">Scanning Pre-Market Catalysts...</p>
            </div>
        );
    }

    if (movers.length === 0) {
        return null; // Don't show if empty
    }

    return (
        <div className="bg-[#0d0d0d] border border-white/5 rounded-[2rem] p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                        <Zap className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-white">Pre-Market Catalysts</h2>
                        <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mt-0.5">Top Movers via Multi-Factor Scoring</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <div className="text-[10px] text-gray-400 font-mono hidden sm:block">
                            Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                    <button
                        onClick={fetchMovers}
                        disabled={loading}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50 text-gray-400 hover:text-white"
                        title="Refresh Catalysts"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {movers.map((mover) => (
                    <div key={mover.symbol} className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all group relative overflow-hidden">
                        {/* Glow indicator based on score */}
                        <div className={`absolute -inset-0.5 bg-gradient-to-b ${mover.catalystScore > 85 ? 'from-yellow-500/20' : mover.catalystScore > 70 ? 'from-blue-500/20' : 'from-gray-500/10'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                        <div className="relative z-10 flex justify-between items-start mb-4">
                            <div>
                                <Link href={`/?symbol=${mover.symbol}`} className="hover:text-blue-400 transition-colors">
                                    <span className="text-2xl font-black">{mover.symbol}</span>
                                </Link>
                                <div className="text-xs text-gray-400 font-medium truncate max-w-[120px]" title={mover.name}>
                                    {mover.name || 'Company'}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-0.5">Score</div>
                                <div className={`text-xl font-black ${mover.catalystScore > 85 ? 'text-yellow-400' : mover.catalystScore > 70 ? 'text-blue-400' : 'text-gray-300'}`}>
                                    {mover.catalystScore}
                                </div>
                            </div>
                        </div>

                        {/* Factors Breakdown */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {mover.factors.volume && (
                                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1" title="Unusual Volume Detected">
                                    <BarChart2 className="w-3 h-3" /> VOL
                                </span>
                            )}
                            {mover.factors.price && (
                                <span className="px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1" title="Significant Price Gap">
                                    <TrendingUp className="w-3 h-3" /> GAP
                                </span>
                            )}
                            {mover.factors.news && (
                                <span className="px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1" title="Breaking News Catalyst">
                                    <Newspaper className="w-3 h-3" /> NEWS
                                </span>
                            )}
                            {mover.factors.social && (
                                <span className="px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1" title="Social Media Buzz">
                                    <MessageCircle className="w-3 h-3" /> BUZZ
                                </span>
                            )}
                        </div>

                        {/* Raw Signals snippet (useful context) */}
                        <div className="text-[10px] text-gray-400 leading-relaxed font-mono line-clamp-2" title={mover.signal}>
                            {mover.signal.replace(/ \| /g, ' • ')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

