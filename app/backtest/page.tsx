"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Play, Loader2, TrendingUp, TrendingDown, BarChart3,
    Target, AlertTriangle, Clock, DollarSign, ArrowLeft,
    ChevronDown, ChevronUp, Activity
} from 'lucide-react';

interface BacktestTrade {
    symbol: string;
    qty: number;
    entryPrice: number;
    entryDate: string;
    exitPrice: number;
    exitDate: string;
    exitReason: string;
    pnl: number;
    pnlPercent: number;
    holdingDays: number;
    entryScore: number;
    sector: string;
    vixRegime?: string;
    earningsZone?: string;
}

interface DailyEquityPoint {
    date: string;
    equity: number;
    benchmarkValue: number;
    drawdownPct: number;
    positionCount: number;
}

interface BacktestMetrics {
    totalReturn: number;
    benchmarkReturn: number;
    excessReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownDate: string;
    winRate: number;
    totalTrades: number;
    avgWinner: number;
    avgLoser: number;
    profitFactor: number;
    avgHoldingDays: number;
    bestTrade: BacktestTrade | null;
    worstTrade: BacktestTrade | null;
    monthlyReturns: { month: string; return: number; benchReturn: number }[];
    sectorBreakdown: { sector: string; trades: number; pnl: number; winRate: number }[];
    vixRegimeBreakdown?: { regime: string; trades: number; pnl: number; winRate: number }[];
    earningsZoneBreakdown?: { zone: string; trades: number; pnl: number; winRate: number; blocked: number }[];
}

interface BacktestResult {
    id: string;
    config: any;
    metrics: BacktestMetrics;
    equityCurve: DailyEquityPoint[];
    trades: BacktestTrade[];
    startedAt: string;
    completedAt: string;
    status: string;
    error?: string;
    progress?: number;
}

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
    return (
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-xl font-bold ${positive === true ? 'text-green-400' : positive === false ? 'text-red-400' : 'text-white'}`}>
                {value}
            </div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );
}

function EquityCurveChart({ data }: { data: DailyEquityPoint[] }) {
    if (data.length === 0) return null;

    const width = 900;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const allValues = data.flatMap(d => [d.equity, d.benchmarkValue]);
    const minVal = Math.min(...allValues) * 0.98;
    const maxVal = Math.max(...allValues) * 1.02;

    const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
    const yScale = (v: number) => padding.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

    const equityPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.equity)}`).join(' ');
    const benchPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.benchmarkValue)}`).join(' ');

    const yTicks = 5;
    const yTickValues = Array.from({ length: yTicks }, (_, i) => minVal + (i / (yTicks - 1)) * (maxVal - minVal));

    // Show ~6 date labels
    const dateStep = Math.max(1, Math.floor(data.length / 6));
    const dateLabels = data.filter((_, i) => i % dateStep === 0 || i === data.length - 1);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 300 }}>
            {/* Grid */}
            {yTickValues.map((v, i) => (
                <g key={i}>
                    <line x1={padding.left} y1={yScale(v)} x2={width - padding.right} y2={yScale(v)}
                        stroke="#333" strokeDasharray="4" />
                    <text x={padding.left - 8} y={yScale(v) + 4} textAnchor="end" fill="#888" fontSize="10">
                        ${Math.round(v).toLocaleString()}
                    </text>
                </g>
            ))}
            {/* Date labels */}
            {dateLabels.map((d, i) => {
                const idx = data.indexOf(d);
                return (
                    <text key={i} x={xScale(idx)} y={height - 8} textAnchor="middle" fill="#888" fontSize="9">
                        {d.date.slice(5)}
                    </text>
                );
            })}
            {/* Benchmark line */}
            <path d={benchPath} fill="none" stroke="#555" strokeWidth="1.5" strokeDasharray="6" />
            {/* Equity line */}
            <path d={equityPath} fill="none" stroke="#22d3ee" strokeWidth="2" />
            {/* Legend */}
            <line x1={width - 180} y1={15} x2={width - 160} y2={15} stroke="#22d3ee" strokeWidth="2" />
            <text x={width - 155} y={19} fill="#22d3ee" fontSize="11">Strategy</text>
            <line x1={width - 90} y1={15} x2={width - 70} y2={15} stroke="#555" strokeWidth="1.5" strokeDasharray="6" />
            <text x={width - 65} y={19} fill="#888" fontSize="11">SPY</text>
        </svg>
    );
}

function DrawdownChart({ data }: { data: DailyEquityPoint[] }) {
    if (data.length === 0) return null;

    const width = 900;
    const height = 150;
    const padding = { top: 10, right: 20, bottom: 30, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxDD = Math.max(...data.map(d => d.drawdownPct), 1);
    const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
    const yScale = (v: number) => padding.top + (v / maxDD) * chartH;

    const areaPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.drawdownPct)}`).join(' ')
        + ` L${xScale(data.length - 1)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`;

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 150 }}>
            <line x1={padding.left} y1={yScale(0)} x2={width - padding.right} y2={yScale(0)} stroke="#333" />
            <path d={areaPath} fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="1" />
            <text x={padding.left - 8} y={yScale(maxDD) + 4} textAnchor="end" fill="#888" fontSize="10">
                -{maxDD.toFixed(1)}%
            </text>
            <text x={padding.left - 8} y={yScale(0) + 4} textAnchor="end" fill="#888" fontSize="10">0%</text>
        </svg>
    );
}

