"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, DollarSign, Calendar, ArrowRight, X, ChevronRight, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import type { ConvictionStock } from '@/types/stock';
import PicksCard from '@/components/PicksCard';
import ConvictionDetailModal from '@/components/ConvictionDetailModal';
import { REFRESH_INTERVALS, isMarketActive, getNextMarketOpen } from '../../lib/refresh-utils';
import { Activity, Loader2, Clock } from 'lucide-react';
import RefreshClock from '@/components/RefreshClock';

import { useRouter } from 'next/navigation';

export default function TopPicksPage() {
    const router = useRouter();
    const [picks, setPicks] = useState<ConvictionStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [showLogic, setShowLogic] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState(900); // 15m
    const [optionFilter, setOptionFilter] = useState<'ALL' | 'CALL' | 'PUT'>('ALL');

    // Persistence: Load sidebar state on mount
    useEffect(() => {
        const saved = localStorage.getItem('sidebarExpanded');
        if (saved !== null) {
            setIsSidebarOpen(saved === 'true');
        }
    }, []);

    // Persistence: Save sidebar state on change
    useEffect(() => {
        localStorage.setItem('sidebarExpanded', isSidebarOpen.toString());
    }, [isSidebarOpen]);

    useEffect(() => {
        const runScan = async () => {
            // Check if we already have data (possibly from a quick navigation back)
            // If we don't, or it's been a while, we show the loader
            if (picks.length === 0) {
                setLoading(true);
            }

            try {
                // Remove ?refresh=true to respect the 15-minute server-side cache
                // This prevents redundant scanning on every click
                const res = await fetch('/api/conviction');
                if (res.ok) {
                    const results: ConvictionStock[] = await res.json();
                    setPicks(results);
                    setLastUpdated(new Date());
                }
            } catch (e) {
                console.error("Failed to fetch picks", e);
            }
            setLoading(false);
        };

        runScan();
        
        // Timer for the visual clock
        const tick = setInterval(() => {
            if (isMarketActive() && !document.hidden) {
                setCountdown(prev => {
                    if (prev <= 1) {
                        runScan();
                        return 900;
                    }
                    return prev - 1;
                });
            }
        }, 1000);

        return () => clearInterval(tick);
    }, []);

    const handleSelect = (symbol: string) => {
        // Navigate to dashboard with this symbol
        router.push(`/?symbol=${symbol}`);
    };

    const filteredPicks = picks.filter(pick => {
        if (optionFilter === 'ALL') return true;
        return pick.suggestedOption?.type === optionFilter;
    });

    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans overflow-hidden">
            {/* Sidebar with "picks" active */}
            <div className={`
                fixed inset-y-0 left-0 z-[110] transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarOpen ? 'w-[20vw] lg:w-[18vw] min-w-[200px]' : 'w-0'} 
                h-full overflow-hidden flex-shrink-0 border-r border-gray-800
            `}>
                <Sidebar
                    currentPage="picks"
                    symbol="PICK"
                    setSymbol={() => { }}
                    stockInput=""
                    setStockInput={() => { }}
                    isOpen={isSidebarOpen}
                    setIsOpen={setIsSidebarOpen}
                    interval="1d"
                    setInterval={() => { }}
                    data={[]}
                    loading={false}
                    stats={null}
                    sentimentScore={50}
                    onSectorClick={() => {
                        // If selecting a sector from here, we might want to close sidebar on mobile
                        if (window.innerWidth < 768) {
                            setIsSidebarOpen(false);
                        }
                    }}
                />
            </div>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Toggle Button for Sidebar when closed */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-[70] bg-blue-600/90 hover:bg-blue-500 p-2 pr-3 rounded-r-xl border-y border-r border-blue-400/50 text-white transition-all hover:pl-4 group shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-1 overflow-hidden"
                        title="Open Sidebar"
                    >
                        <ChevronRight className="w-6 h-6 animate-pulse" />
                    </button>
                )}

                <div className="flex-1 p-6 flex flex-col overflow-hidden transition-all duration-300">
                    <header className="mb-8 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-4">
                                <h2 className="text-3xl font-bold tracking-tight text-blue-400">Top Picks</h2>
                                <button
                                    onClick={() => setShowLogic(true)}
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium underline underline-offset-4 mt-2"
                                >
                                    (How did I do that?)
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                                    Source: Alpaca & Finnhub
                                </span>
                                {lastUpdated && (
                                    <span className="text-[10px] text-gray-300 font-mono">
                                        Last Scan: {lastUpdated.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-100 mt-2">
                                High Mega Cap picks from S&P 500 & Nasdaq 100 • AI-analyzed for Momentum, Trends & Technicals
                            </p>
                            
                            {/* Filter Buttons */}
                            <div className="flex items-center gap-2 mt-4">
                                <button 
                                    onClick={() => setOptionFilter('ALL')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${optionFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                >
                                    ALL
                                </button>
                                <button 
                                    onClick={() => setOptionFilter('CALL')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${optionFilter === 'CALL' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                >
                                    CALLS
                                </button>
                                <button 
                                    onClick={() => setOptionFilter('PUT')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${optionFilter === 'PUT' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                >
                                    PUTS
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <RefreshClock countdown={countdown} total={900} label="Next Scan" size="sm" color="#3B82F6" />
                            {isMarketActive() ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-400 font-bold uppercase tracking-wider animate-pulse">
                                    <Activity className="w-3 h-3" />
                                    Live Matrix Active
                                </div>
                            ) : (
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border border-gray-700/50 rounded-lg text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                        Market Closed • Displaying Last Analysis
                                    </div>
                                    <div className="text-[9px] text-gray-400 font-mono">
                                        Scan restarts at: {getNextMarketOpen().toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto pr-2">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64">
                                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                <span className="text-lg text-gray-200 animate-pulse">Scanning the Market...</span>
                                <span className="text-xs text-gray-200 mt-2">Analyzing High Mega Cap S&P 500 & Nasdaq 100 Stocks</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                                {filteredPicks.map((pick, index) => (
                                    <PicksCard
                                        key={pick.symbol}
                                        pick={pick}
                                        index={index}
                                        onSelect={(s) => handleSelect(s)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Top Picks Logic Modal */}
                    {showLogic && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowLogic(false)} />
                            <div className="relative z-50 bg-gray-900 border border-gray-700/50 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-1 bg-gradient-to-r from-blue-500 to-purple-500" />
                                <div className="p-6 md:p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">Top Picks Logic</h2>
                                            <p className="text-gray-200 text-sm">How we identify high-conviction mega-caps</p>
                                        </div>
                                        <button
                                            onClick={() => setShowLogic(false)}
                                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-200 transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <p className="text-gray-100 text-[15px] font-medium leading-relaxed mb-6">
                                            Unlike Alpha Hunter which scans the broader market, **Top Picks** is hyper-focused on the most liquid, institutional-grade companies in the S&P 500 and Nasdaq 100.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                                    <span className="font-bold text-blue-400 text-sm">Technical Momentum (30%)</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Prioritizes stocks trading above key psychological levels (50/200 EMAs) with positive MACD divergence and RSI between 40-70.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                                                    <span className="font-bold text-purple-400 text-sm">Fundamentals & Value (25%)</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Cross-references Revenue Growth against P/E ratios and profit margins to identify "GARP" (Growth at a Reasonable Price) setups.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                                    <span className="font-bold text-emerald-400 text-sm">Analyst Consensus (25%)</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    Wall Street analyst ratings, buy recommendations, and &gt;10% upside potential to the mean price target.
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                                                    <span className="font-bold text-yellow-400 text-sm">News Sentiment (20%)</span>
                                                </div>
                                                <p className="text-sm text-gray-100 leading-relaxed">
                                                    NLP scan of recent news headlines (Yahoo Finance + Finnhub bias correction). This is news-driven sentiment, not live data from X, WSB, or StockTwits — see Social Pulse for real Reddit/Twitter mention tracking on individual names.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={() => setShowLogic(false)}
                                            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl border border-gray-700 transition-all font-bold text-sm"
                                        >
                                            I Understand
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
