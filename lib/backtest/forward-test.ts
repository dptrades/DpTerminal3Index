import { fetchAlpacaBars } from '../alpaca';
import { fetchLivePrice } from '../market-data';
import { scanConviction, scanAlphaHunter } from '../conviction';
import { calculateIndicators, calculateConfluenceScore } from '../indicators';
import { saveToBlob, getFromBlob } from '../blob-storage';
import { getMarketSession } from '../refresh-utils';
import type { OHLCVData } from '../../types/financial';
import type { ConvictionStock } from '../../types/stock';
import { SECTOR_MAP } from '../constants';

const DATA_PATH = 'data/forward_test.json';

const CONFIG = {
    convictionThreshold: 60,
    stopAtrMultiple: 2.0,
    targetAtrMultiple: 3.0,
    maxHoldingDays: 30,
    riskPercent: 1.5,
    maxPositions: 6,
    maxPerSector: 2,
    maxNotional: 2000,
    initialBalance: 1000,
    cashModeVixThreshold: 30,
    blacklistLookback: 20,
    blacklistMinWinRate: 0.25,
    blacklistSuspendDays: 30,
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface FTPosition {
    symbol: string;
    qty: number;
    entryPrice: number;
    entryDate: string;
    stopLoss: number;
    takeProfit: number;
    sector: string;
    entryScore: number;
    entryReasons: string[];
    source: 'top_picks' | 'alpha_hunter' | 'both';
}

export interface FTTrade {
    symbol: string;
    qty: number;
    entryPrice: number;
    entryDate: string;
    exitPrice: number;
    exitDate: string;
    exitReason: 'stop' | 'target' | 'time_exit' | 'manual';
    pnl: number;
    pnlPercent: number;
    holdingDays: number;
    entryScore: number;
    sector: string;
    source: string;
}

export interface FTSignalLog {
    date: string;
    symbol: string;
    score: number;
    techScore: number;
    trend: string;
    reasons: string[];
    action: 'entered' | 'skipped_threshold' | 'skipped_bearish' | 'skipped_sector_cap' | 'skipped_max_positions' | 'skipped_blacklist' | 'skipped_cash_mode' | 'skipped_has_position' | 'skipped_no_cash';
    price: number;
    source: string;
}

export interface FTDailyLog {
    date: string;
    equity: number;
    cash: number;
    positionsValue: number;
    positionCount: number;
    cashMode: boolean;
    signalsGenerated: number;
    entriesExecuted: number;
    exitsExecuted: number;
    symbolsScanned: number;
    topPicksCount: number;
    alphaHunterCount: number;
}

export interface FTBlacklistEntry {
    results: boolean[];
    suspendedUntil: string | null;
}

export interface ForwardTestState {
    config: typeof CONFIG;
    startDate: string;
    account: {
        cash: number;
        equity: number;
        initialBalance: number;
    };
    positions: FTPosition[];
    trades: FTTrade[];
    signals: FTSignalLog[];
    dailyLog: FTDailyLog[];
    blacklist: Record<string, FTBlacklistEntry>;
    lastRunDate: string;
    totalRuns: number;
}

// ── State Management ────────────────────────────────────────────────────────

function createInitialState(): ForwardTestState {
    return {
        config: CONFIG,
        startDate: new Date().toISOString().slice(0, 10),
        account: {
            cash: CONFIG.initialBalance,
            equity: CONFIG.initialBalance,
            initialBalance: CONFIG.initialBalance,
        },
        positions: [],
        trades: [],
        signals: [],
        dailyLog: [],
        blacklist: {},
        lastRunDate: '',
        totalRuns: 0,
    };
}

export async function loadState(): Promise<ForwardTestState> {
    return getFromBlob<ForwardTestState>(DATA_PATH, createInitialState());
}

async function saveState(state: ForwardTestState): Promise<void> {
    await saveToBlob(DATA_PATH, state);
}

// ── Blacklist ───────────────────────────────────────────────────────────────

function isBlacklisted(state: ForwardTestState, symbol: string, date: string): boolean {
    const entry = state.blacklist[symbol];
    if (!entry || !entry.suspendedUntil) return false;
    return date < entry.suspendedUntil;
}

function recordTradeInBlacklist(state: ForwardTestState, symbol: string, isWin: boolean, exitDate: string): void {
    if (!state.blacklist[symbol]) {
        state.blacklist[symbol] = { results: [], suspendedUntil: null };
    }
    const entry = state.blacklist[symbol];
    entry.results.push(isWin);
    if (entry.results.length > CONFIG.blacklistLookback) {
        entry.results = entry.results.slice(-CONFIG.blacklistLookback);
    }
    if (entry.results.length >= CONFIG.blacklistLookback) {
        const winRate = entry.results.filter(r => r).length / entry.results.length;
        if (winRate < CONFIG.blacklistMinWinRate) {
            const d = new Date(exitDate);
            d.setDate(d.getDate() + CONFIG.blacklistSuspendDays);
            entry.suspendedUntil = d.toISOString().slice(0, 10);
        }
    }
}

// ── Cash Mode ───────────────────────────────────────────────────────────────

async function checkCashMode(): Promise<{ active: boolean; vix: number; spyBelow200: boolean }> {
    try {
        const vixData = await fetchLivePrice('^VIX').catch(() => null);
        const vix = (vixData as any)?.price || 18;

        if (vix <= CONFIG.cashModeVixThreshold) {
            return { active: false, vix, spyBelow200: false };
        }

        const spyBars = await fetchAlpacaBars('SPY', '1Day', 210);
        if (!spyBars || spyBars.length < 200) {
            return { active: false, vix, spyBelow200: false };
        }

        const closes = spyBars.map(b => b.c);
        const k = 2 / 201;
        let ema = closes[0];
        for (let i = 1; i < closes.length; i++) {
            ema = closes[i] * k + ema * (1 - k);
        }
        const spyBelow200 = closes[closes.length - 1] < ema;

        return { active: vix > CONFIG.cashModeVixThreshold && spyBelow200, vix, spyBelow200 };
    } catch (e) {
        console.error('[ForwardTest] Cash mode check failed:', e);
        return { active: false, vix: 18, spyBelow200: false };
    }
}

// ── Dynamic Symbol Discovery ────────────────────────────────────────────────

interface CandidateStock {
    symbol: string;
    convictionScore: number;  // from live scanner (4-factor)
    techScore: number;        // from backtest scorer (technical-only)
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    price: number;
    atr: number;
    reasons: string[];
    sector: string;
    source: 'top_picks' | 'alpha_hunter' | 'both';
}

async function discoverCandidates(): Promise<{ candidates: CandidateStock[]; topPicksCount: number; alphaHunterCount: number }> {
    console.log('[ForwardTest] Fetching live Top Picks and Alpha Hunter...');

    const [topPicks, alphaHunter] = await Promise.all([
        scanConviction(false, true).catch(e => { console.error('[ForwardTest] Top Picks scan failed:', e); return [] as ConvictionStock[]; }),
        scanAlphaHunter(false, true).catch(e => { console.error('[ForwardTest] Alpha Hunter scan failed:', e); return [] as ConvictionStock[]; }),
    ]);

    console.log(`[ForwardTest] Top Picks: ${topPicks.length} stocks, Alpha Hunter: ${alphaHunter.length} stocks`);

    // Merge and deduplicate — track source
    const symbolMap = new Map<string, { stock: ConvictionStock; source: 'top_picks' | 'alpha_hunter' | 'both' }>();

    for (const s of topPicks) {
        symbolMap.set(s.symbol, { stock: s, source: 'top_picks' });
    }
    for (const s of alphaHunter) {
        if (symbolMap.has(s.symbol)) {
            const existing = symbolMap.get(s.symbol)!;
            // Keep the higher score, mark as both
            if (s.score > existing.stock.score) {
                symbolMap.set(s.symbol, { stock: s, source: 'both' });
            } else {
                existing.source = 'both';
            }
        } else {
            symbolMap.set(s.symbol, { stock: s, source: 'alpha_hunter' });
        }
    }

    // Score each with the backtest technical scorer for apples-to-apples comparison
    const candidates: CandidateStock[] = [];
    let spy20dReturn = 0;
    try {
        const spyBars = await fetchAlpacaBars('SPY', '1Day', 25);
        if (spyBars && spyBars.length >= 21) {
            spy20dReturn = (spyBars[spyBars.length - 1].c / spyBars[spyBars.length - 21].c) - 1;
        }
    } catch (e) { /* fallback 0 */ }

    for (const [symbol, { stock, source }] of symbolMap) {
        // Use the conviction scanner's data but also compute our own technical score
        let techScore = 0;
        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = stock.metrics.trend;
        let reasons = [...stock.reasons];

        try {
            const bars = await fetchAlpacaBars(symbol, '1Day', 260);
            if (bars && bars.length >= 60) {
                const ohlcv: OHLCVData[] = bars.map(b => ({
                    time: new Date(b.t).getTime(), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
                }));
                const indicators = calculateIndicators(ohlcv);
                const latest = indicators[indicators.length - 1];
                if (latest && latest.rsi14 !== undefined) {
                    const confluence = calculateConfluenceScore(latest);
                    techScore = confluence.strength;
                    trend = confluence.trend;

                    const rsi = latest.rsi14 || 50;
                    if (rsi > 80) techScore = Math.max(0, techScore - 10);

                    if (bars.length >= 252) {
                        const high52w = Math.max(...bars.slice(-252).map(b => b.h));
                        if (high52w > 0 && latest.close >= high52w * 0.95) techScore = Math.min(100, techScore + 10);
                    }

                    if (bars.length >= 21 && spy20dReturn !== 0) {
                        const rel = (bars[bars.length - 1].c / bars[bars.length - 21].c) - 1 - spy20dReturn;
                        if (rel > 0.05) techScore = Math.min(100, techScore + 10);
                        else if (rel < -0.05) techScore = Math.max(0, techScore - 5);
                    }

                    reasons = confluence.trend === 'BULLISH'
                        ? confluence.bullSignals.slice(0, 4)
                        : confluence.bearSignals.slice(0, 4);
                }
            }
        } catch (e) {
            techScore = stock.technicalScore || 0;
        }

        const atr = stock.metrics.atr14 || (stock.price * 0.02);

        candidates.push({
            symbol,
            convictionScore: stock.score,
            techScore: Math.round(techScore),
            trend,
            price: stock.price,
            atr,
            reasons,
            sector: stock.sector || SECTOR_MAP[symbol] || 'Unknown',
            source,
        });
    }

    // Sort by technical score (what the backtest uses for entries)
    candidates.sort((a, b) => b.techScore - a.techScore);

    return { candidates, topPicksCount: topPicks.length, alphaHunterCount: alphaHunter.length };
}

// ── Main Run ────────────────────────────────────────────────────────────────

export async function runForwardTest(): Promise<{ state: ForwardTestState; summary: string }> {
    const state = await loadState();
    const today = new Date().toISOString().slice(0, 10);

    if (state.lastRunDate === today) {
        return { state, summary: `Already ran today (${today}). No action taken.` };
    }

    const session = getMarketSession();
    console.log(`[ForwardTest] Running for ${today}, session: ${session}, run #${state.totalRuns + 1}`);

    const logs: string[] = [];
    let entriesExecuted = 0;
    let exitsExecuted = 0;
    let symbolsScanned = 0;
    let topPicksCount = 0;
    let alphaHunterCount = 0;

    // ── Step 1: Check cash mode ──
    const cashMode = await checkCashMode();
    logs.push(`VIX: ${cashMode.vix.toFixed(1)}, SPY<200EMA: ${cashMode.spyBelow200}, Cash Mode: ${cashMode.active}`);

    // ── Step 2: Process exits on existing positions ──
    const toClose: { pos: FTPosition; price: number; reason: 'stop' | 'target' | 'time_exit' }[] = [];

    for (const pos of state.positions) {
        try {
            const liveData = await fetchLivePrice(pos.symbol);
            const price = (liveData as any)?.price || pos.entryPrice;

            if (price <= pos.stopLoss) {
                toClose.push({ pos, price: pos.stopLoss, reason: 'stop' });
                continue;
            }
            if (price >= pos.takeProfit) {
                toClose.push({ pos, price: pos.takeProfit, reason: 'target' });
                continue;
            }

            const daysHeld = Math.round((new Date(today).getTime() - new Date(pos.entryDate).getTime()) / (1000 * 3600 * 24));
            if (daysHeld >= CONFIG.maxHoldingDays) {
                toClose.push({ pos, price, reason: 'time_exit' });
            }
        } catch (e) {
            console.error(`[ForwardTest] Exit check failed for ${pos.symbol}:`, e);
        }
    }

    for (const { pos, price, reason } of toClose) {
        const pnl = (price - pos.entryPrice) * pos.qty;
        const pnlPct = ((price - pos.entryPrice) / pos.entryPrice) * 100;
        const holdDays = Math.round((new Date(today).getTime() - new Date(pos.entryDate).getTime()) / (1000 * 3600 * 24));

        state.trades.push({
            symbol: pos.symbol, qty: pos.qty, entryPrice: pos.entryPrice,
            entryDate: pos.entryDate, exitPrice: price, exitDate: today,
            exitReason: reason, pnl, pnlPercent: pnlPct,
            holdingDays: holdDays, entryScore: pos.entryScore, sector: pos.sector,
            source: pos.source,
        });
        state.account.cash += pos.qty * price;
        state.positions = state.positions.filter(p => p !== pos);
        recordTradeInBlacklist(state, pos.symbol, pnl > 0, today);
        exitsExecuted++;
        logs.push(`EXIT ${pos.symbol}: ${reason} @ $${price.toFixed(2)} | PnL: $${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%) | Source: ${pos.source}`);
    }

    // ── Step 3: Discover candidates from live scanners and enter ──

    if (!cashMode.active) {
        const { candidates, topPicksCount: tpc, alphaHunterCount: ahc } = await discoverCandidates();
        topPicksCount = tpc;
        alphaHunterCount = ahc;
        symbolsScanned = candidates.length;

        logs.push(`Scanned: ${symbolsScanned} unique symbols (${topPicksCount} Top Picks + ${alphaHunterCount} Alpha Hunter)`);

        for (const c of candidates) {
            let action: FTSignalLog['action'];

            if (state.positions.some(p => p.symbol === c.symbol)) {
                action = 'skipped_has_position';
            } else if (isBlacklisted(state, c.symbol, today)) {
                action = 'skipped_blacklist';
            } else if (c.trend !== 'BULLISH') {
                action = 'skipped_bearish';
            } else if (c.techScore < CONFIG.convictionThreshold) {
                action = 'skipped_threshold';
            } else if (state.positions.length >= CONFIG.maxPositions) {
                action = 'skipped_max_positions';
            } else {
                const sectorCount = state.positions.filter(p => p.sector === c.sector).length;
                if (sectorCount >= CONFIG.maxPerSector) {
                    action = 'skipped_sector_cap';
                } else {
                    // Calculate position size
                    const stopLoss = c.price - (c.atr * CONFIG.stopAtrMultiple);
                    const riskPerShare = c.price - stopLoss;
                    if (riskPerShare <= 0) { action = 'skipped_threshold'; } else {
                        const riskBudget = state.account.equity * (CONFIG.riskPercent / 100);
                        let qty = Math.floor(riskBudget / riskPerShare);
                        if (qty * c.price > CONFIG.maxNotional) qty = Math.floor(CONFIG.maxNotional / c.price);
                        if (qty * c.price > state.account.cash) qty = Math.floor(state.account.cash / c.price);

                        if (qty <= 0) {
                            action = 'skipped_no_cash';
                        } else {
                            action = 'entered';
                            const takeProfit = c.price + (c.atr * CONFIG.targetAtrMultiple);
                            state.account.cash -= qty * c.price;
                            state.positions.push({
                                symbol: c.symbol, qty, entryPrice: c.price,
                                entryDate: today, stopLoss, takeProfit,
                                sector: c.sector, entryScore: c.techScore,
                                entryReasons: c.reasons, source: c.source,
                            });
                            entriesExecuted++;
                            logs.push(`ENTRY ${c.symbol}: ${qty} shares @ $${c.price.toFixed(2)} | Tech:${c.techScore} Conv:${c.convictionScore} | Stop:$${stopLoss.toFixed(2)} Target:$${takeProfit.toFixed(2)} | ${c.source}`);
                        }
                    }
                }
            }

            state.signals.push({
                date: today, symbol: c.symbol, score: c.convictionScore,
                techScore: c.techScore, trend: c.trend, reasons: c.reasons,
                action, price: c.price, source: c.source,
            });
        }
    } else {
        logs.push('CASH MODE ACTIVE — no scanning, no new entries');
    }

    // ── Step 4: Calculate equity ──
    let positionsValue = 0;
    for (const pos of state.positions) {
        try {
            const liveData = await fetchLivePrice(pos.symbol);
            const price = (liveData as any)?.price || pos.entryPrice;
            positionsValue += pos.qty * price;
        } catch {
            positionsValue += pos.qty * pos.entryPrice;
        }
    }

    state.account.equity = state.account.cash + positionsValue;

    state.dailyLog.push({
        date: today, equity: state.account.equity, cash: state.account.cash,
        positionsValue, positionCount: state.positions.length,
        cashMode: cashMode.active, signalsGenerated: symbolsScanned,
        entriesExecuted, exitsExecuted, symbolsScanned,
        topPicksCount, alphaHunterCount,
    });

    state.lastRunDate = today;
    state.totalRuns++;

    await saveState(state);

    const returnPct = ((state.account.equity - CONFIG.initialBalance) / CONFIG.initialBalance) * 100;
    const summary = [
        `Forward Test Day ${state.totalRuns} (${today})`,
        `Equity: $${state.account.equity.toFixed(2)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%) | Cash: $${state.account.cash.toFixed(2)} | Positions: ${state.positions.length}`,
        `Universe: ${symbolsScanned} stocks (${topPicksCount} Top Picks + ${alphaHunterCount} Alpha Hunter)`,
        `Actions: ${entriesExecuted} entries, ${exitsExecuted} exits`,
        ...logs,
    ].join('\n');

    console.log(`[ForwardTest] ${summary}`);
    return { state, summary };
}

export async function resetForwardTest(): Promise<ForwardTestState> {
    const state = createInitialState();
    await saveState(state);
    return state;
}
