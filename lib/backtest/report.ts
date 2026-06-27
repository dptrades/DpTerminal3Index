import type { BacktestTrade, DailyEquityPoint, BacktestMetrics, BacktestConfig } from './types';

export function generateMetrics(
    config: BacktestConfig,
    trades: BacktestTrade[],
    equityCurve: DailyEquityPoint[]
): BacktestMetrics {
    const winners = trades.filter(t => t.pnl > 0);
    const losers = trades.filter(t => t.pnl <= 0);

    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));

    const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : config.initialBalance;
    const totalReturn = ((finalEquity - config.initialBalance) / config.initialBalance) * 100;

    // Benchmark return
    let benchmarkReturn = 0;
    if (equityCurve.length >= 2) {
        const firstBench = equityCurve[0].benchmarkValue;
        const lastBench = equityCurve[equityCurve.length - 1].benchmarkValue;
        if (firstBench > 0) {
            benchmarkReturn = ((lastBench - firstBench) / firstBench) * 100;
        }
    }

    // Max drawdown
    let maxDrawdown = 0;
    let maxDrawdownDate = '';
    for (const pt of equityCurve) {
        if (pt.drawdownPct > maxDrawdown) {
            maxDrawdown = pt.drawdownPct;
            maxDrawdownDate = pt.date;
        }
    }

    // Sharpe ratio (daily returns, annualized)
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
        const prev = equityCurve[i - 1].equity;
        const curr = equityCurve[i].equity;
        if (prev > 0) dailyReturns.push((curr - prev) / prev);
    }
    let sharpeRatio = 0;
    if (dailyReturns.length > 1) {
        const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
        const stdDev = Math.sqrt(variance);
        if (stdDev > 0) {
            sharpeRatio = (mean / stdDev) * Math.sqrt(252);
        }
    }

    // Monthly returns
    const monthlyMap = new Map<string, { start: number; end: number; benchStart: number; benchEnd: number }>();
    for (const pt of equityCurve) {
        const month = pt.date.slice(0, 7);
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { start: pt.equity, end: pt.equity, benchStart: pt.benchmarkValue, benchEnd: pt.benchmarkValue });
        } else {
            monthlyMap.get(month)!.end = pt.equity;
            monthlyMap.get(month)!.benchEnd = pt.benchmarkValue;
        }
    }
    const monthlyReturns = Array.from(monthlyMap.entries()).map(([month, v]) => ({
        month,
        return: v.start > 0 ? ((v.end - v.start) / v.start) * 100 : 0,
        benchReturn: v.benchStart > 0 ? ((v.benchEnd - v.benchStart) / v.benchStart) * 100 : 0,
    }));

    // Sector breakdown
    const sectorMap = new Map<string, { trades: number; pnl: number; wins: number }>();
    for (const t of trades) {
        const sec = t.sector || 'Unknown';
        if (!sectorMap.has(sec)) sectorMap.set(sec, { trades: 0, pnl: 0, wins: 0 });
        const entry = sectorMap.get(sec)!;
        entry.trades++;
        entry.pnl += t.pnl;
        if (t.pnl > 0) entry.wins++;
    }
    const sectorBreakdown = Array.from(sectorMap.entries())
        .map(([sector, v]) => ({
            sector,
            trades: v.trades,
            pnl: v.pnl,
            winRate: v.trades > 0 ? (v.wins / v.trades) * 100 : 0,
        }))
        .sort((a, b) => b.pnl - a.pnl);

    // VIX regime breakdown
    const vixMap = new Map<string, { trades: number; pnl: number; wins: number }>();
    for (const t of trades) {
        const regime = t.vixRegime || 'Unknown';
        if (!vixMap.has(regime)) vixMap.set(regime, { trades: 0, pnl: 0, wins: 0 });
        const entry = vixMap.get(regime)!;
        entry.trades++;
        entry.pnl += t.pnl;
        if (t.pnl > 0) entry.wins++;
    }
    const vixRegimeBreakdown = Array.from(vixMap.entries())
        .map(([regime, v]) => ({
            regime,
            trades: v.trades,
            pnl: v.pnl,
            winRate: v.trades > 0 ? (v.wins / v.trades) * 100 : 0,
        }))
        .sort((a, b) => b.pnl - a.pnl);

    // Earnings zone breakdown
    const earningsMap = new Map<string, { trades: number; pnl: number; wins: number; blocked: number }>();
    for (const t of trades) {
        const zone = t.earningsZone || 'green';
        if (!earningsMap.has(zone)) earningsMap.set(zone, { trades: 0, pnl: 0, wins: 0, blocked: 0 });
        const entry = earningsMap.get(zone)!;
        entry.trades++;
        entry.pnl += t.pnl;
        if (t.pnl > 0) entry.wins++;
    }
    const earningsZoneBreakdown = Array.from(earningsMap.entries())
        .map(([zone, v]) => ({
            zone,
            trades: v.trades,
            pnl: v.pnl,
            winRate: v.trades > 0 ? (v.wins / v.trades) * 100 : 0,
            blocked: v.blocked,
        }))
        .sort((a, b) => b.pnl - a.pnl);

    const sortedByPnl = [...trades].sort((a, b) => b.pnl - a.pnl);

    return {
        totalReturn,
        benchmarkReturn,
        excessReturn: totalReturn - benchmarkReturn,
        sharpeRatio,
        maxDrawdown,
        maxDrawdownDate,
        winRate: trades.length > 0 ? (winners.length / trades.length) * 100 : 0,
        totalTrades: trades.length,
        avgWinner: winners.length > 0 ? grossProfit / winners.length : 0,
        avgLoser: losers.length > 0 ? grossLoss / losers.length : 0,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
        avgHoldingDays: trades.length > 0 ? trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length : 0,
        bestTrade: sortedByPnl.length > 0 ? sortedByPnl[0] : null,
        worstTrade: sortedByPnl.length > 0 ? sortedByPnl[sortedByPnl.length - 1] : null,
        monthlyReturns,
        sectorBreakdown,
        vixRegimeBreakdown,
        earningsZoneBreakdown,
    };
}
