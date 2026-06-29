import { getAccount, getPositions, getOrders, submitMarketBuy, submitMarketSell, getLatestPrice, isMarketOpen, type AlpacaAccount, type AlpacaPosition, type AlpacaOrder } from '../alpaca-trading';
import { scanConviction, scanAlphaHunter } from '../conviction';
import { calculateIndicators, calculateConfluenceScore } from '../indicators';
import { fetchAlpacaBars } from '../alpaca';
import { fetchLivePrice } from '../market-data';
import { saveToBlob, getFromBlob } from '../blob-storage';
import type { OHLCVData } from '../../types/financial';
import type { ConvictionStock } from '../../types/stock';
import { SECTOR_MAP } from '../constants';

const DATA_PATH = 'data/alpaca_paper_test.json';

const CONFIG = {
    convictionThreshold: 60,
    stopAtrMultiple: 2.0,
    targetAtrMultiple: 3.0,
    maxHoldingDays: 30,
    riskPercent: 1.5,
    maxPositions: 6,
    maxPerSector: 2,
    cashModeVixThreshold: 30,
    scaleOut1Pct: 0.30,
    scaleOut2Pct: 0.30,
    trailingStopAtr: 1.5,
    blacklistLookback: 20,
    blacklistMinWinRate: 0.25,
    blacklistSuspendDays: 30,
    maxCapital: 1000,
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface APPosition {
    symbol: string;
    qty: number;
    entryPrice: number;
    entryDate: string;
    stopLoss: number;
    sector: string;
    entryScore: number;
    source: string;
    atr: number;
    originalQty: number;
    scaleLevel: number;
    highWaterMark: number;
    alpacaOrderId?: string;
}

export interface APTrade {
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
    source: string;
    alpacaFillPrice?: number;
    slippage?: number;
}

export interface APSignalLog {
    date: string;
    symbol: string;
    techScore: number;
    convScore: number;
    trend: string;
    action: string;
    price: number;
    source: string;
    alpacaOrderId?: string;
}

export interface APDailyLog {
    date: string;
    equity: number;
    alpacaEquity: number;
    cash: number;
    positionCount: number;
    symbolsScanned: number;
    entries: number;
    exits: number;
}

export interface APBlacklistEntry {
    results: boolean[];
    suspendedUntil: string | null;
}

export interface AlpacaPaperState {
    config: typeof CONFIG;
    startDate: string;
    account: { equity: number; cash: number; initialBalance: number };
    positions: APPosition[];
    trades: APTrade[];
    signals: APSignalLog[];
    dailyLog: APDailyLog[];
    blacklist: Record<string, APBlacklistEntry>;
    lastRunDate: string;
    totalRuns: number;
}

// ── State ───────────────────────────────────────────────────────────────────

function createInitialState(): AlpacaPaperState {
    return {
        config: CONFIG, startDate: new Date().toISOString().slice(0, 10),
        account: { equity: 0, cash: 0, initialBalance: 0 },
        positions: [], trades: [], signals: [], dailyLog: [],
        blacklist: {}, lastRunDate: '', totalRuns: 0,
    };
}

export async function loadAlpacaState(): Promise<AlpacaPaperState> {
    return getFromBlob<AlpacaPaperState>(DATA_PATH, createInitialState());
}

async function saveAlpacaState(state: AlpacaPaperState): Promise<void> {
    await saveToBlob(DATA_PATH, state);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isBlacklisted(state: AlpacaPaperState, symbol: string, date: string): boolean {
    const e = state.blacklist[symbol];
    if (!e || !e.suspendedUntil) return false;
    return date < e.suspendedUntil;
}

function recordTrade(state: AlpacaPaperState, symbol: string, isWin: boolean, date: string): void {
    if (!state.blacklist[symbol]) state.blacklist[symbol] = { results: [], suspendedUntil: null };
    const e = state.blacklist[symbol];
    e.results.push(isWin);
    if (e.results.length > CONFIG.blacklistLookback) e.results = e.results.slice(-CONFIG.blacklistLookback);
    if (e.results.length >= CONFIG.blacklistLookback) {
        const wr = e.results.filter(r => r).length / e.results.length;
        if (wr < CONFIG.blacklistMinWinRate) {
            const d = new Date(date); d.setDate(d.getDate() + CONFIG.blacklistSuspendDays);
            e.suspendedUntil = d.toISOString().slice(0, 10);
        }
    }
}

async function checkCashMode(): Promise<{ active: boolean; vix: number }> {
    try {
        const vixData = await fetchLivePrice('^VIX').catch(() => null);
        const vix = (vixData as any)?.price || 18;
        if (vix <= CONFIG.cashModeVixThreshold) return { active: false, vix };
        const spyBars = await fetchAlpacaBars('SPY', '1Day', 210);
        if (!spyBars || spyBars.length < 200) return { active: false, vix };
        const closes = spyBars.map(b => b.c);
        const k = 2 / 201; let ema = closes[0];
        for (let i = 1; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
        return { active: closes[closes.length - 1] < ema, vix };
    } catch { return { active: false, vix: 18 }; }
}

async function scoreTechnical(symbol: string, spy20dReturn: number): Promise<{ score: number; trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; atr: number; reasons: string[]; price: number } | null> {
    try {
        const bars = await fetchAlpacaBars(symbol, '1Day', 260);
        if (!bars || bars.length < 60) return null;
        const ohlcv: OHLCVData[] = bars.map(b => ({ time: new Date(b.t).getTime(), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
        const indicators = calculateIndicators(ohlcv);
        const latest = indicators[indicators.length - 1];
        if (!latest || latest.rsi14 === undefined) return null;
        const conf = calculateConfluenceScore(latest);
        let score = conf.strength;
        const rsi = latest.rsi14 || 50;
        const reasons: string[] = conf.trend === 'BULLISH' ? conf.bullSignals.slice(0, 3) : conf.bearSignals.slice(0, 3);
        if (rsi > 80) score = Math.max(0, score - 10);
        if (bars.length >= 252) { const h = Math.max(...bars.slice(-252).map(b => b.h)); if (h > 0 && latest.close >= h * 0.95) score = Math.min(100, score + 10); }
        if (bars.length >= 21 && spy20dReturn !== 0) { const rel = (bars[bars.length - 1].c / bars[bars.length - 21].c) - 1 - spy20dReturn; if (rel > 0.05) score = Math.min(100, score + 10); else if (rel < -0.05) score = Math.max(0, score - 5); }
        return { score: Math.round(score), trend: conf.trend, atr: latest.atr14 || (latest.close * 0.02), reasons, price: latest.close };
    } catch { return null; }
}

// ── Main Run ────────────────────────────────────────────────────────────────

export async function runAlpacaPaper(): Promise<{ state: AlpacaPaperState; summary: string }> {
    const state = await loadAlpacaState();
    const today = new Date().toISOString().slice(0, 10);

    if (state.lastRunDate === today) {
        return { state, summary: `Already ran today (${today}).` };
    }

    // Sync with Alpaca account
    const acct = await getAccount();
    if (!acct) return { state, summary: 'ERROR: Could not connect to Alpaca. Check API keys.' };

    const rawEquity = parseFloat(acct.equity);
    const rawCash = parseFloat(acct.cash);

    // Cap usable capital to maxCapital + any unrealized gains from our positions
    const positionsValue = state.positions.reduce((sum, p) => sum + p.qty * p.entryPrice, 0);
    const alpacaEquity = Math.min(rawEquity, CONFIG.maxCapital + positionsValue);
    const alpacaCash = Math.min(rawCash, CONFIG.maxCapital - positionsValue);

    if (state.totalRuns === 0) {
        state.account.initialBalance = CONFIG.maxCapital;
        state.startDate = today;
    }
    state.account.equity = Math.min(alpacaEquity, CONFIG.maxCapital + positionsValue);
    state.account.cash = Math.max(0, alpacaCash);

    const logs: string[] = [];
    let entries = 0, exits = 0;

    logs.push(`Alpaca Account: $${alpacaEquity.toFixed(2)} equity, $${alpacaCash.toFixed(2)} cash`);

    // ── Check cash mode ──
    const cashMode = await checkCashMode();
    logs.push(`VIX: ${cashMode.vix.toFixed(1)}, Cash Mode: ${cashMode.active}`);

    // ── Process exits on tracked positions ──
    const alpacaPositions = await getPositions();
    const alpacaSymbols = new Set(alpacaPositions.map(p => p.symbol));

    for (const pos of [...state.positions]) {
        const price = await getLatestPrice(pos.symbol);
        if (!price) continue;

        if (price > pos.highWaterMark) pos.highWaterMark = price;

        const atr = pos.atr;
        let exitReason: string | null = null;
        let exitPrice = price;
        let sellQty = pos.qty;
        let isPartial = false;

        // Stop / trailing stop
        if (price <= pos.stopLoss) {
            exitReason = pos.scaleLevel >= 2 ? 'trail_stop' : 'stop';
        }
        // Scale 1
        else if (pos.scaleLevel === 0 && price >= pos.entryPrice + atr) {
            sellQty = Math.max(1, Math.floor(pos.originalQty * CONFIG.scaleOut1Pct));
            if (sellQty < pos.qty) {
                exitReason = 'scale_1'; isPartial = true; exitPrice = pos.entryPrice + atr;
            } else { exitReason = 'scale_1'; }
        }
        // Scale 2
        else if (pos.scaleLevel === 1 && price >= pos.entryPrice + (atr * 2)) {
            sellQty = Math.max(1, Math.floor(pos.originalQty * CONFIG.scaleOut2Pct));
            if (sellQty < pos.qty) {
                exitReason = 'scale_2'; isPartial = true; exitPrice = pos.entryPrice + (atr * 2);
            } else { exitReason = 'scale_2'; }
        }
        // Trailing stop update
        else if (pos.scaleLevel >= 2) {
            const trail = pos.highWaterMark - (atr * CONFIG.trailingStopAtr);
            if (trail > pos.stopLoss) pos.stopLoss = trail;
        }
        // Time exit
        if (!exitReason) {
            const days = Math.round((new Date(today).getTime() - new Date(pos.entryDate).getTime()) / (1000 * 3600 * 24));
            if (days >= CONFIG.maxHoldingDays) exitReason = 'time_exit';
        }

        if (exitReason) {
            // Execute sell on Alpaca
            const order = await submitMarketSell(pos.symbol, sellQty);
            const fillPrice = order ? parseFloat(order.filled_avg_price || '0') || exitPrice : exitPrice;

            const pnl = (fillPrice - pos.entryPrice) * sellQty;
            const pnlPct = ((fillPrice - pos.entryPrice) / pos.entryPrice) * 100;
            const holdDays = Math.round((new Date(today).getTime() - new Date(pos.entryDate).getTime()) / (1000 * 3600 * 24));

            state.trades.push({
                symbol: pos.symbol, qty: sellQty, entryPrice: pos.entryPrice,
                entryDate: pos.entryDate, exitPrice: fillPrice, exitDate: today,
                exitReason, pnl, pnlPercent: pnlPct, holdingDays: holdDays,
                entryScore: pos.entryScore, sector: pos.sector, source: pos.source,
                alpacaFillPrice: fillPrice, slippage: Math.abs(fillPrice - exitPrice),
            });

            if (isPartial) {
                pos.qty -= sellQty;
                pos.stopLoss = exitReason === 'scale_1' ? pos.entryPrice : pos.entryPrice + atr;
                pos.scaleLevel += 1;
                logs.push(`SCALE ${pos.symbol}: ${exitReason} — sold ${sellQty} @ $${fillPrice.toFixed(2)} | PnL: $${pnl.toFixed(2)} | ${pos.qty} remain`);
            } else {
                state.positions = state.positions.filter(p => p !== pos);
                recordTrade(state, pos.symbol, pnl > 0, today);
                logs.push(`EXIT ${pos.symbol}: ${exitReason} — sold ${sellQty} @ $${fillPrice.toFixed(2)} | PnL: $${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)`);
            }
            exits++;
        }
    }

    state.positions = state.positions.filter(p => p.qty > 0);

    // ── Discover and enter new positions ──
    if (!cashMode.active) {
        const [topPicks, alphaHunter] = await Promise.all([
            scanConviction(false, true).catch(() => [] as ConvictionStock[]),
            scanAlphaHunter(false, true).catch(() => [] as ConvictionStock[]),
        ]);

        const symMap = new Map<string, { stock: ConvictionStock; source: string }>();
        for (const s of topPicks) symMap.set(s.symbol, { stock: s, source: 'top_picks' });
        for (const s of alphaHunter) {
            if (symMap.has(s.symbol)) symMap.get(s.symbol)!.source = 'both';
            else symMap.set(s.symbol, { stock: s, source: 'alpha_hunter' });
        }

        logs.push(`Scanned: ${symMap.size} unique (${topPicks.length} TP + ${alphaHunter.length} AH)`);

        let spy20d = 0;
        try { const sb = await fetchAlpacaBars('SPY', '1Day', 25); if (sb && sb.length >= 21) spy20d = (sb[sb.length - 1].c / sb[sb.length - 21].c) - 1; } catch {}

        const scored: { symbol: string; techScore: number; convScore: number; trend: string; price: number; atr: number; reasons: string[]; sector: string; source: string }[] = [];

        for (const [sym, { stock, source }] of symMap) {
            if (state.positions.some(p => p.symbol === sym)) continue;
            if (isBlacklisted(state, sym, today)) continue;

            const tech = await scoreTechnical(sym, spy20d);
            if (!tech) continue;

            const action = tech.trend !== 'BULLISH' ? 'skipped_bearish' :
                tech.score < CONFIG.convictionThreshold ? 'skipped_threshold' :
                state.positions.length >= CONFIG.maxPositions ? 'skipped_max_positions' : 'qualify';

            state.signals.push({ date: today, symbol: sym, techScore: tech.score, convScore: stock.score, trend: tech.trend, action, price: tech.price, source });

            if (action === 'qualify') {
                const sector = stock.sector || SECTOR_MAP[sym] || 'Unknown';
                const sectorCount = state.positions.filter(p => p.sector === sector).length;
                if (sectorCount < CONFIG.maxPerSector) {
                    scored.push({ symbol: sym, techScore: tech.score, convScore: stock.score, trend: tech.trend, price: tech.price, atr: tech.atr, reasons: tech.reasons, sector, source });
                }
            }
        }

        scored.sort((a, b) => b.techScore - a.techScore);

        for (const c of scored) {
            if (state.positions.length >= CONFIG.maxPositions) break;

            const stopLoss = c.price - (c.atr * CONFIG.stopAtrMultiple);
            const riskPerShare = c.price - stopLoss;
            if (riskPerShare <= 0) continue;

            const cappedEquity = Math.min(alpacaEquity, CONFIG.maxCapital);
            const riskBudget = cappedEquity * (CONFIG.riskPercent / 100);
            let qty = Math.floor(riskBudget / riskPerShare);
            const availableCash = Math.max(0, Math.min(alpacaCash, CONFIG.maxCapital - positionsValue));
            if (qty * c.price > availableCash) qty = Math.floor(availableCash / c.price);
            if (qty <= 0) continue;

            // Execute buy on Alpaca
            const order = await submitMarketBuy(c.symbol, qty);
            if (!order) { logs.push(`FAILED ${c.symbol}: Alpaca order rejected`); continue; }

            const fillPrice = parseFloat(order.filled_avg_price || '0') || c.price;

            state.positions.push({
                symbol: c.symbol, qty, entryPrice: fillPrice, entryDate: today,
                stopLoss: fillPrice - (c.atr * CONFIG.stopAtrMultiple),
                sector: c.sector, entryScore: c.techScore, source: c.source,
                atr: c.atr, originalQty: qty, scaleLevel: 0, highWaterMark: fillPrice,
                alpacaOrderId: order.id,
            });
            entries++;
            logs.push(`ENTRY ${c.symbol}: ${qty} @ $${fillPrice.toFixed(2)} (slippage: $${Math.abs(fillPrice - c.price).toFixed(3)}) | Score:${c.techScore} | ${c.source}`);
        }
    } else {
        logs.push('CASH MODE — no entries');
    }

    // ── Sync equity — track only our capped slice ──
    const acctAfter = await getAccount();
    const alpacaPositionsAfter = await getPositions();
    let ourPositionsValue = 0;
    for (const pos of state.positions) {
        const ap = alpacaPositionsAfter.find(p => p.symbol === pos.symbol);
        if (ap) {
            ourPositionsValue += pos.qty * parseFloat(ap.current_price);
        } else {
            ourPositionsValue += pos.qty * pos.entryPrice;
        }
    }
    const cappedCash = CONFIG.maxCapital - state.positions.reduce((sum, p) => sum + p.qty * p.entryPrice, 0);
    const trades_pnl = state.trades.reduce((sum, t) => sum + t.pnl, 0);
    state.account.equity = CONFIG.maxCapital + trades_pnl + (ourPositionsValue - state.positions.reduce((sum, p) => sum + p.qty * p.entryPrice, 0));
    state.account.cash = Math.max(0, state.account.equity - ourPositionsValue);

    const returnPct = state.account.initialBalance > 0 ? ((state.account.equity - state.account.initialBalance) / state.account.initialBalance) * 100 : 0;

    state.dailyLog.push({
        date: today, equity: state.account.equity, alpacaEquity: parseFloat(acctAfter?.equity || '0'),
        cash: state.account.cash, positionCount: state.positions.length,
        symbolsScanned: state.signals.filter(s => s.date === today).length,
        entries, exits,
    });

    state.lastRunDate = today;
    state.totalRuns++;
    await saveAlpacaState(state);

    const summary = [
        `Alpaca Paper Trade Day ${state.totalRuns} (${today})`,
        `Equity: $${state.account.equity.toFixed(2)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%) | Positions: ${state.positions.length}`,
        `Actions: ${entries} entries, ${exits} exits`,
        ...logs,
    ].join('\n');

    return { state, summary };
}

export async function resetAlpacaPaper(): Promise<AlpacaPaperState> {
    const state = createInitialState();
    const acct = await getAccount();
    if (acct) {
        state.account.initialBalance = parseFloat(acct.equity);
        state.account.equity = parseFloat(acct.equity);
        state.account.cash = parseFloat(acct.cash);
    }
    await saveAlpacaState(state);
    return state;
}
