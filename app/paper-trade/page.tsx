"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Play, Loader2, TrendingUp, AlertTriangle, ArrowLeft,
    ChevronDown, ChevronUp, RefreshCw, Trash2, Zap, DollarSign, Activity
} from 'lucide-react';

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
    return (
        <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-xl font-bold ${positive === true ? 'text-green-400' : positive === false ? 'text-red-400' : 'text-white'}`}>{value}</div>
            {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
    );
}

export default function PaperTradePage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [tradeSort, setTradeSort] = useState<'date' | 'pnl'>('date');

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/paper-trade');
            const d = await res.json();
            if (d.error) setError(d.error);
            else setData(d);
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const runTrade = useCallback(async () => {
        setRunning(true); setError(null);
        try {
            const res = await fetch('/api/paper-trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const d = await res.json();
            if (d.error) setError(d.error);
            else { setData({ ...data, state: d.state }); fetchData(); }
        } catch (err: any) { setError(err.message); }
        finally { setRunning(false); }
    }, [data, fetchData]);

    const resetTrade = useCallback(async () => {
        if (!confirm('Reset Alpaca paper trading? This clears local tracking only — Alpaca positions remain.')) return;
        try {
            const res = await fetch('/api/paper-trade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"reset"}' });
            const d = await res.json();
            setData({ ...data, state: d.state }); fetchData();
        } catch (err: any) { setError(err.message); }
    }, [data, fetchData]);

    if (loading) return <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center"><Loader2 size={32} className="text-green-400 animate-spin" /></div>;

    const s = data?.state;
    const alpaca = data?.alpaca;
    const acct = alpaca?.account;
    const positions = alpaca?.positions || [];
    const orders = alpaca?.orders || [];
    const returnPct = s && s.account.initialBalance > 0 ? ((s.account.equity - s.account.initialBalance) / s.account.initialBalance) * 100 : 0;
    const winners = s?.trades.filter((t: any) => t.pnl > 0) || [];
    const losers = s?.trades.filter((t: any) => t.pnl <= 0) || [];
    const winRate = s?.trades.length ? (winners.length / s.trades.length) * 100 : 0;
    const totalSlippage = s?.trades.reduce((sum: number, t: any) => sum + (t.slippage || 0), 0) || 0;
    const sortedTrades = s?.trades ? [...s.trades].sort((a: any, b: any) => tradeSort === 'pnl' ? b.pnl - a.pnl : new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()) : [];

    return (
        <div className="min-h-screen bg-[#0d0d1a] text-white">
            <div className="border-b border-gray-800 bg-[#111128]">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-gray-500 hover:text-white transition"><ArrowLeft size={20} /></Link>
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <DollarSign size={22} className="text-green-400" />
                                Alpaca Paper Trading — Live Orders
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">Real paper orders on Alpaca | Scale-out + trailing stop | Dynamic stock selection</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchData} className="p-2 text-gray-500 hover:text-white transition" title="Refresh"><RefreshCw size={16} /></button>
                        <button onClick={resetTrade} className="p-2 text-gray-500 hover:text-red-400 transition" title="Reset tracking"><Trash2 size={16} /></button>
                        <button onClick={runTrade} disabled={running}
                            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition text-sm">
                            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                            {running ? 'Executing...' : 'Run & Execute'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Status bar */}
            {acct && (
                <div className="border-b border-gray-800/50 bg-[#0f0f24]">
                    <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-6 text-xs">
                        <span className="text-green-400 font-medium">ALPACA CONNECTED</span>
                        <span className="text-gray-500">Account: {acct.account_number}</span>
                        <span className="text-gray-500">Buying Power: ${parseFloat(acct.buying_power).toFixed(2)}</span>
                        <span className="text-gray-500">Day Trades: {acct.daytrade_count}</span>
                        {s && <span className="text-gray-500">Day {s.totalRuns} | Last: {s.lastRunDate || 'Never'}</span>}
                    </div>
                </div>
            )}
            {!acct && (
                <div className="border-b border-gray-800/50 bg-red-900/20">
                    <div className="max-w-7xl mx-auto px-6 py-2 text-xs text-red-400">ALPACA NOT CONNECTED — Check ALPACA_API_KEY and ALPACA_API_SECRET in .env.local</div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6">
                <div className="flex gap-2 pt-4">
                    {['dashboard', 'alpaca_live', 'trades', 'signals'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${activeTab === tab ? 'bg-green-600 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:text-white border border-gray-800'}`}>
                            {tab === 'alpaca_live' ? 'Alpaca Live' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {error && <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 flex items-center gap-3"><AlertTriangle size={18} className="text-red-400" /><span className="text-red-300 text-sm">{error}</span></div>}

                {/* DASHBOARD */}
                {activeTab === 'dashboard' && s && (<>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <MetricCard label="Alpaca Equity" value={`$${s.account.equity.toFixed(0)}`} sub={`${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`} positive={returnPct > 0} />
                        <MetricCard label="Cash" value={`$${s.account.cash.toFixed(0)}`} />
                        <MetricCard label="Positions" value={`${s.positions.length} / 6`} />
                        <MetricCard label="Trades" value={`${s.trades.length}`} sub={`${winners.length}W / ${losers.length}L`} />
                        <MetricCard label="Win Rate" value={s.trades.length > 0 ? `${winRate.toFixed(0)}%` : '—'} positive={winRate > 50 ? true : winRate < 40 ? false : null} />
                        <MetricCard label="Total Slippage" value={`$${totalSlippage.toFixed(2)}`} sub={s.trades.length > 0 ? `$${(totalSlippage / s.trades.length).toFixed(3)}/trade` : ''} />
                    </div>

                    {/* Tracked Positions */}
                    {s.positions.length > 0 && (
                        <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                            <h3 className="text-sm font-medium text-gray-400 mb-3">Tracked Positions ({s.positions.length})</h3>
                            <table className="w-full text-xs">
                                <thead><tr className="text-gray-500 border-b border-gray-800">
                                    <th className="text-left py-2 px-2">Symbol</th><th className="text-left py-2 px-2">Source</th>
                                    <th className="text-right py-2 px-2">Qty</th><th className="text-right py-2 px-2">Entry</th>
                                    <th className="text-right py-2 px-2">Stop</th><th className="text-right py-2 px-2">Scale</th>
                                    <th className="text-right py-2 px-2">Score</th><th className="text-left py-2 px-2">Date</th>
                                </tr></thead>
                                <tbody>
                                    {s.positions.map((p: any, i: number) => {
                                        const daysHeld = Math.round((Date.now() - new Date(p.entryDate).getTime()) / (1000 * 3600 * 24));
                                        const scale1 = p.entryPrice + p.atr;
                                        const scale2 = p.entryPrice + p.atr * 2;
                                        return (
                                            <tr key={i} className="border-b border-gray-800/30">
                                                <td className="py-2 px-2 font-medium text-white">{p.symbol}</td>
                                                <td className="py-2 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${p.source === 'both' ? 'bg-purple-900/30 text-purple-400' : p.source === 'top_picks' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-amber-900/30 text-amber-400'}`}>{p.source === 'both' ? 'Both' : p.source === 'top_picks' ? 'TP' : 'AH'}</span></td>
                                                <td className="py-2 px-2 text-right text-gray-300">{p.qty}/{p.originalQty}</td>
                                                <td className="py-2 px-2 text-right font-mono text-gray-300">${p.entryPrice.toFixed(2)}</td>
                                                <td className="py-2 px-2 text-right font-mono text-red-400">${p.stopLoss.toFixed(2)}</td>
                                                <td className="py-2 px-2 text-right">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.scaleLevel === 0 ? 'bg-gray-800 text-gray-400' : p.scaleLevel === 1 ? 'bg-cyan-900/30 text-cyan-400' : 'bg-green-900/30 text-green-400'}`}>
                                                        {p.scaleLevel === 0 ? `S1:$${scale1.toFixed(0)}` : p.scaleLevel === 1 ? `S2:$${scale2.toFixed(0)}` : 'Trailing'}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 text-right text-cyan-400">{p.entryScore}</td>
                                                <td className="py-2 px-2 text-gray-500">{p.entryDate} ({daysHeld}d)</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Equity curve */}
                    {s.dailyLog.length > 1 && (
                        <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-green-400" /> Equity Curve (Alpaca)</h3>
                            <div className="flex items-end gap-1 h-32">
                                {s.dailyLog.map((d: any, i: number) => {
                                    const min = Math.min(...s.dailyLog.map((x: any) => x.equity));
                                    const max = Math.max(...s.dailyLog.map((x: any) => x.equity));
                                    const range = max - min || 1;
                                    const h = ((d.equity - min) / range) * 100 + 10;
                                    const color = d.equity >= s.account.initialBalance ? '#22c55e' : '#ef4444';
                                    return <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundColor: color, opacity: 0.7 }} title={`${d.date}: $${d.equity.toFixed(0)}`} />;
                                })}
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                                <span>{s.dailyLog[0]?.date}</span>
                                <span>{s.dailyLog[s.dailyLog.length - 1]?.date}</span>
                            </div>
                        </div>
                    )}
                </>)}

                {/* ALPACA LIVE */}
                {activeTab === 'alpaca_live' && (<>
                    {acct && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard label="Portfolio Value" value={`$${parseFloat(acct.portfolio_value).toFixed(2)}`} />
                            <MetricCard label="Equity" value={`$${parseFloat(acct.equity).toFixed(2)}`} />
                            <MetricCard label="Cash" value={`$${parseFloat(acct.cash).toFixed(2)}`} />
                            <MetricCard label="Buying Power" value={`$${parseFloat(acct.buying_power).toFixed(2)}`} />
                        </div>
                    )}

                    <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                        <h3 className="text-sm font-medium text-gray-400 mb-3">Alpaca Live Positions ({positions.length})</h3>
                        {positions.length === 0 ? <div className="text-center text-gray-600 py-8">No positions on Alpaca</div> : (
                            <table className="w-full text-xs">
                                <thead><tr className="text-gray-500 border-b border-gray-800">
                                    <th className="text-left py-2 px-2">Symbol</th><th className="text-right py-2 px-2">Qty</th>
                                    <th className="text-right py-2 px-2">Avg Entry</th><th className="text-right py-2 px-2">Current</th>
                                    <th className="text-right py-2 px-2">Market Value</th><th className="text-right py-2 px-2">Unrealized P&L</th>
                                    <th className="text-right py-2 px-2">Today %</th>
                                </tr></thead>
                                <tbody>
                                    {positions.map((p: any, i: number) => (
                                        <tr key={i} className="border-b border-gray-800/30">
                                            <td className="py-2 px-2 font-medium text-white">{p.symbol}</td>
                                            <td className="py-2 px-2 text-right text-gray-300">{p.qty}</td>
                                            <td className="py-2 px-2 text-right font-mono text-gray-300">${parseFloat(p.avg_entry_price).toFixed(2)}</td>
                                            <td className="py-2 px-2 text-right font-mono text-white">${parseFloat(p.current_price).toFixed(2)}</td>
                                            <td className="py-2 px-2 text-right font-mono text-gray-300">${parseFloat(p.market_value).toFixed(2)}</td>
                                            <td className={`py-2 px-2 text-right font-mono ${parseFloat(p.unrealized_pl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>${parseFloat(p.unrealized_pl).toFixed(2)} ({(parseFloat(p.unrealized_plpc) * 100).toFixed(1)}%)</td>
                                            <td className={`py-2 px-2 text-right font-mono ${parseFloat(p.change_today) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(parseFloat(p.change_today) * 100).toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="bg-[#111128] border border-gray-800 rounded-lg p-5">
                        <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Alpaca Orders ({orders.length})</h3>
                        {orders.length === 0 ? <div className="text-center text-gray-600 py-8">No recent orders</div> : (
                            <div className="max-h-96 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[#111128]"><tr className="text-gray-500 border-b border-gray-800">
                                        <th className="text-left py-2 px-2">Symbol</th><th className="text-left py-2 px-2">Side</th>
                                        <th className="text-right py-2 px-2">Qty</th><th className="text-right py-2 px-2">Filled</th>
                                        <th className="text-right py-2 px-2">Fill Price</th><th className="text-left py-2 px-2">Status</th>
                                        <th className="text-left py-2 px-2">Type</th><th className="text-left py-2 px-2">Created</th>
                                    </tr></thead>
                                    <tbody>
                                        {orders.map((o: any, i: number) => (
                                            <tr key={i} className="border-b border-gray-800/30">
                                                <td className="py-1.5 px-2 font-medium text-white">{o.symbol}</td>
                                                <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${o.side === 'buy' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{o.side}</span></td>
                                                <td className="py-1.5 px-2 text-right text-gray-300">{o.qty}</td>
                                                <td className="py-1.5 px-2 text-right text-gray-300">{o.filled_qty}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-gray-300">{o.filled_avg_price ? `$${parseFloat(o.filled_avg_price).toFixed(2)}` : '—'}</td>
                                                <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${o.status === 'filled' ? 'bg-green-900/30 text-green-400' : o.status === 'canceled' ? 'bg-gray-800 text-gray-500' : 'bg-yellow-900/30 text-yellow-400'}`}>{o.status}</span></td>
                                                <td className="py-1.5 px-2 text-gray-500">{o.type}{o.order_class !== 'simple' ? ` (${o.order_class})` : ''}</td>
                                                <td className="py-1.5 px-2 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>)}

                {/* TRADES */}
                {activeTab === 'trades' && s && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400">{s.trades.length} completed trades</span>
                            <div className="flex gap-2">
                                <button onClick={() => setTradeSort('date')} className={`px-3 py-1 rounded text-xs ${tradeSort === 'date' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}>By Date</button>
                                <button onClick={() => setTradeSort('pnl')} className={`px-3 py-1 rounded text-xs ${tradeSort === 'pnl' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400'}`}>By PnL</button>
                            </div>
                        </div>
                        {s.trades.length === 0 ? <div className="bg-[#111128] border border-gray-800 rounded-lg p-12 text-center text-gray-600">No trades yet. Run the system to start trading.</div> : (
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[#0d0d1a]"><tr className="text-gray-500 border-b border-gray-800">
                                        <th className="text-left py-2 px-2">Symbol</th><th className="text-left py-2 px-2">Source</th>
                                        <th className="text-right py-2 px-2">Qty</th><th className="text-right py-2 px-2">Entry</th>
                                        <th className="text-right py-2 px-2">Exit</th><th className="text-right py-2 px-2">Alpaca Fill</th>
                                        <th className="text-left py-2 px-2">Reason</th><th className="text-right py-2 px-2">Days</th>
                                        <th className="text-right py-2 px-2">PnL</th><th className="text-right py-2 px-2">Slip</th>
                                    </tr></thead>
                                    <tbody>
                                        {sortedTrades.map((t: any, i: number) => (
                                            <tr key={i} className="border-b border-gray-800/30">
                                                <td className="py-1.5 px-2 font-medium text-white">{t.symbol}</td>
                                                <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${t.source === 'both' ? 'bg-purple-900/30 text-purple-400' : t.source === 'top_picks' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-amber-900/30 text-amber-400'}`}>{t.source === 'both' ? 'Both' : t.source === 'top_picks' ? 'TP' : 'AH'}</span></td>
                                                <td className="py-1.5 px-2 text-right text-gray-300">{t.qty}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-gray-300">${t.entryPrice.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-gray-300">${t.exitPrice.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-green-400">{t.alpacaFillPrice ? `$${t.alpacaFillPrice.toFixed(2)}` : '—'}</td>
                                                <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${t.exitReason.includes('scale') ? 'bg-cyan-900/30 text-cyan-400' : t.exitReason === 'trail_stop' ? 'bg-yellow-900/30 text-yellow-400' : t.exitReason === 'stop' ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'}`}>{t.exitReason}</span></td>
                                                <td className="py-1.5 px-2 text-right text-gray-400">{t.holdingDays}d</td>
                                                <td className={`py-1.5 px-2 text-right font-mono ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${t.pnl.toFixed(2)}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-gray-500">${(t.slippage || 0).toFixed(3)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* SIGNALS */}
                {activeTab === 'signals' && s && (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-400">Today&#39;s signals ({s.signals.filter((sig: any) => sig.date === s.lastRunDate).length})</div>
                        {s.signals.filter((sig: any) => sig.date === s.lastRunDate).length === 0 ?
                            <div className="bg-[#111128] border border-gray-800 rounded-lg p-12 text-center text-gray-600">No signals today. Run the system to scan.</div> : (
                            <table className="w-full text-xs">
                                <thead><tr className="text-gray-500 border-b border-gray-800">
                                    <th className="text-left py-2 px-2">Symbol</th><th className="text-left py-2 px-2">Source</th>
                                    <th className="text-right py-2 px-2">Tech</th><th className="text-right py-2 px-2">Conv</th>
                                    <th className="text-left py-2 px-2">Trend</th><th className="text-right py-2 px-2">Price</th>
                                    <th className="text-left py-2 px-2">Action</th>
                                </tr></thead>
                                <tbody>
                                    {s.signals.filter((sig: any) => sig.date === s.lastRunDate).sort((a: any, b: any) => b.techScore - a.techScore).map((sig: any, i: number) => (
                                        <tr key={i} className={`border-b border-gray-800/30 ${sig.action === 'qualify' ? 'bg-green-900/5' : ''}`}>
                                            <td className="py-1.5 px-2 font-medium text-white">{sig.symbol}</td>
                                            <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${sig.source === 'both' ? 'bg-purple-900/30 text-purple-400' : sig.source === 'top_picks' ? 'bg-cyan-900/30 text-cyan-400' : 'bg-amber-900/30 text-amber-400'}`}>{sig.source === 'both' ? 'Both' : sig.source === 'top_picks' ? 'TP' : 'AH'}</span></td>
                                            <td className="py-1.5 px-2 text-right text-cyan-400">{sig.techScore}</td>
                                            <td className="py-1.5 px-2 text-right text-gray-300">{sig.convScore}</td>
                                            <td className="py-1.5 px-2"><span className={sig.trend === 'BULLISH' ? 'text-green-400' : sig.trend === 'BEARISH' ? 'text-red-400' : 'text-gray-500'}>{sig.trend}</span></td>
                                            <td className="py-1.5 px-2 text-right font-mono text-gray-300">${sig.price.toFixed(2)}</td>
                                            <td className="py-1.5 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${sig.action === 'qualify' ? 'bg-green-900/30 text-green-400' : sig.action.includes('bearish') ? 'bg-gray-800 text-gray-500' : 'bg-yellow-900/30 text-yellow-400'}`}>{sig.action.replace('skipped_', '')}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
