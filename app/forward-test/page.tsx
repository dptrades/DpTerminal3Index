"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Play, Loader2, TrendingUp, TrendingDown, BarChart3,
    AlertTriangle, Clock, ArrowLeft, ChevronDown, ChevronUp,
    Activity, RefreshCw, Trash2, Eye, Zap, Shield, Ban
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

interface FTPosition {
    symbol: string; qty: number; entryPrice: number; entryDate: string;
    stopLoss: number; takeProfit: number; sector: string;
    entryScore: number; entryReasons: string[]; source: string;
}

interface FTTrade {
    symbol: string; qty: number; entryPrice: number; entryDate: string;
    exitPrice: number; exitDate: string; exitReason: string;
    pnl: number; pnlPercent: number; holdingDays: number;
    entryScore: number; sector: string; source: string;
}

interface FTSignal {
    date: string; symbol: string; score: number; techScore: number;
    trend: string; reasons: string[]; action: string;
    price: number; source: string;
}

interface FTDailyLog {
    date: string; equity: number; cash: number; positionsValue: number;
    positionCount: number; cashMode: boolean; signalsGenerated: number;
    entriesExecuted: number; exitsExecuted: number;
    symbolsScanned: number; topPicksCount: number; alphaHunterCount: number;
}

interface FTState {
    config: any; startDate: string;
    account: { cash: number; equity: number; initialBalance: number };
    positions: FTPosition[]; trades: FTTrade[];
    signals: FTSignal[]; dailyLog: FTDailyLog[];
    blacklist: Record<string, { results: boolean[]; suspendedUntil: string | null }>;
    lastRunDate: string; totalRuns: number;
}

