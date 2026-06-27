import type { BacktestConfig, BacktestResult, BacktestBar } from './types';
import { loadHistoricalBars, sliceBarsUpTo, getBarOnDate, getTradingDates, clearBarCache } from './data-loader';
import { scoreTechnical, type TechnicalScore } from './scorer';
import { PortfolioSimulator } from './portfolio-sim';
import { generateMetrics } from './report';
import { getVixRegimeForDate, isCashMode } from './vix-regime';
import { detectEarningsDates, getEarningsModifier } from './earnings-zone';
import { SymbolBlacklist } from './symbol-blacklist';
import { SECTOR_MAP } from '../constants';

const INDICATOR_LOOKBACK = 260;
const SCAN_BATCH_SIZE = 15;
const SCAN_BATCH_DELAY_MS = 500;

declare global {
    var _backtestResults: Map<string, BacktestResult> | undefined;
}
if (!global._backtestResults) global._backtestResults = new Map();

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const DEFAULT_CONFIG: BacktestConfig = {
    startDate: '2024-01-01',
    endDate: '2025-06-20',
    initialBalance: 10000,
    maxPositions: 6,
    maxPerSector: 2,
    riskPerTrade: 100,
    riskPercent: 1.5,            // Fix 6: 1.5% of equity per trade
    maxNotionalPerTrade: 2000,
    convictionThreshold: 60,
    stopAtrMultiple: 2.0,        // Fix 3: widened from 1.5 to 2.0
    target1AtrMultiple: 3.0,
    maxHoldingDays: 30,          // Fix 3: force exit after 30 trading days
    symbols: [],
    benchmark: 'SPY',
    enableVixRegime: true,
    enableEarningsZones: true,
    enableCashMode: true,        // Fix 1: go flat in bear + high vol
    enableSymbolBlacklist: true,  // Fix 2: suspend repeat losers
    scanDaily: true,              // Fix 4: scan every trading day
};

const TOP_BACKTEST_SYMBOLS = [
    'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA',
    'AVGO', 'LLY', 'UNH', 'V', 'JPM', 'XOM', 'WMT', 'MA',
    'JNJ', 'PG', 'HD', 'COST', 'ABBV', 'MRK', 'KO', 'PEP',
    'BAC', 'CSCO', 'AMD', 'NFLX', 'CRM', 'ADBE', 'DIS',
    'CAT', 'GE', 'UBER', 'ISRG', 'INTU',
    'GS', 'MS', 'COP', 'NEE', 'LMT', 'BA',
    'PANW', 'CRWD', 'PLTR', 'COIN', 'HOOD',
    'BKNG', 'CMG', 'LOW', 'TJX',
];

