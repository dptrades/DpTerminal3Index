const LOOKBACK = 20;
const MIN_WIN_RATE = 0.25;
const SUSPEND_DAYS = 30;

interface SymbolRecord {
    results: boolean[];  // true = win, false = loss (rolling window)
    suspendedUntil: string | null;
}

export class SymbolBlacklist {
    private records = new Map<string, SymbolRecord>();
    private _totalBlocked = 0;

    get totalBlocked(): number { return this._totalBlocked; }

    recordTrade(symbol: string, isWin: boolean, exitDate: string) {
        if (!this.records.has(symbol)) {
            this.records.set(symbol, { results: [], suspendedUntil: null });
        }
        const rec = this.records.get(symbol)!;
        rec.results.push(isWin);
        if (rec.results.length > LOOKBACK) {
            rec.results = rec.results.slice(-LOOKBACK);
        }

        // Check if symbol should be suspended
        if (rec.results.length >= LOOKBACK) {
            const wins = rec.results.filter(r => r).length;
            const winRate = wins / rec.results.length;
            if (winRate < MIN_WIN_RATE) {
                const suspendDate = new Date(exitDate);
                suspendDate.setDate(suspendDate.getDate() + SUSPEND_DAYS);
                rec.suspendedUntil = suspendDate.toISOString().slice(0, 10);
            }
        }
    }

    isBlacklisted(symbol: string, date: string): boolean {
        const rec = this.records.get(symbol);
        if (!rec || !rec.suspendedUntil) return false;
        if (date < rec.suspendedUntil) {
            this._totalBlocked++;
            return true;
        }
        // Suspension expired — clear it
        rec.suspendedUntil = null;
        return false;
    }

    getSymbolStats(): { symbol: string; trades: number; winRate: number; suspended: boolean }[] {
        const stats: { symbol: string; trades: number; winRate: number; suspended: boolean }[] = [];
        for (const [sym, rec] of this.records) {
            const wins = rec.results.filter(r => r).length;
            stats.push({
                symbol: sym,
                trades: rec.results.length,
                winRate: rec.results.length > 0 ? (wins / rec.results.length) * 100 : 0,
                suspended: rec.suspendedUntil !== null,
            });
        }
        return stats.sort((a, b) => a.winRate - b.winRate);
    }
}
