import type { BacktestConfig, BacktestPosition, BacktestTrade, DailyEquityPoint, BacktestBar, VixRegime, EarningsZone } from './types';

export class PortfolioSimulator {
    cash: number;
    positions: BacktestPosition[] = [];
    trades: BacktestTrade[] = [];
    equityCurve: DailyEquityPoint[] = [];
    peakEquity: number;
    private config: BacktestConfig;

    constructor(config: BacktestConfig) {
        this.config = config;
        this.cash = config.initialBalance;
        this.peakEquity = config.initialBalance;
    }

    get positionCount(): number {
        return this.positions.length;
    }

    get currentEquity(): number {
        if (this.equityCurve.length === 0) return this.cash;
        return this.equityCurve[this.equityCurve.length - 1].equity;
    }

    sectorCount(sector: string): number {
        return this.positions.filter(p => p.sector === sector).length;
    }

    hasPosition(symbol: string): boolean {
        return this.positions.some(p => p.symbol === symbol);
    }

    canEnter(sector: string): boolean {
        if (this.positions.length >= this.config.maxPositions) return false;
        if (this.sectorCount(sector) >= this.config.maxPerSector) return false;
        return true;
    }

    private getRiskBudget(): number {
        if (this.config.riskPercent > 0) {
            return this.currentEquity * (this.config.riskPercent / 100);
        }
        return this.config.riskPerTrade;
    }

    calculatePositionSize(entryPrice: number, stopPrice: number): number {
        const riskPerShare = Math.abs(entryPrice - stopPrice);
        if (riskPerShare <= 0) return 0;

        const riskBudget = this.getRiskBudget();
        let qty = Math.floor(riskBudget / riskPerShare);
        const notional = qty * entryPrice;
        if (notional > this.config.maxNotionalPerTrade) {
            qty = Math.floor(this.config.maxNotionalPerTrade / entryPrice);
        }
        if (qty * entryPrice > this.cash) {
            qty = Math.floor(this.cash / entryPrice);
        }
        return Math.max(0, qty);
    }

    enter(
        symbol: string,
        entryPrice: number,
        entryDate: string,
        atr: number,
        sector: string,
        score: number,
        reason: string,
        opts?: {
            stopMultiplierAdj?: number;
            targetMultiplierAdj?: number;
            positionSizeMultiplier?: number;
            vixRegime?: VixRegime;
            earningsZone?: EarningsZone;
        }
    ): boolean {
        const stopMult = this.config.stopAtrMultiple * (opts?.stopMultiplierAdj || 1);
        const targetMult = this.config.target1AtrMultiple * (opts?.targetMultiplierAdj || 1);
        const stopLoss = entryPrice - (atr * stopMult);
        const takeProfit = entryPrice + (atr * targetMult);

        let qty = this.calculatePositionSize(entryPrice, stopLoss);
        if (opts?.positionSizeMultiplier !== undefined && opts.positionSizeMultiplier < 1) {
            qty = Math.floor(qty * opts.positionSizeMultiplier);
        }

        if (qty <= 0) return false;

        const cost = qty * entryPrice;
        if (cost > this.cash) return false;

        this.cash -= cost;
        this.positions.push({
            symbol, qty, entryPrice, entryDate, stopLoss, takeProfit,
            sector, entryScore: score, entryReason: reason,
            earningsZone: opts?.earningsZone,
            positionSizeMultiplier: opts?.positionSizeMultiplier,
            atr, originalQty: qty, scaleLevel: 0, highWaterMark: entryPrice,
        });
        return true;
    }

    processDay(date: string, getPriceBar: (symbol: string) => BacktestBar | null, benchmarkClose: number, vixRegime?: VixRegime) {
        if (this.config.enableScaleOut) {
            this.processDayScaleOut(date, getPriceBar, benchmarkClose, vixRegime);
        } else {
            this.processDayClassic(date, getPriceBar, benchmarkClose, vixRegime);
        }
    }