export async function runBacktest(config: Partial<BacktestConfig> = {}): Promise<BacktestResult> {
    const cfg: BacktestConfig = { ...DEFAULT_CONFIG, ...config };
    if (cfg.symbols.length === 0) cfg.symbols = TOP_BACKTEST_SYMBOLS;

    const id = `bt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result: BacktestResult = {
        id,
        config: cfg,
        metrics: {} as any,
        equityCurve: [],
        trades: [],
        startedAt: new Date().toISOString(),
        completedAt: '',
        status: 'running',
        progress: 0,
    };
    global._backtestResults!.set(id, result);

    try {
        console.log(`[Backtest ${id}] Starting: ${cfg.startDate} -> ${cfg.endDate}, ${cfg.symbols.length} symbols`);
        console.log(`[Backtest ${id}] VIX Regime: ${cfg.enableVixRegime ? 'ON' : 'OFF'}, Earnings Zones: ${cfg.enableEarningsZones ? 'ON' : 'OFF'}, Cash Mode: ${cfg.enableCashMode ? 'ON' : 'OFF'}`);
        console.log(`[Backtest ${id}] Stop: ${cfg.stopAtrMultiple}x ATR, Target: ${cfg.target1AtrMultiple}x ATR, Max Hold: ${cfg.maxHoldingDays || 'unlimited'} days, Risk: ${cfg.riskPercent > 0 ? cfg.riskPercent + '% equity' : '$' + cfg.riskPerTrade + ' fixed'}`);

        // Load all historical data upfront
        const allBars = new Map<string, BacktestBar[]>();

        for (let i = 0; i < cfg.symbols.length; i += SCAN_BATCH_SIZE) {
            const batch = cfg.symbols.slice(i, i + SCAN_BATCH_SIZE);
            const promises = batch.map(async (sym) => {
                const bars = await loadHistoricalBars(sym);
                if (bars.length > 0) allBars.set(sym, bars);
            });
            await Promise.all(promises);
            if (i + SCAN_BATCH_SIZE < cfg.symbols.length) await sleep(SCAN_BATCH_DELAY_MS);
        }

        // Load benchmark
        const benchmarkBars = await loadHistoricalBars(cfg.benchmark);
        if (benchmarkBars.length === 0) {
            throw new Error(`No benchmark data for ${cfg.benchmark}`);
        }

        // Phase 2: Load VIX historical data
        let vixBars: BacktestBar[] = [];
        if (cfg.enableVixRegime) {
            // VIX is not available via Alpaca stock bars, so use ^VIX proxy via VIXY ETF
            // For backtest purposes we use the benchmark's volatility as proxy
            // Actually, let's try loading VIXY (VIX short-term futures ETF) as a proxy
            vixBars = await loadHistoricalBars('VIXY').catch(() => []);
            if (vixBars.length === 0) {
                // Fallback: synthesize VIX from SPY realized vol
                console.log(`[Backtest ${id}] VIXY not available, synthesizing VIX from SPY realized vol`);
                vixBars = synthesizeVixFromBenchmark(benchmarkBars);
            }
            console.log(`[Backtest ${id}] VIX data loaded: ${vixBars.length} bars`);
        }

        // Phase 3: Pre-detect earnings dates for all symbols
        const earningsMap = new Map<string, string[]>();
        if (cfg.enableEarningsZones) {
            let earningsCount = 0;
            for (const [sym, bars] of allBars) {
                const dates = detectEarningsDates(bars);
                earningsMap.set(sym, dates);
                earningsCount += dates.length;
            }
            console.log(`[Backtest ${id}] Detected ${earningsCount} earnings events across ${earningsMap.size} symbols`);
        }

        const tradingDates = getTradingDates(benchmarkBars, cfg.startDate, cfg.endDate);
        if (tradingDates.length === 0) {
            throw new Error(`No trading dates in range ${cfg.startDate} - ${cfg.endDate}`);
        }

        console.log(`[Backtest ${id}] Data loaded. ${allBars.size} symbols, ${tradingDates.length} trading days`);

        const sim = new PortfolioSimulator(cfg);
        const benchStart = getBarOnDate(benchmarkBars, tradingDates[0])?.close || 1;

        let earningsBlocked = 0;
        let earningsReduced = 0;
        let driftEntries = 0;
        let cashModeDays = 0;
        let blacklistBlocked = 0;
        const blacklist = new SymbolBlacklist();

        for (let dayIdx = 0; dayIdx < tradingDates.length; dayIdx++) {
            const date = tradingDates[dayIdx];
            result.progress = Math.round((dayIdx / tradingDates.length) * 100);

            // Phase 2: Get current VIX regime
            const vixState = cfg.enableVixRegime
                ? getVixRegimeForDate(vixBars, date)
                : undefined;

            const benchBar = getBarOnDate(benchmarkBars, date);
            const benchValue = benchBar
                ? (benchBar.close / benchStart) * cfg.initialBalance
                : (sim.equityCurve.length > 0 ? sim.equityCurve[sim.equityCurve.length - 1].benchmarkValue : cfg.initialBalance);

            const tradeCountBefore = sim.trades.length;
            sim.processDay(date, (sym) => {
                const bars = allBars.get(sym);
                return bars ? getBarOnDate(bars, date) : null;
            }, benchValue, vixState?.regime);

            // Fix 2: Feed newly closed trades into the blacklist
            if (cfg.enableSymbolBlacklist) {
                for (let ti = tradeCountBefore; ti < sim.trades.length; ti++) {
                    const t = sim.trades[ti];
                    blacklist.recordTrade(t.symbol, t.pnl > 0, t.exitDate);
                }
            }

            // Fix 1: Cash mode — skip all entries when VIX>30 AND benchmark below 200 EMA
            const inCashMode = cfg.enableCashMode && cfg.enableVixRegime
                ? isCashMode(vixBars, benchmarkBars, date)
                : false;
            if (inCashMode) cashModeDays++;

            // Fix 4: Scan frequency — daily or Monday-only
            const dayOfWeek = new Date(date).getDay();
            const isRebalanceDay = cfg.scanDaily ? true : (dayOfWeek === 1 || dayIdx === 0);

            if (isRebalanceDay && !inCashMode && sim.positionCount < cfg.maxPositions) {
                const spySlice = sliceBarsUpTo(benchmarkBars, date, 25);
                let spy20dReturn = 0;
                if (spySlice.length >= 21) {
                    spy20dReturn = (spySlice[spySlice.length - 1].close / spySlice[spySlice.length - 21].close) - 1;
                }

                // Phase 2: Adjust conviction threshold based on VIX regime
                const effectiveThreshold = cfg.convictionThreshold + (vixState?.convictionBoost || 0);

                const scored: {
                    symbol: string;
                    score: TechnicalScore;
                    bar: BacktestBar;
                    earningsZone?: 'green' | 'yellow' | 'red' | 'drift';
                    positionSizeMultiplier?: number;
                    driftBonus?: number;
                }[] = [];

                for (const sym of cfg.symbols) {
                    if (sim.hasPosition(sym)) continue;

                    // Fix 2: Skip blacklisted symbols
                    if (cfg.enableSymbolBlacklist && blacklist.isBlacklisted(sym, date)) {
                        blacklistBlocked++;
                        continue;
                    }

                    const bars = allBars.get(sym);
                    if (!bars) continue;

                    const slice = sliceBarsUpTo(bars, date, INDICATOR_LOOKBACK);
                    if (slice.length < 60) continue;

                    const todayBar = getBarOnDate(bars, date);
                    if (!todayBar) continue;

                    const techScore = scoreTechnical(slice, spy20dReturn);
                    if (!techScore) continue;

                    // Phase 3: Check earnings zone
                    let earningsZone: 'green' | 'yellow' | 'red' | 'drift' = 'green';
                    let positionSizeMultiplier = 1.0;
                    let driftBonus = 0;
                    let earningsConfidenceFloor = 0;

                    if (cfg.enableEarningsZones) {
                        const detectedDates = earningsMap.get(sym) || [];
                        const modifier = getEarningsModifier(bars, detectedDates, date);
                        earningsZone = modifier.zone;
                        positionSizeMultiplier = modifier.positionSizeMultiplier;
                        driftBonus = modifier.driftBonus;
                        earningsConfidenceFloor = modifier.confidenceFloor;

                        if (modifier.zone === 'red') {
                            earningsBlocked++;
                            continue; // Skip entirely
                        }
                        if (modifier.zone === 'yellow') {
                            earningsReduced++;
                        }
                        if (modifier.zone === 'drift') {
                            driftEntries++;
                        }
                    }

                    // Apply drift bonus to score
                    const adjustedScore = techScore.score + driftBonus;

                    // Check against effective threshold AND earnings confidence floor
                    const minScore = Math.max(effectiveThreshold, earningsConfidenceFloor);
                    if (adjustedScore >= minScore && techScore.trend === 'BULLISH') {
                        scored.push({
                            symbol: sym,
                            score: { ...techScore, score: adjustedScore },
                            bar: todayBar,
                            earningsZone,
                            positionSizeMultiplier,
                            driftBonus,
                        });
                    }
                }

                scored.sort((a, b) => b.score.score - a.score.score);

                const nextDayIdx = dayIdx + 1;
                if (nextDayIdx < tradingDates.length) {
                    const entryDate = tradingDates[nextDayIdx];

                    for (const candidate of scored) {
                        if (sim.positionCount >= cfg.maxPositions) break;

                        const sector = SECTOR_MAP[candidate.symbol] || 'Unknown';
                        if (!sim.canEnter(sector)) continue;

                        const entryBars = allBars.get(candidate.symbol);
                        if (!entryBars) continue;
                        const entryBar = getBarOnDate(entryBars, entryDate);
                        if (!entryBar) continue;

                        const entryPrice = entryBar.open;
                        const reason = candidate.score.reasons.join(', ');

                        sim.enter(
                            candidate.symbol,
                            entryPrice,
                            entryDate,
                            candidate.score.atr,
                            sector,
                            candidate.score.score,
                            reason,
                            {
                                stopMultiplierAdj: vixState?.stopMultiplierAdj,
                                targetMultiplierAdj: vixState?.targetMultiplierAdj,
                                positionSizeMultiplier: candidate.positionSizeMultiplier,
                                vixRegime: vixState?.regime,
                                earningsZone: candidate.earningsZone,
                            }
                        );
                    }
                }
            }
        }

        // Close all remaining positions
        const lastDate = tradingDates[tradingDates.length - 1];
        sim.closeAllPositions(lastDate, (sym) => {
            const bars = allBars.get(sym);
            return bars ? getBarOnDate(bars, lastDate) : null;
        });

        const metrics = generateMetrics(cfg, sim.trades, sim.equityCurve);

        result.metrics = metrics;
        result.equityCurve = sim.equityCurve;
        result.trades = sim.trades;
        result.status = 'completed';
        result.completedAt = new Date().toISOString();
        result.progress = 100;

        console.log(`[Backtest ${id}] Complete. ${sim.trades.length} trades, Return: ${metrics.totalReturn.toFixed(2)}%`);
        if (cfg.enableCashMode) {
            console.log(`[Backtest ${id}] Cash Mode: ${cashModeDays} days in cash (no entries)`);
        }
        if (cfg.enableSymbolBlacklist) {
            console.log(`[Backtest ${id}] Blacklist: ${blacklistBlocked} entry attempts blocked`);
            const stats = blacklist.getSymbolStats();
            for (const s of stats) {
                if (s.suspended || s.winRate < 25) {
                    console.log(`[Backtest ${id}]   ${s.symbol}: ${s.trades} trades, WR ${s.winRate.toFixed(0)}%${s.suspended ? ' [SUSPENDED]' : ''}`);
                }
            }
        }
        if (cfg.enableEarningsZones) {
            console.log(`[Backtest ${id}] Earnings: ${earningsBlocked} blocked (red), ${earningsReduced} reduced (yellow), ${driftEntries} drift entries`);
        }
        if (cfg.enableVixRegime && metrics.vixRegimeBreakdown) {
            for (const r of metrics.vixRegimeBreakdown) {
                console.log(`[Backtest ${id}] VIX ${r.regime}: ${r.trades} trades, PnL $${r.pnl.toFixed(2)}, WR ${r.winRate.toFixed(0)}%`);
            }
        }

        clearBarCache();
        return result;
    } catch (err: any) {
        result.status = 'failed';
        result.error = err.message;
        result.completedAt = new Date().toISOString();
        console.error(`[Backtest ${id}] Failed:`, err);
        clearBarCache();
        return result;
    }
}

/**
 * Synthesizes a VIX-like level from SPY realized volatility.
 * Uses 20-day rolling standard deviation of returns, annualized.
 */
function synthesizeVixFromBenchmark(spyBars: BacktestBar[]): BacktestBar[] {
    const result: BacktestBar[] = [];
    for (let i = 20; i < spyBars.length; i++) {
        const returns: number[] = [];
        for (let j = i - 19; j <= i; j++) {
            returns.push((spyBars[j].close - spyBars[j - 1].close) / spyBars[j - 1].close);
        }
        const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
        const annualizedVol = Math.sqrt(variance) * Math.sqrt(252) * 100;

        result.push({
            time: spyBars[i].time,
            date: spyBars[i].date,
            open: annualizedVol,
            high: annualizedVol,
            low: annualizedVol,
            close: annualizedVol,
            volume: 0,
        });
    }
    return result;
}

export function getBacktestResult(id: string): BacktestResult | null {
    return global._backtestResults?.get(id) || null;
}

export function getAllBacktestResults(): BacktestResult[] {
    return Array.from(global._backtestResults?.values() || []).sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
}
