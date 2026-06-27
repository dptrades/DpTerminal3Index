import type { EarningsZone, EarningsModifier, BacktestBar } from './types';
import { sliceBarsUpTo } from './data-loader';

/**
 * Detects approximate earnings dates from historical price data by finding
 * large gap-ups/downs on high volume (>1.5x avg). This is a point-in-time
 * safe proxy — no future data is used.
 *
 * Returns an array of dates (YYYY-MM-DD) where earnings likely occurred.
 */
export function detectEarningsDates(bars: BacktestBar[]): string[] {
    if (bars.length < 30) return [];

    const earningsDates: string[] = [];

    // Calculate rolling 20-day average volume
    for (let i = 20; i < bars.length; i++) {
        const avgVol = bars.slice(i - 20, i).reduce((s, b) => s + b.volume, 0) / 20;
        const bar = bars[i];
        const prevBar = bars[i - 1];

        // Earnings signature: >4% gap AND >1.5x average volume
        const gapPct = Math.abs((bar.open - prevBar.close) / prevBar.close);
        const volRatio = avgVol > 0 ? bar.volume / avgVol : 0;

        if (gapPct >= 0.04 && volRatio >= 1.5) {
            earningsDates.push(bar.date);
        }
    }

    // Deduplicate: keep only one per 60-day window (quarterly cadence)
    const filtered: string[] = [];
    for (const date of earningsDates) {
        const lastKept = filtered[filtered.length - 1];
        if (!lastKept) {
            filtered.push(date);
            continue;
        }
        const daysBetween = (new Date(date).getTime() - new Date(lastKept).getTime()) / (1000 * 3600 * 24);
        if (daysBetween >= 60) {
            filtered.push(date);
        }
    }

    return filtered;
}

/**
 * Projects the next likely earnings date based on past detected earnings.
 * Uses the quarterly cadence (~90 days) from the most recent detected date.
 */
function getNextEarningsEstimate(detectedDates: string[], currentDate: string): number {
    if (detectedDates.length === 0) return 999;

    const current = new Date(currentDate).getTime();

    // Find the most recent detected earnings before or on currentDate
    let lastEarnings: string | null = null;
    let nextEarnings: string | null = null;

    for (const d of detectedDates) {
        const t = new Date(d).getTime();
        if (t <= current) {
            lastEarnings = d;
        } else if (!nextEarnings) {
            nextEarnings = d;
        }
    }

    // If we have a known future earnings date in our data
    if (nextEarnings) {
        return Math.ceil((new Date(nextEarnings).getTime() - current) / (1000 * 3600 * 24));
    }

    // Otherwise project from last known + 90 days
    if (lastEarnings) {
        const projected = new Date(lastEarnings).getTime() + (90 * 24 * 3600 * 1000);
        const daysUntil = Math.ceil((projected - current) / (1000 * 3600 * 24));
        return Math.max(0, daysUntil);
    }

    return 999;
}

/**
 * Checks if the stock had a >5% move on its most recent earnings
 * (for post-earnings drift detection).
 */
function getPostEarningsDrift(bars: BacktestBar[], detectedDates: string[], currentDate: string): { isDrift: boolean; movePct: number } {
    const current = new Date(currentDate).getTime();

    for (let i = detectedDates.length - 1; i >= 0; i--) {
        const eDate = detectedDates[i];
        const eTime = new Date(eDate).getTime();
        const daysSince = (current - eTime) / (1000 * 3600 * 24);

        if (daysSince >= 1 && daysSince <= 3) {
            // Find the earnings bar and the bar before it
            const eBar = bars.find(b => b.date === eDate);
            const eIdx = bars.findIndex(b => b.date === eDate);
            if (eBar && eIdx > 0) {
                const prevBar = bars[eIdx - 1];
                const movePct = Math.abs((eBar.close - prevBar.close) / prevBar.close) * 100;
                if (movePct >= 5) {
                    return { isDrift: true, movePct };
                }
            }
            break;
        }
        if (daysSince > 3) break;
    }

    return { isDrift: false, movePct: 0 };
}

export function getEarningsModifier(
    bars: BacktestBar[],
    detectedDates: string[],
    currentDate: string
): EarningsModifier {
    const daysToEarnings = getNextEarningsEstimate(detectedDates, currentDate);
    const drift = getPostEarningsDrift(bars, detectedDates, currentDate);

    // Post-earnings drift opportunity (1-3 days after, >5% move)
    if (drift.isDrift) {
        return {
            zone: 'drift',
            daysToEarnings,
            positionSizeMultiplier: 1.0,
            confidenceFloor: 55,
            driftBonus: 5,
        };
    }

    // Red zone: 0-7 days before earnings — full blackout
    if (daysToEarnings >= 0 && daysToEarnings <= 7) {
        return {
            zone: 'red',
            daysToEarnings,
            positionSizeMultiplier: 0,
            confidenceFloor: 999, // effectively blocks entry
            driftBonus: 0,
        };
    }

    // Yellow zone: 7-14 days before earnings — reduced size, higher threshold
    if (daysToEarnings > 7 && daysToEarnings <= 14) {
        return {
            zone: 'yellow',
            daysToEarnings,
            positionSizeMultiplier: 0.5,
            confidenceFloor: 65,
            driftBonus: 0,
        };
    }

    // Green zone: >14 days — normal
    return {
        zone: 'green',
        daysToEarnings,
        positionSizeMultiplier: 1.0,
        confidenceFloor: 0,
        driftBonus: 0,
    };
}
