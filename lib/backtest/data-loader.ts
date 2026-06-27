import { fetchAlpacaBars, type AlpacaBar } from '../alpaca';
import type { BacktestBar } from './types';

const barCache = new Map<string, BacktestBar[]>();

export async function loadHistoricalBars(
    symbol: string,
    forceRefresh = false
): Promise<BacktestBar[]> {
    const cacheKey = symbol;
    if (!forceRefresh && barCache.has(cacheKey)) {
        return barCache.get(cacheKey)!;
    }

    const raw = await fetchAlpacaBars(symbol, '1Day', 1500);
    if (!raw || raw.length === 0) {
        console.warn(`[Backtest] No data for ${symbol}`);
        return [];
    }

    const bars: BacktestBar[] = raw.map((b: AlpacaBar) => {
        const d = new Date(b.t);
        return {
            time: d.getTime(),
            date: d.toISOString().slice(0, 10),
            open: b.o,
            high: b.h,
            low: b.l,
            close: b.c,
            volume: b.v,
        };
    });

    barCache.set(cacheKey, bars);
    return bars;
}

export function sliceBarsUpTo(bars: BacktestBar[], date: string, lookback: number): BacktestBar[] {
    const idx = bars.findIndex(b => b.date > date);
    const end = idx === -1 ? bars.length : idx;
    const start = Math.max(0, end - lookback);
    return bars.slice(start, end);
}

export function getBarOnDate(bars: BacktestBar[], date: string): BacktestBar | null {
    return bars.find(b => b.date === date) || null;
}

export function getTradingDates(bars: BacktestBar[], startDate: string, endDate: string): string[] {
    return bars
        .filter(b => b.date >= startDate && b.date <= endDate)
        .map(b => b.date);
}

export function clearBarCache() {
    barCache.clear();
}
