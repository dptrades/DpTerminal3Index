import { calculateIndicators, calculateConfluenceScore } from '../indicators';
import type { OHLCVData, IndicatorData } from '../../types/financial';
import type { BacktestBar } from './types';

export interface TechnicalScore {
    score: number;       // 0-100
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    rsi: number;
    atr: number;
    ema50: number | undefined;
    reasons: string[];
}

export function scoreTechnical(bars: BacktestBar[], spy20dReturn: number): TechnicalScore | null {
    if (bars.length < 60) return null;

    const ohlcv: OHLCVData[] = bars.map(b => ({
        time: b.time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
    }));

    const indicators = calculateIndicators(ohlcv);
    const latest = indicators[indicators.length - 1];

    if (!latest || latest.rsi14 === undefined) return null;

    const confluence = calculateConfluenceScore(latest);
    let techScore = confluence.strength;
    const trend = confluence.trend;
    const rsi = latest.rsi14 || 50;
    const reasons: string[] = [];

    if (confluence.trend === 'BULLISH') {
        reasons.push(...confluence.bullSignals.slice(0, 3));
    } else if (confluence.trend === 'BEARISH') {
        reasons.push(...confluence.bearSignals.slice(0, 3));
    }

    // Overbought penalty (same as live conviction.ts)
    if (rsi > 80) {
        techScore = Math.max(0, techScore - 10);
        reasons.push('RSI overbought penalty');
    }

    // 52-week high proximity bonus
    if (bars.length >= 252) {
        const high52w = Math.max(...bars.slice(-252).map(b => b.high));
        if (high52w > 0 && latest.close >= high52w * 0.95) {
            techScore = Math.min(100, techScore + 10);
            reasons.push('Near 52w high');
        }
    }

    // Relative strength vs SPY
    if (bars.length >= 21 && spy20dReturn !== 0) {
        const stock20dReturn = (bars[bars.length - 1].close / bars[bars.length - 21].close) - 1;
        const relStrength = stock20dReturn - spy20dReturn;
        if (relStrength > 0.05) {
            techScore = Math.min(100, techScore + 10);
            reasons.push('Outperforming SPY');
        } else if (relStrength < -0.05) {
            techScore = Math.max(0, techScore - 5);
            reasons.push('Underperforming SPY');
        }
    }

    const atr = latest.atr14 || (latest.close * 0.02);

    return {
        score: Math.round(techScore),
        trend,
        rsi,
        atr,
        ema50: latest.ema50,
        reasons,
    };
}