    private processDayClassic(date: string, getPriceBar: (symbol: string) => BacktestBar | null, benchmarkClose: number, vixRegime?: VixRegime) {
        const toClose: { pos: BacktestPosition; exitPrice: number; reason: 'stop' | 'target' | 'time_exit' }[] = [];

        for (const pos of this.positions) {
            const bar = getPriceBar(pos.symbol);
            if (!bar) continue;

            if (bar.low <= pos.stopLoss) {
                toClose.push({ pos, exitPrice: pos.stopLoss, reason: 'stop' });
                continue;
            }
            if (bar.high >= pos.takeProfit) {
                toClose.push({ pos, exitPrice: pos.takeProfit, reason: 'target' });
                continue;
            }
            if (this.config.maxHoldingDays > 0) {
                const daysHeld = Math.round((new Date(date).getTime() - new Date(pos.entryDate).getTime()) / (1000 * 60 * 60 * 24));
                if (daysHeld >= this.config.maxHoldingDays) {
                    toClose.push({ pos, exitPrice: bar.close, reason: 'time_exit' });
                }
            }
        }

        for (const { pos, exitPrice, reason } of toClose) {
            this.closePosition(pos, exitPrice, date, reason, vixRegime);
        }

        this.recordEquity(date, getPriceBar, benchmarkClose);
    }

    private processDayScaleOut(date: string, getPriceBar: (symbol: string) => BacktestBar | null, benchmarkClose: number, vixRegime?: VixRegime) {
        const toClose: { pos: BacktestPosition; exitPrice: number; reason: BacktestTrade['exitReason'] }[] = [];
        const toPartialClose: { pos: BacktestPosition; price: number; sellQty: number; reason: 'scale_1' | 'scale_2'; newStopLoss: number }[] = [];

        for (const pos of this.positions) {
            const bar = getPriceBar(pos.symbol);
            if (!bar) continue;

            const atr = pos.atr || (pos.entryPrice * 0.02);

            // Update high water mark
            if (bar.high > (pos.highWaterMark || pos.entryPrice)) {
                pos.highWaterMark = bar.high;
            }

            // Check stop-loss / trailing stop (low of day)
            if (bar.low <= pos.stopLoss) {
                const reason: BacktestTrade['exitReason'] = (pos.scaleLevel || 0) >= 2 ? 'trail_stop' : 'stop';
                toClose.push({ pos, exitPrice: pos.stopLoss, reason });
                continue;
            }

            // Scale-out level 1: price reaches entry + 1x ATR
            const scale1Price = pos.entryPrice + atr;
            if ((pos.scaleLevel || 0) === 0 && bar.high >= scale1Price) {
                const sellQty = Math.max(1, Math.floor((pos.originalQty || pos.qty) * this.config.scaleOut1Pct));
                if (sellQty < pos.qty) {
                    toPartialClose.push({
                        pos, price: scale1Price, sellQty, reason: 'scale_1',
                        newStopLoss: pos.entryPrice, // move stop to breakeven
                    });
                } else {
                    toClose.push({ pos, exitPrice: scale1Price, reason: 'scale_1' });
                }
                continue;
            }

            // Scale-out level 2: price reaches entry + 2x ATR
            const scale2Price = pos.entryPrice + (atr * 2);
            if ((pos.scaleLevel || 0) === 1 && bar.high >= scale2Price) {
                const sellQty = Math.max(1, Math.floor((pos.originalQty || pos.qty) * this.config.scaleOut2Pct));
                if (sellQty < pos.qty) {
                    toPartialClose.push({
                        pos, price: scale2Price, sellQty, reason: 'scale_2',
                        newStopLoss: scale1Price, // move stop to scale 1 level
                    });
                } else {
                    toClose.push({ pos, exitPrice: scale2Price, reason: 'scale_2' });
                }
                continue;
            }

            // Trailing stop for remaining shares (after scale 2)
            if ((pos.scaleLevel || 0) >= 2) {
                const trailStop = (pos.highWaterMark || pos.entryPrice) - (atr * this.config.trailingStopAtr);
                if (trailStop > pos.stopLoss) {
                    pos.stopLoss = trailStop;
                }
            }

            // Time exit still applies
            if (this.config.maxHoldingDays > 0) {
                const daysHeld = Math.round((new Date(date).getTime() - new Date(pos.entryDate).getTime()) / (1000 * 60 * 60 * 24));
                if (daysHeld >= this.config.maxHoldingDays) {
                    toClose.push({ pos, exitPrice: bar.close, reason: 'time_exit' });
                }
            }
        }

        // Process partial closes (scale-outs)
        for (const { pos, price, sellQty, reason, newStopLoss } of toPartialClose) {
            const pnl = (price - pos.entryPrice) * sellQty;
            const pnlPercent = ((price - pos.entryPrice) / pos.entryPrice) * 100;
            const holdingDays = Math.round((new Date(date).getTime() - new Date(pos.entryDate).getTime()) / (1000 * 60 * 60 * 24));

            this.trades.push({
                symbol: pos.symbol, side: 'buy', qty: sellQty,
                entryPrice: pos.entryPrice, entryDate: pos.entryDate,
                exitPrice: price, exitDate: date, exitReason: reason,
                pnl, pnlPercent, holdingDays,
                entryScore: pos.entryScore, sector: pos.sector,
                vixRegime, earningsZone: pos.earningsZone,
            });

            this.cash += sellQty * price;
            pos.qty -= sellQty;
            pos.stopLoss = newStopLoss;
            pos.scaleLevel = (pos.scaleLevel || 0) + 1;
        }

        // Process full closes
        for (const { pos, exitPrice, reason } of toClose) {
            this.closePosition(pos, exitPrice, date, reason, vixRegime);
        }

        // Remove positions with 0 qty (shouldn't happen, safety check)
        this.positions = this.positions.filter(p => p.qty > 0);

        this.recordEquity(date, getPriceBar, benchmarkClose);
    }