// ── Components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
    return (
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-xl font-bold ${positive === true ? 'text-green-400' : positive === false ? 'text-red-400' : 'text-white'}`}>
                {value}
            </div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );
}

function EquityCurveChart({ data }: { data: FTDailyLog[] }) {
    if (data.length < 2) return <div className="text-center text-gray-600 py-8 text-sm">Need at least 2 days of data for chart</div>;

    const width = 900; const height = 260;
    const pad = { t: 20, r: 20, b: 40, l: 60 };
    const cW = width - pad.l - pad.r; const cH = height - pad.t - pad.b;

    const values = data.map(d => d.equity);
    const mn = Math.min(...values) * 0.98; const mx = Math.max(...values) * 1.02;
    const x = (i: number) => pad.l + (i / (data.length - 1)) * cW;
    const y = (v: number) => pad.t + cH - ((v - mn) / (mx - mn)) * cH;

    const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.equity)}`).join(' ');
    const baseLine = data.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(data[0].equity)}`).join(' ');

    const yTicks = Array.from({ length: 5 }, (_, i) => mn + (i / 4) * (mx - mn));
    const step = Math.max(1, Math.floor(data.length / 6));

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 260 }}>
            {yTicks.map((v, i) => (
                <g key={i}>
                    <line x1={pad.l} y1={y(v)} x2={width - pad.r} y2={y(v)} stroke="#333" strokeDasharray="4" />
                    <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fill="#94a3b8" fontSize="11" fontFamily="monospace">${Math.round(v).toLocaleString()}</text>
                </g>
            ))}
            {data.map((d, i) => i % step === 0 || i === data.length - 1 ? (
                <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">{d.date.slice(5)}</text>
            ) : null)}
            <path d={baseLine} fill="none" stroke="#555" strokeWidth="1" strokeDasharray="6" />
            <path d={path} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
            <text x={width - 120} y={15} fill="#22d3ee" fontSize="12">Equity</text>
            <text x={width - 40} y={15} fill="#555" fontSize="12">Start</text>
        </svg>
    );
}

function PositionCard({ pos }: { pos: FTPosition }) {
    const pnlEst = 0; // Can't know current price without API call
    const sourceBadge = pos.source === 'both' ? 'bg-purple-900/30 text-purple-400' :
        pos.source === 'top_picks' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-amber-900/30 text-amber-400';
    const sourceLabel = pos.source === 'both' ? 'Both' : pos.source === 'top_picks' ? 'Top Pick' : 'Alpha';

    const entryDate = new Date(pos.entryDate);
    const daysHeld = Math.round((Date.now() - entryDate.getTime()) / (1000 * 3600 * 24));

    return (
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-lg">{pos.symbol}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sourceBadge}`}>{sourceLabel}</span>
                </div>
                <span className="text-cyan-400 font-mono text-sm">Score: {pos.entryScore}</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs mt-2">
                <div><span className="text-gray-500">Entry</span><div className="text-white font-mono">${pos.entryPrice.toFixed(2)}</div></div>
                <div><span className="text-gray-500">Stop</span><div className="text-red-400 font-mono">${pos.stopLoss.toFixed(2)}</div></div>
                <div><span className="text-gray-500">Target</span><div className="text-green-400 font-mono">${pos.takeProfit.toFixed(2)}</div></div>
                <div><span className="text-gray-500">Qty</span><div className="text-white font-mono">{pos.qty} shares</div></div>
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span>{pos.sector}</span>
                <span>{daysHeld}d held (max 30)</span>
                <span>Entry: {pos.entryDate}</span>
            </div>
            {pos.entryReasons.length > 0 && (
                <div className="mt-2 text-[10px] text-gray-600">{pos.entryReasons.join(' | ')}</div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ForwardTestPage() {
    const [state, setState] = useState<FTState | null>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showSignals, setShowSignals] = useState(false);
    const [signalDate, setSignalDate] = useState('');
    const [tradeSort, setTradeSort] = useState<'date' | 'pnl'>('date');

    const fetchState = useCallback(async () => {
        try {
            const res = await fetch('/api/forward-test');
            const data = await res.json();
            setState(data);
            if (data.lastRunDate) setSignalDate(data.lastRunDate);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchState(); }, [fetchState]);

    const runTest = useCallback(async () => {
        setRunning(true); setError(null);
        try {
            const res = await fetch('/api/forward-test', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
            });
            const data = await res.json();
            if (data.error) setError(data.error);
            else { setState(data.state); if (data.state.lastRunDate) setSignalDate(data.state.lastRunDate); }
        } catch (err: any) { setError(err.message); }
        finally { setRunning(false); }
    }, []);

    const resetTest = useCallback(async () => {
        if (!confirm('Reset forward test? All positions, trades, and history will be erased.')) return;
        try {
            const res = await fetch('/api/forward-test', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"reset"}',
            });
            const data = await res.json();
            setState(data.state);
        } catch (err: any) { setError(err.message); }
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
            <Loader2 size={32} className="text-cyan-400 animate-spin" />
        </div>
    );

    const s = state!;
    const returnPct = s ? ((s.account.equity - s.account.initialBalance) / s.account.initialBalance) * 100 : 0;
    const winners = s?.trades.filter(t => t.pnl > 0) || [];
    const losers = s?.trades.filter(t => t.pnl <= 0) || [];
    const winRate = s?.trades.length ? (winners.length / s.trades.length) * 100 : 0;
    const grossProfit = winners.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const todaySignals = s?.signals.filter(sig => sig.date === signalDate) || [];
    const uniqueDates = [...new Set(s?.signals.map(sig => sig.date) || [])].sort().reverse();

    const sortedTrades = s?.trades
        ? [...s.trades].sort((a, b) => tradeSort === 'pnl' ? b.pnl - a.pnl : new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime())
        : [];

    // Per-symbol stats
    const symStats: Record<string, { trades: number; pnl: number; wins: number }> = {};
    for (const t of s?.trades || []) {
        if (!symStats[t.symbol]) symStats[t.symbol] = { trades: 0, pnl: 0, wins: 0 };
        symStats[t.symbol].trades++;
        symStats[t.symbol].pnl += t.pnl;
        if (t.pnl > 0) symStats[t.symbol].wins++;
    }

    const lastLog = s?.dailyLog[s.dailyLog.length - 1];

    return (
        <div className="min-h-screen bg-[#0d0d1a] text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-[#111128]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-gray-500 hover:text-white transition"><ArrowLeft size={20} /></Link>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Zap size={22} className="text-amber-400" />
                                Forward Test — Live Paper Trading
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Dynamic stock selection from Top Picks + Alpha Hunter | All fixes applied
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchState} className="p-2 text-gray-500 hover:text-white transition" title="Refresh"><RefreshCw size={16} /></button>
                        <button onClick={resetTest} className="p-2 text-gray-500 hover:text-red-400 transition" title="Reset"><Trash2 size={16} /></button>
                        <button onClick={runTest} disabled={running}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition text-sm">
                            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                            {running ? 'Running...' : 'Run Today'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            {s && (
                <div className="border-b border-gray-800/50 bg-[#0f0f24]">
                    <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-6 text-xs">
                        <span className="text-gray-500">Day {s.totalRuns}</span>
                        <span className="text-gray-500">Started: {s.startDate}</span>
                        <span className="text-gray-500">Last Run: {s.lastRunDate || 'Never'}</span>
                        {lastLog && <>
                            <span className="text-gray-500">Scanned: {lastLog.symbolsScanned} stocks</span>
                            <span className="text-cyan-500">{lastLog.topPicksCount} Top Picks</span>
                            <span className="text-amber-500">{lastLog.alphaHunterCount} Alpha Hunter</span>
                            {lastLog.cashMode && <span className="px-2 py-0.5 rounded bg-red-900/40 text-red-400 font-semibold">CASH MODE</span>}
                        </>}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex gap-2 pt-4">
                    {['dashboard', 'positions', 'signals', 'trades', 'blacklist'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab ? 'bg-amber-600 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:text-white border border-gray-800'}`}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {error && (
                    <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 flex items-center gap-3">
                        <AlertTriangle size={18} className="text-red-400" /><span className="text-red-300 text-sm">{error}</span>
                    </div>
                )}

                {/* ── DASHBOARD TAB ── */}
                {activeTab === 'dashboard' && s && (<>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <MetricCard label="Equity" value={`$${s.account.equity.toFixed(0)}`}
                            sub={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`} positive={returnPct > 0} />
                        <MetricCard label="Cash" value={`$${s.account.cash.toFixed(0)}`} />
                        <MetricCard label="Positions" value={`${s.positions.length} / 6`} />
                        <MetricCard label="Total Trades" value={`${s.trades.length}`} sub={`${winners.length}W / ${losers.length}L`} />
                        <MetricCard label="Win Rate" value={s.trades.length > 0 ? `${winRate.toFixed(0)}%` : '—'}
                            positive={winRate > 50 ? true : winRate < 40 ? false : null} />
                        <MetricCard label="Profit Factor" value={s.trades.length > 0 ? (profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)) : '—'}
                            positive={profitFactor > 1.3 ? true : profitFactor < 1 ? false : null} />
                    </div>

                    {s.trades.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard label="Gross Profit" value={`$${grossProfit.toFixed(2)}`} positive={true} />
                            <MetricCard label="Gross Loss" value={`$${grossLoss.toFixed(2)}`} positive={false} />
                            <MetricCard label="Avg Winner" value={winners.length > 0 ? `$${(grossProfit / winners.length).toFixed(2)}` : '—'} positive={true} />
                            <MetricCard label="Avg Loser" value={losers.length > 0 ? `$${(grossLoss / losers.length).toFixed(2)}` : '—'} positive={false} />
                        </div>
                    )}

                    <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                            <TrendingUp size={16} className="text-cyan-400" /> Equity Curve
                        </h3>
                        <EquityCurveChart data={s.dailyLog} />
                    </div>

                    {/* Open Positions Summary */}
                    {s.positions.length > 0 && (
                        <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                            <h3 className="text-sm font-medium text-gray-400 mb-3">Open Positions ({s.positions.length})</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {s.positions.map(pos => <PositionCard key={pos.symbol} pos={pos} />)}
                            </div>
                        </div>
                    )}

                    {/* Recent Trades */}
                    {s.trades.length > 0 && (
                        <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                            <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Trades</h3>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-gray-500 border-b border-gray-800">
                                        <th className="text-left py-2 px-2">Symbol</th><th className="text-left py-2 px-2">Source</th>
                                        <th className="r py-2 px-2 text-right">Entry</th><th className="r py-2 px-2 text-right">Exit</th>
                                        <th className="text-left py-2 px-2">Reason</th><th className="r py-2 px-2 text-right">Days</th>
                                        <th className="r py-2 px-2 text-right">PnL</th><th className="r py-2 px-2 text-right">PnL%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {s.trades.slice(-5).reverse().map((t, i) => (
                                        <tr key={i} className="border-b border-gray-800/30">
                                            <td className="py-1.5 px-2 font-medium">{t.symbol}</td>
                                            <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${t.source === 'both' ? 'bg-purple-900/30 text-purple-400' : t.source === 'top_picks' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-amber-900/30 text-amber-400'}`}>{t.source === 'both' ? 'Both' : t.source === 'top_picks' ? 'TP' : 'AH'}</span></td>
                                            <td className="py-1.5 px-2 text-right font-mono text-gray-300">${t.entryPrice.toFixed(2)}</td>
                                            <td className="py-1.5 px-2 text-right font-mono text-gray-300">${t.exitPrice.toFixed(2)}</td>
                                            <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${t.exitReason === 'target' ? 'bg-green-900/40 text-green-400' : t.exitReason === 'stop' ? 'bg-red-900/40 text-red-400' : 'bg-yellow-900/40 text-yellow-400'}`}>{t.exitReason}</span></td>
                                            <td className="py-1.5 px-2 text-right text-gray-400">{t.holdingDays}d</td>
                                            <td className={`py-1.5 px-2 text-right font-mono ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${t.pnl.toFixed(2)}</td>
                                            <td className={`py-1.5 px-2 text-right font-mono ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>)}

                {/* ── POSITIONS TAB ── */}
                {activeTab === 'positions' && s && (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-400">{s.positions.length} open position{s.positions.length !== 1 ? 's' : ''} | Cash: ${s.account.cash.toFixed(2)}</div>
                        {s.positions.length === 0 ? (
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-12 text-center text-gray-600">No open positions. Run the test to scan for entries.</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {s.positions.map(pos => <PositionCard key={pos.symbol} pos={pos} />)}
                            </div>
                        )}
                    </div>
                )}

                {/* ── SIGNALS TAB ── */}
                {activeTab === 'signals' && s && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400">Signals for:</span>
                            <select value={signalDate} onChange={e => setSignalDate(e.target.value)}
                                className="px-3 py-1.5 rounded-lg text-sm bg-[#1a1a2e] border border-gray-700 text-white">
                                {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <span className="text-xs text-gray-600">{todaySignals.length} signals</span>
                        </div>

                        {todaySignals.length === 0 ? (
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-12 text-center text-gray-600">No signals for this date.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-gray-500 border-b border-gray-800">
                                            <th className="text-left py-2 px-3">Symbol</th><th className="text-left py-2 px-3">Source</th>
                                            <th className="text-right py-2 px-3">Tech Score</th><th className="text-right py-2 px-3">Conv Score</th>
                                            <th className="text-left py-2 px-3">Trend</th><th className="text-right py-2 px-3">Price</th>
                                            <th className="text-left py-2 px-3">Action</th><th className="text-left py-2 px-3">Reasons</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {todaySignals.sort((a, b) => b.techScore - a.techScore).map((sig, i) => {
                                            const actionColor = sig.action === 'entered' ? 'bg-green-900/40 text-green-400' :
                                                sig.action.includes('blacklist') ? 'bg-red-900/40 text-red-400' :
                                                sig.action.includes('bearish') ? 'bg-gray-800 text-gray-500' :
                                                sig.action.includes('threshold') ? 'bg-yellow-900/40 text-yellow-400' :
                                                'bg-gray-800 text-gray-400';
                                            const srcColor = sig.source === 'both' ? 'bg-purple-900/30 text-purple-400' :
                                                sig.source === 'top_picks' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-amber-900/30 text-amber-400';
                                            return (
                                                <tr key={i} className={`border-b border-gray-800/30 ${sig.action === 'entered' ? 'bg-green-900/5' : ''}`}>
                                                    <td className="py-2 px-3 font-medium text-white">{sig.symbol}</td>
                                                    <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded text-[10px] ${srcColor}`}>{sig.source === 'both' ? 'Both' : sig.source === 'top_picks' ? 'TP' : 'AH'}</span></td>
                                                    <td className="py-2 px-3 text-right font-mono text-cyan-400">{sig.techScore}</td>
                                                    <td className="py-2 px-3 text-right font-mono text-gray-300">{sig.score}</td>
                                                    <td className="py-2 px-3"><span className={sig.trend === 'BULLISH' ? 'text-green-400' : sig.trend === 'BEARISH' ? 'text-red-400' : 'text-gray-500'}>{sig.trend}</span></td>
                                                    <td className="py-2 px-3 text-right font-mono text-gray-300">${sig.price.toFixed(2)}</td>
                                                    <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${actionColor}`}>{sig.action.replace('skipped_', '')}</span></td>
                                                    <td className="py-2 px-3 text-[10px] text-gray-500 max-w-[200px] truncate">{sig.reasons.join(', ')}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TRADES TAB ── */}
                {activeTab === 'trades' && s && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400">{s.trades.length} completed trades</span>
                            <div className="flex gap-2">
                                <button onClick={() => setTradeSort('date')} className={`px-3 py-1 rounded text-xs ${tradeSort === 'date' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>By Date</button>
                                <button onClick={() => setTradeSort('pnl')} className={`px-3 py-1 rounded text-xs ${tradeSort === 'pnl' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>By PnL</button>
                            </div>
                        </div>

                        {s.trades.length === 0 ? (
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-12 text-center text-gray-600">No completed trades yet. Trades appear after positions hit stop, target, or 30-day time exit.</div>
                        ) : (<>
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[#0d0d1a]">
                                        <tr className="text-gray-500 border-b border-gray-800">
                                            <th className="text-left py-2 px-2">Symbol</th><th className="text-left py-2 px-2">Source</th>
                                            <th className="text-right py-2 px-2">Score</th><th className="text-right py-2 px-2">Qty</th>
                                            <th className="text-right py-2 px-2">Entry</th><th className="text-right py-2 px-2">Exit</th>
                                            <th className="text-left py-2 px-2">Dates</th><th className="text-right py-2 px-2">Days</th>
                                            <th className="text-left py-2 px-2">Reason</th>
                                            <th className="text-right py-2 px-2">PnL</th><th className="text-right py-2 px-2">PnL%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedTrades.map((t, i) => (
                                            <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/10">
                                                <td className="py-1.5 px-2 font-medium text-white">{t.symbol}</td>
                                                <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${t.source === 'both' ? 'bg-purple-900/30 text-purple-400' : t.source === 'top_picks' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-amber-900/30 text-amber-400'}`}>{t.source === 'both' ? 'Both' : t.source === 'top_picks' ? 'TP' : 'AH'}</span></td>
                                                <td className="py-1.5 px-2 text-right text-cyan-400">{t.entryScore}</td>
                                                <td className="py-1.5 px-2 text-right text-gray-400">{t.qty}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-gray-300">${t.entryPrice.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-gray-300">${t.exitPrice.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 text-gray-500">{t.entryDate} → {t.exitDate}</td>
                                                <td className="py-1.5 px-2 text-right text-gray-400">{t.holdingDays}d</td>
                                                <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${t.exitReason === 'target' ? 'bg-green-900/40 text-green-400' : t.exitReason === 'stop' ? 'bg-red-900/40 text-red-400' : 'bg-yellow-900/40 text-yellow-400'}`}>{t.exitReason}</span></td>
                                                <td className={`py-1.5 px-2 text-right font-mono ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${t.pnl.toFixed(2)}</td>
                                                <td className={`py-1.5 px-2 text-right font-mono ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Per-symbol summary */}
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                                <h3 className="text-sm font-medium text-gray-400 mb-3">Per-Symbol Performance</h3>
                                <table className="w-full text-xs">
                                    <thead><tr className="text-gray-500 border-b border-gray-800">
                                        <th className="text-left py-2 px-3">Symbol</th><th className="text-right py-2 px-3">Trades</th>
                                        <th className="text-right py-2 px-3">Wins</th><th className="text-right py-2 px-3">Win Rate</th>
                                        <th className="text-right py-2 px-3">PnL</th>
                                    </tr></thead>
                                    <tbody>
                                        {Object.entries(symStats).sort(([,a], [,b]) => b.pnl - a.pnl).map(([sym, v]) => (
                                            <tr key={sym} className="border-b border-gray-800/30">
                                                <td className="py-1.5 px-3 font-medium text-white">{sym}</td>
                                                <td className="py-1.5 px-3 text-right text-gray-400">{v.trades}</td>
                                                <td className="py-1.5 px-3 text-right text-gray-400">{v.wins}</td>
                                                <td className="py-1.5 px-3 text-right">{v.trades > 0 ? `${(v.wins / v.trades * 100).toFixed(0)}%` : '—'}</td>
                                                <td className={`py-1.5 px-3 text-right font-mono ${v.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${v.pnl.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>)}
                    </div>
                )}

                {/* ── BLACKLIST TAB ── */}
                {activeTab === 'blacklist' && s && (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-400 flex items-center gap-2">
                            <Shield size={16} className="text-red-400" />
                            Symbol Blacklist — Symbols suspended after &lt;25% win rate over 20 trades
                        </div>
                        {Object.keys(s.blacklist).length === 0 ? (
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-12 text-center text-gray-600">No symbols tracked yet. Blacklist populates after trades are completed.</div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead><tr className="text-gray-500 border-b border-gray-800">
                                    <th className="text-left py-2 px-3">Symbol</th><th className="text-right py-2 px-3">Trades Tracked</th>
                                    <th className="text-right py-2 px-3">Win Rate</th><th className="text-left py-2 px-3">Status</th>
                                    <th className="text-left py-2 px-3">Suspended Until</th>
                                </tr></thead>
                                <tbody>
                                    {Object.entries(s.blacklist).sort(([,a], [,b]) => {
                                        const aWR = a.results.length > 0 ? a.results.filter(r => r).length / a.results.length : 1;
                                        const bWR = b.results.length > 0 ? b.results.filter(r => r).length / b.results.length : 1;
                                        return aWR - bWR;
                                    }).map(([sym, entry]) => {
                                        const wins = entry.results.filter(r => r).length;
                                        const wr = entry.results.length > 0 ? (wins / entry.results.length * 100) : 0;
                                        const suspended = entry.suspendedUntil !== null;
                                        return (
                                            <tr key={sym} className={`border-b border-gray-800/30 ${suspended ? 'bg-red-900/5' : ''}`}>
                                                <td className="py-2 px-3 font-medium text-white">{sym}</td>
                                                <td className="py-2 px-3 text-right text-gray-400">{entry.results.length} / 20</td>
                                                <td className={`py-2 px-3 text-right font-mono ${wr < 25 ? 'text-red-400' : wr < 40 ? 'text-yellow-400' : 'text-green-400'}`}>{wr.toFixed(0)}%</td>
                                                <td className="py-2 px-3">
                                                    {suspended ? <span className="px-2 py-0.5 rounded text-[10px] bg-red-900/40 text-red-400 font-medium flex items-center gap-1 w-fit"><Ban size={10} /> SUSPENDED</span> :
                                                        <span className="px-2 py-0.5 rounded text-[10px] bg-green-900/30 text-green-400">Active</span>}
                                                </td>
                                                <td className="py-2 px-3 text-gray-500">{entry.suspendedUntil || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