export default function BacktestPage() {
    const [result, setResult] = useState<BacktestResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfig, setShowConfig] = useState(false);
    const [showTrades, setShowTrades] = useState(false);
    const [tradeSort, setTradeSort] = useState<'date' | 'pnl'>('date');
    const [pastResults, setPastResults] = useState<BacktestResult[]>([]);

    // Config form state
    const [startDate, setStartDate] = useState('2024-01-01');
    const [endDate, setEndDate] = useState('2025-06-20');
    const [initialBalance, setInitialBalance] = useState(10000);
    const [maxPositions, setMaxPositions] = useState(6);
    const [convictionThreshold, setConvictionThreshold] = useState(60);
    const [stopAtr, setStopAtr] = useState(2.0);
    const [targetAtr, setTargetAtr] = useState(3.0);
    const [riskPerTrade, setRiskPerTrade] = useState(100);
    const [riskPercent, setRiskPercent] = useState(1.5);
    const [maxHoldingDays, setMaxHoldingDays] = useState(30);
    const [enableVixRegime, setEnableVixRegime] = useState(true);
    const [enableEarningsZones, setEnableEarningsZones] = useState(true);
    const [enableCashMode, setEnableCashMode] = useState(true);
    const [enableSymbolBlacklist, setEnableSymbolBlacklist] = useState(true);
    const [scanDaily, setScanDaily] = useState(true);

    useEffect(() => {
        fetch('/api/backtest/results')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setPastResults(data); })
            .catch(() => {});
    }, []);

    const runBacktest = useCallback(async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch('/api/backtest/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    initialBalance,
                    maxPositions,
                    convictionThreshold,
                    stopAtrMultiple: stopAtr,
                    target1AtrMultiple: targetAtr,
                    riskPerTrade,
                    riskPercent,
                    maxHoldingDays,
                    enableVixRegime,
                    enableEarningsZones,
                    enableCashMode,
                    enableSymbolBlacklist,
                    scanDaily,
                }),
            });
            const data = await res.json();
            if (data.error) {
                setError(data.error);
            } else {
                setResult(data);
                setPastResults(prev => [data, ...prev.filter(r => r.id !== data.id)]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to run backtest');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, initialBalance, maxPositions, convictionThreshold, stopAtr, targetAtr, riskPerTrade, riskPercent, maxHoldingDays, enableVixRegime, enableEarningsZones, enableCashMode, enableSymbolBlacklist, scanDaily]);

    const m = result?.metrics;
    const sortedTrades = result?.trades
        ? [...result.trades].sort((a, b) =>
            tradeSort === 'pnl' ? b.pnl - a.pnl : new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
        )
        : [];

    return (
        <div className="min-h-screen bg-[#0d0d1a] text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-[#111128]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-gray-500 hover:text-white transition">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <BarChart3 size={22} className="text-cyan-400" />
                                Backtest Engine
                            </h1>
                            <p className="text-xs text-gray-500 mt-0.5">
                                All Fixes: Cash Mode + Blacklist + 2.0x ATR + 30d Hold + Daily Scan + 1.5% Equity
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={runBacktest}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition text-sm"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                        {loading ? 'Running...' : 'Run Backtest'}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Config Panel */}
                <div className="bg-[#111128] border border-gray-800 rounded-lg">
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-400 hover:text-white transition"
                    >
                        <span>Configuration</span>
                        {showConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showConfig && (<>
                        <div className="px-5 pb-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Initial Balance ($)</label>
                                <input type="number" value={initialBalance} onChange={e => setInitialBalance(Number(e.target.value))}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Max Positions</label>
                                <input type="number" value={maxPositions} onChange={e => setMaxPositions(Number(e.target.value))}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Conviction Threshold</label>
                                <input type="number" value={convictionThreshold} onChange={e => setConvictionThreshold(Number(e.target.value))}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Stop (ATR Multiple)</label>
                                <input type="number" step="0.1" value={stopAtr} onChange={e => setStopAtr(Number(e.target.value))}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Target (ATR Multiple)</label>
                                <input type="number" step="0.1" value={targetAtr} onChange={e => setTargetAtr(Number(e.target.value))}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Risk Per Trade ($)</label>
                                <input type="number" value={riskPerTrade} onChange={e => setRiskPerTrade(Number(e.target.value))}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Risk % of Equity</label>
                                <input type="number" step="0.1" value={riskPercent} onChange={e => setRiskPercent(Number(e.target.value))}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Max Holding Days</label>
                                <input type="number" value={maxHoldingDays} onChange={e => setMaxHoldingDays(Number(e.target.value))}
                                    className="w-full bg-[#1a1a2e] border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                            </div>
                        </div>
                        <div className="px-5 pb-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-gray-800/50 pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={enableVixRegime} onChange={e => setEnableVixRegime(e.target.checked)}
                                    className="w-4 h-4 rounded bg-[#1a1a2e] border-gray-600 text-cyan-500 focus:ring-cyan-500" />
                                <span className="text-sm text-gray-300">VIX Regime Weights</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={enableEarningsZones} onChange={e => setEnableEarningsZones(e.target.checked)}
                                    className="w-4 h-4 rounded bg-[#1a1a2e] border-gray-600 text-cyan-500 focus:ring-cyan-500" />
                                <span className="text-sm text-gray-300">Earnings Zones</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={enableCashMode} onChange={e => setEnableCashMode(e.target.checked)}
                                    className="w-4 h-4 rounded bg-[#1a1a2e] border-gray-600 text-cyan-500 focus:ring-cyan-500" />
                                <span className="text-sm text-gray-300">Cash Mode (VIX&gt;30 + SPY&lt;200EMA)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={enableSymbolBlacklist} onChange={e => setEnableSymbolBlacklist(e.target.checked)}
                                    className="w-4 h-4 rounded bg-[#1a1a2e] border-gray-600 text-cyan-500 focus:ring-cyan-500" />
                                <span className="text-sm text-gray-300">Symbol Blacklist (&lt;25% WR)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={scanDaily} onChange={e => setScanDaily(e.target.checked)}
                                    className="w-4 h-4 rounded bg-[#1a1a2e] border-gray-600 text-cyan-500 focus:ring-cyan-500" />
                                <span className="text-sm text-gray-300">Daily Scan (vs Monday-only)</span>
                            </label>
                        </div>
                    </>)}
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 flex items-center gap-3">
                        <AlertTriangle size={18} className="text-red-400" />
                        <span className="text-red-300 text-sm">{error}</span>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="bg-[#111128] border border-gray-800 rounded-lg p-12 flex flex-col items-center gap-4">
                        <Loader2 size={40} className="text-cyan-400 animate-spin" />
                        <div className="text-gray-400 text-sm">
                            Running backtest — fetching historical data and scoring {50} symbols...
                        </div>
                        <div className="text-xs text-gray-600">This may take 2-5 minutes</div>
                    </div>
                )}

                {/* Results */}
                {m && result && (
                    <>
                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            <MetricCard
                                label="Total Return"
                                value={`${m.totalReturn >= 0 ? '+' : ''}${m.totalReturn.toFixed(2)}%`}
                                sub={`$${(result.config.initialBalance * (1 + m.totalReturn / 100)).toFixed(0)}`}
                                positive={m.totalReturn > 0}
                            />
                            <MetricCard
                                label={`${result.config.benchmark} Return`}
                                value={`${m.benchmarkReturn >= 0 ? '+' : ''}${m.benchmarkReturn.toFixed(2)}%`}
                                positive={m.benchmarkReturn > 0}
                            />
                            <MetricCard
                                label="Excess Return"
                                value={`${m.excessReturn >= 0 ? '+' : ''}${m.excessReturn.toFixed(2)}%`}
                                positive={m.excessReturn > 0}
                            />
                            <MetricCard
                                label="Sharpe Ratio"
                                value={m.sharpeRatio.toFixed(2)}
                                sub={m.sharpeRatio > 1.5 ? 'Excellent' : m.sharpeRatio > 1 ? 'Good' : m.sharpeRatio > 0.5 ? 'Fair' : 'Poor'}
                                positive={m.sharpeRatio > 1 ? true : m.sharpeRatio < 0 ? false : null}
                            />
                            <MetricCard
                                label="Max Drawdown"
                                value={`-${m.maxDrawdown.toFixed(2)}%`}
                                sub={m.maxDrawdownDate}
                                positive={false}
                            />
                            <MetricCard
                                label="Win Rate"
                                value={`${m.winRate.toFixed(1)}%`}
                                sub={`${m.totalTrades} trades`}
                                positive={m.winRate > 50 ? true : m.winRate < 40 ? false : null}
                            />
                        </div>

                        {/* Secondary Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard
                                label="Profit Factor"
                                value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)}
                                sub={m.profitFactor > 1.5 ? 'Strong' : m.profitFactor > 1 ? 'Marginal' : 'Losing'}
                                positive={m.profitFactor > 1.5 ? true : m.profitFactor < 1 ? false : null}
                            />
                            <MetricCard
                                label="Avg Winner"
                                value={`$${m.avgWinner.toFixed(2)}`}
                                positive={true}
                            />
                            <MetricCard
                                label="Avg Loser"
                                value={`$${m.avgLoser.toFixed(2)}`}
                                positive={false}
                            />
                            <MetricCard
                                label="Avg Holding"
                                value={`${m.avgHoldingDays.toFixed(1)} days`}
                            />
                        </div>

                        {/* Equity Curve */}
                        <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                                <TrendingUp size={16} className="text-cyan-400" />
                                Equity Curve vs Benchmark
                            </h3>
                            <EquityCurveChart data={result.equityCurve} />
                        </div>

                        {/* Drawdown Chart */}
                        <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                                <TrendingDown size={16} className="text-red-400" />
                                Drawdown
                            </h3>
                            <DrawdownChart data={result.equityCurve} />
                        </div>

                        {/* Monthly Returns */}
                        {m.monthlyReturns.length > 0 && (
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                                <h3 className="text-sm font-medium text-gray-400 mb-3">Monthly Returns</h3>
                                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                    {m.monthlyReturns.map(mr => (
                                        <div key={mr.month} className="text-center">
                                            <div className="text-xs text-gray-500 mb-1">{mr.month}</div>
                                            <div className={`text-sm font-mono font-bold ${mr.return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {mr.return >= 0 ? '+' : ''}{mr.return.toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                SPY: {mr.benchReturn >= 0 ? '+' : ''}{mr.benchReturn.toFixed(1)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Sector Breakdown */}
                        {m.sectorBreakdown.length > 0 && (
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                                <h3 className="text-sm font-medium text-gray-400 mb-3">Sector Performance</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-500 border-b border-gray-800">
                                                <th className="text-left py-2 px-3">Sector</th>
                                                <th className="text-right py-2 px-3">Trades</th>
                                                <th className="text-right py-2 px-3">PnL</th>
                                                <th className="text-right py-2 px-3">Win Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {m.sectorBreakdown.map(s => (
                                                <tr key={s.sector} className="border-b border-gray-800/50">
                                                    <td className="py-2 px-3 text-gray-300">{s.sector}</td>
                                                    <td className="py-2 px-3 text-right text-gray-400">{s.trades}</td>
                                                    <td className={`py-2 px-3 text-right font-mono ${s.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        ${s.pnl.toFixed(2)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-gray-400">{s.winRate.toFixed(0)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* VIX Regime Breakdown */}
                        {m.vixRegimeBreakdown && m.vixRegimeBreakdown.length > 0 && (
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                                    <Activity size={16} className="text-yellow-400" />
                                    VIX Regime Performance
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-500 border-b border-gray-800">
                                                <th className="text-left py-2 px-3">Regime</th>
                                                <th className="text-right py-2 px-3">Trades</th>
                                                <th className="text-right py-2 px-3">PnL</th>
                                                <th className="text-right py-2 px-3">Win Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {m.vixRegimeBreakdown.map(r => (
                                                <tr key={r.regime} className="border-b border-gray-800/50">
                                                    <td className="py-2 px-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                            r.regime === 'Low Vol' ? 'bg-green-900/40 text-green-400' :
                                                            r.regime === 'Normal' ? 'bg-blue-900/40 text-blue-400' :
                                                            r.regime === 'High Vol' ? 'bg-yellow-900/40 text-yellow-400' :
                                                            r.regime === 'Crisis' ? 'bg-red-900/40 text-red-400' :
                                                            'bg-gray-800 text-gray-400'
                                                        }`}>
                                                            {r.regime}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-gray-400">{r.trades}</td>
                                                    <td className={`py-2 px-3 text-right font-mono ${r.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        ${r.pnl.toFixed(2)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-gray-400">{r.winRate.toFixed(0)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Earnings Zone Breakdown */}
                        {m.earningsZoneBreakdown && m.earningsZoneBreakdown.length > 0 && (
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                                    <Clock size={16} className="text-purple-400" />
                                    Earnings Zone Performance
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-500 border-b border-gray-800">
                                                <th className="text-left py-2 px-3">Zone</th>
                                                <th className="text-right py-2 px-3">Trades</th>
                                                <th className="text-right py-2 px-3">PnL</th>
                                                <th className="text-right py-2 px-3">Win Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {m.earningsZoneBreakdown.map(z => (
                                                <tr key={z.zone} className="border-b border-gray-800/50">
                                                    <td className="py-2 px-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                            z.zone === 'green' ? 'bg-green-900/40 text-green-400' :
                                                            z.zone === 'yellow' ? 'bg-yellow-900/40 text-yellow-400' :
                                                            z.zone === 'red' ? 'bg-red-900/40 text-red-400' :
                                                            z.zone === 'drift' ? 'bg-purple-900/40 text-purple-400' :
                                                            'bg-gray-800 text-gray-400'
                                                        }`}>
                                                            {z.zone === 'green' ? 'Green (>14d)' :
                                                             z.zone === 'yellow' ? 'Yellow (7-14d)' :
                                                             z.zone === 'red' ? 'Red (0-7d)' :
                                                             z.zone === 'drift' ? 'Post-Earnings Drift' :
                                                             z.zone}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-gray-400">{z.trades}</td>
                                                    <td className={`py-2 px-3 text-right font-mono ${z.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        ${z.pnl.toFixed(2)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-gray-400">{z.winRate.toFixed(0)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Best / Worst Trade */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {m.bestTrade && (
                                <div className="bg-[#111128] border border-green-900/50 rounded-lg p-4">
                                    <div className="text-xs text-green-600 uppercase tracking-wider mb-2">Best Trade</div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-green-400">{m.bestTrade.symbol}</span>
                                        <span className="text-green-400 font-mono">+${m.bestTrade.pnl.toFixed(2)} ({m.bestTrade.pnlPercent.toFixed(1)}%)</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {m.bestTrade.entryDate} → {m.bestTrade.exitDate} | {m.bestTrade.holdingDays}d | {m.bestTrade.exitReason}
                                    </div>
                                </div>
                            )}
                            {m.worstTrade && (
                                <div className="bg-[#111128] border border-red-900/50 rounded-lg p-4">
                                    <div className="text-xs text-red-600 uppercase tracking-wider mb-2">Worst Trade</div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-red-400">{m.worstTrade.symbol}</span>
                                        <span className="text-red-400 font-mono">${m.worstTrade.pnl.toFixed(2)} ({m.worstTrade.pnlPercent.toFixed(1)}%)</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {m.worstTrade.entryDate} → {m.worstTrade.exitDate} | {m.worstTrade.holdingDays}d | {m.worstTrade.exitReason}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Trade Log */}
                        <div className="bg-[#111128] border border-gray-800 rounded-lg">
                            <button
                                onClick={() => setShowTrades(!showTrades)}
                                className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-400 hover:text-white transition"
                            >
                                <span>Trade Log ({result.trades.length} trades)</span>
                                {showTrades ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {showTrades && (
                                <div className="px-5 pb-5">
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            onClick={() => setTradeSort('date')}
                                            className={`px-3 py-1 rounded text-xs ${tradeSort === 'date' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                        >
                                            By Date
                                        </button>
                                        <button
                                            onClick={() => setTradeSort('pnl')}
                                            className={`px-3 py-1 rounded text-xs ${tradeSort === 'pnl' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                                        >
                                            By PnL
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="sticky top-0 bg-[#111128]">
                                                <tr className="text-gray-500 border-b border-gray-800">
                                                    <th className="text-left py-2 px-2">Symbol</th>
                                                    <th className="text-left py-2 px-2">Sector</th>
                                                    <th className="text-right py-2 px-2">Score</th>
                                                    <th className="text-right py-2 px-2">Qty</th>
                                                    <th className="text-right py-2 px-2">Entry</th>
                                                    <th className="text-right py-2 px-2">Exit</th>
                                                    <th className="text-left py-2 px-2">Entry Date</th>
                                                    <th className="text-left py-2 px-2">Exit Date</th>
                                                    <th className="text-right py-2 px-2">Days</th>
                                                    <th className="text-left py-2 px-2">Reason</th>
                                                    <th className="text-left py-2 px-2">VIX</th>
                                                    <th className="text-left py-2 px-2">Earnings</th>
                                                    <th className="text-right py-2 px-2">PnL</th>
                                                    <th className="text-right py-2 px-2">PnL %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedTrades.map((t, i) => (
                                                    <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                                                        <td className="py-1.5 px-2 font-medium text-white">{t.symbol}</td>
                                                        <td className="py-1.5 px-2 text-gray-500">{t.sector}</td>
                                                        <td className="py-1.5 px-2 text-right text-cyan-400">{t.entryScore}</td>
                                                        <td className="py-1.5 px-2 text-right text-gray-400">{t.qty}</td>
                                                        <td className="py-1.5 px-2 text-right text-gray-300 font-mono">${t.entryPrice.toFixed(2)}</td>
                                                        <td className="py-1.5 px-2 text-right text-gray-300 font-mono">${t.exitPrice.toFixed(2)}</td>
                                                        <td className="py-1.5 px-2 text-gray-500">{t.entryDate}</td>
                                                        <td className="py-1.5 px-2 text-gray-500">{t.exitDate}</td>
                                                        <td className="py-1.5 px-2 text-right text-gray-400">{t.holdingDays}</td>
                                                        <td className="py-1.5 px-2">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                                t.exitReason === 'target' ? 'bg-green-900/40 text-green-400' :
                                                                t.exitReason === 'stop' ? 'bg-red-900/40 text-red-400' :
                                                                t.exitReason === 'time_exit' ? 'bg-yellow-900/40 text-yellow-400' :
                                                                'bg-gray-800 text-gray-400'
                                                            }`}>
                                                                {t.exitReason}
                                                            </span>
                                                        </td>
                                                        <td className="py-1.5 px-2">
                                                            {t.vixRegime && (
                                                                <span className={`px-1 py-0.5 rounded text-[10px] ${
                                                                    t.vixRegime === 'Low Vol' ? 'bg-green-900/30 text-green-500' :
                                                                    t.vixRegime === 'Normal' ? 'bg-blue-900/30 text-blue-400' :
                                                                    t.vixRegime === 'High Vol' ? 'bg-yellow-900/30 text-yellow-400' :
                                                                    'bg-red-900/30 text-red-400'
                                                                }`}>{t.vixRegime}</span>
                                                            )}
                                                        </td>
                                                        <td className="py-1.5 px-2">
                                                            {t.earningsZone && (
                                                                <span className={`px-1 py-0.5 rounded text-[10px] ${
                                                                    t.earningsZone === 'green' ? 'bg-green-900/30 text-green-500' :
                                                                    t.earningsZone === 'yellow' ? 'bg-yellow-900/30 text-yellow-400' :
                                                                    t.earningsZone === 'drift' ? 'bg-purple-900/30 text-purple-400' :
                                                                    'bg-gray-800 text-gray-400'
                                                                }`}>{t.earningsZone}</span>
                                                            )}
                                                        </td>
                                                        <td className={`py-1.5 px-2 text-right font-mono ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            ${t.pnl.toFixed(2)}
                                                        </td>
                                                        <td className={`py-1.5 px-2 text-right font-mono ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(1)}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Run Info */}
                        <div className="text-xs text-gray-600 text-center py-2">
                            Backtest ID: {result.id} | Started: {new Date(result.startedAt).toLocaleString()} |
                            Completed: {new Date(result.completedAt).toLocaleString()} |
                            Symbols: {result.config.symbols?.length || 50}
                        </div>
                    </>
                )}

                {/* Empty State */}
                {!loading && !result && !error && (
                    <div className="bg-[#111128] border border-gray-800 rounded-lg p-16 flex flex-col items-center gap-4 text-center">
                        <BarChart3 size={48} className="text-gray-700" />
                        <h2 className="text-lg font-medium text-gray-400">No Backtest Results Yet</h2>
                        <p className="text-sm text-gray-600 max-w-md">
                            Configure parameters above and click &quot;Run Backtest&quot; to replay your
                            conviction scoring against historical data. Includes all fixes: cash mode,
                            symbol blacklist, 2.0x ATR stops, 30-day time exit, daily scanning, and 1.5% equity sizing.
                        </p>
                        <button
                            onClick={() => { setShowConfig(true); }}
                            className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition"
                        >
                            Open Configuration
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