    private recordEquity(date: string, getPriceBar: (symbol: string) => BacktestBar | null, benchmarkClose: number) {
        let positionsValue = 0;
        for (const pos of this.positions) {
            const bar = getPriceBar(pos.symbol);
            const price = bar ? bar.close : pos.entryPrice;
            positionsValue += pos.qty * price;
        }

        const equity = this.cash + positionsValue;
        if (equity > this.peakEquity) this.peakEquity = equity;
        const drawdownPct = this.peakEquity > 0 ? ((this.peakEquity - equity) / this.peakEquity) * 100 : 0;

        this.equityCurve.push({
            date, equity, cash: this.cash, positionsValue,
            positionCount: this.positions.length,
            benchmarkValue: benchmarkClose, drawdownPct,
        });
    }

    closePosition(pos: BacktestPosition, exitPrice: number, exitDate: string, reason: BacktestTrade['exitReason'], vixRegime?: VixRegime) {
        const pnl = (exitPrice - pos.entryPrice) * pos.qty;
        const pnlPercent = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
        const holdingDays = Math.round((new Date(exitDate).getTime() - new Date(pos.entryDate).getTime()) / (1000 * 60 * 60 * 24));

        this.trades.push({
            symbol: pos.symbol, side: 'buy', qty: pos.qty,
            entryPrice: pos.entryPrice, entryDate: pos.entryDate,
            exitPrice, exitDate, exitReason: reason,
            pnl, pnlPercent, holdingDays,
            entryScore: pos.entryScore, sector: pos.sector,
            vixRegime, earningsZone: pos.earningsZone,
        });

        this.cash += pos.qty * exitPrice;
        this.positions = this.positions.filter(p => p !== pos);
    }

    closeAllPositions(date: string, getPriceBar: (symbol: string) => BacktestBar | null) {
        const remaining = [...this.positions];
        for (const pos of remaining) {
            const bar = getPriceBar(pos.symbol);
            const exitPrice = bar ? bar.close : pos.entryPrice;
            this.closePosition(pos, exitPrice, date, 'end_of_test');
        }
    }
}
