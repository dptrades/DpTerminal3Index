import type { VixRegime, VixRegimeState, BacktestBar } from './types';
import { getBarOnDate, sliceBarsUpTo } from './data-loader';

export function getVixRegimeForDate(vixBars: BacktestBar[], date: string): VixRegimeState {
    const bar = getBarOnDate(vixBars, date);
    const vixLevel = bar?.close || 18;

    let regime: VixRegime;
    let convictionBoost: number;
    let stopMultiplierAdj: number;
    let targetMultiplierAdj: number;

    if (vixLevel < 15) {
        regime = 'Low Vol';
        convictionBoost = 5;
        stopMultiplierAdj = 0.8;
        targetMultiplierAdj = 0.8;
    } else if (vixLevel <= 25) {
        regime = 'Normal';
        convictionBoost = 0;
        stopMultiplierAdj = 1.0;
        targetMultiplierAdj = 1.0;
    } else if (vixLevel <= 35) {
        regime = 'High Vol';
        convictionBoost = -5;
        stopMultiplierAdj = 1.3;
        targetMultiplierAdj = 1.5;
    } else {
        regime = 'Crisis';
        convictionBoost = -15;
        stopMultiplierAdj = 1.5;
        targetMultiplierAdj = 2.0;
    }

    return { vixLevel, regime, convictionBoost, stopMultiplierAdj, targetMultiplierAdj };
}

/**
 * Fix 1: Cash Mode — returns true when the market is in a confirmed downtrend
 * and volatility is elevated. No new entries should be taken.
 * Condition: VIX > 30 AND benchmark is below its 200-day EMA.
 */
export function isCashMode(vixBars: BacktestBar[], benchmarkBars: BacktestBar[], date: string): boolean {
    const vixBar = getBarOnDate(vixBars, date);
    const vixLevel = vixBar?.close || 18;

    if (vixLevel <= 30) return false;

    const slice = sliceBarsUpTo(benchmarkBars, date, 210);
    if (slice.length < 200) return false;

    const closes = slice.map(b => b.close);
    const ema200 = calcEma(closes, 200);
    const currentPrice = closes[closes.length - 1];

    return currentPrice < ema200;
}

function calcEma(values: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k);
    }
    return ema;
}
