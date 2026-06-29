import { fetchLivePrice } from '../market-data';
import { submitMarketSell } from '../alpaca-trading';
import { getMarketSession } from '../refresh-utils';
import { saveToBlob, getFromBlob } from '../blob-storage';
import type { ForwardTestState } from './forward-test';
import type { AlpacaPaperState } from './alpaca-paper';

const FT_PATH = 'data/forward_test.json';
const AP_PATH = 'data/alpaca_paper_test.json';

interface ExitAction {
    symbol: string;
    qty: number;
    reason: string;
    price: number;
    system: 'forward_test' | 'alpaca';
}

export async function runExitMonitor(): Promise<{ actions: ExitAction[]; summary: string }> {
    const session = getMarketSession();
    if (session !== 'REG') {
        return { actions: [], summary: `Market not open (${session}). Skipping.` };
    }

    const actions: ExitAction[] = [];
    const logs: string[] = [];
    const now = new Date().toISOString().slice(0, 10);

    // ── Forward Test Exits ──
    const ft = await getFromBlob<ForwardTestState>(FT_PATH, null as any);
    if (ft && ft.positions.length > 0) {
        let ftChanged = false;

        for (const pos of [...ft.positions]) {
            try {
                const liveData = await fetchLivePrice(pos.symbol);
                const price = (liveData as any)?.price;
                if (!price) continue;

                const atr = pos.atr || (pos.entryPrice * 0.02);

                // Update high water mark
                if (price > pos.highWaterMark) {
                    pos.highWaterMark = price;
                    ftChanged = true;
                }

                // Trailing stop update (after scale 2)
                if (pos.scaleLevel >= 2) {
                    const trail = pos.highWaterMark - (atr * 1.5);
                    if (trail > pos.stopLoss) {
                        pos.stopLoss = trail;
                        ftChanged = true;
                    }
                }

                // Stop hit
                if (price <= pos.stopLoss) {
                    const reason = pos.scaleLevel >= 2 ? 'trail_stop' : 'stop';
                    const pnl = (pos.stopLoss - pos.entryPrice) * pos.qty;
                    ft.trades.push({
                        symbol: pos.symbol, qty: pos.qty, entryPrice: pos.entryPrice,
                        entryDate: pos.entryDate, exitPrice: pos.stopLoss, exitDate: now,
                        exitReason: reason, pnl, pnlPercent: ((pos.stopLoss - pos.entryPrice) / pos.entryPrice) * 100,
                        holdingDays: Math.round((Date.now() - new Date(pos.entryDate).getTime()) / (1000 * 3600 * 24)),
                        entryScore: pos.entryScore, sector: pos.sector, source: pos.source,
                    });
                    ft.account.cash += pos.qty * pos.stopLoss;
                    ft.positions = ft.positions.filter(p => p !== pos);
                    ftChanged = true;
                    actions.push({ symbol: pos.symbol, qty: pos.qty, reason, price: pos.stopLoss, system: 'forward_test' });
                    logs.push(`FT EXIT ${pos.symbol}: ${reason} @ $${pos.stopLoss.toFixed(2)} | PnL: $${pnl.toFixed(2)}`);
                    continue;
                }

                // Scale 1
                const scale1Price = pos.entryPrice + atr;
                if (pos.scaleLevel === 0 && price >= scale1Price) {
                    const sellQty = Math.max(1, Math.floor(pos.originalQty * 0.30));
                    if (sellQty < pos.qty) {
                        const pnl = (scale1Price - pos.entryPrice) * sellQty;
                        ft.trades.push({
                            symbol: pos.symbol, qty: sellQty, entryPrice: pos.entryPrice,
                            entryDate: pos.entryDate, exitPrice: scale1Price, exitDate: now,
                            exitReason: 'scale_1', pnl, pnlPercent: ((scale1Price - pos.entryPrice) / pos.entryPrice) * 100,
                            holdingDays: Math.round((Date.now() - new Date(pos.entryDate).getTime()) / (1000 * 3600 * 24)),
                            entryScore: pos.entryScore, sector: pos.sector, source: pos.source,
                        });
                        ft.account.cash += sellQty * scale1Price;
                        pos.qty -= sellQty;
                        pos.stopLoss = pos.entryPrice;
                        pos.scaleLevel = 1;
                        ftChanged = true;
                        actions.push({ symbol: pos.symbol, qty: sellQty, reason: 'scale_1', price: scale1Price, system: 'forward_test' });
                        logs.push(`FT SCALE1 ${pos.symbol}: sold ${sellQty} @ $${scale1Price.toFixed(2)} | stop → breakeven`);
                    }
                    continue;
                }

                // Scale 2
                const scale2Price = pos.entryPrice + (atr * 2);
                if (pos.scaleLevel === 1 && price >= scale2Price) {
                    const sellQty = Math.max(1, Math.floor(pos.originalQty * 0.30));
                    if (sellQty < pos.qty) {
                        const pnl = (scale2Price - pos.entryPrice) * sellQty;
                        ft.trades.push({
                            symbol: pos.symbol, qty: sellQty, entryPrice: pos.entryPrice,
                            entryDate: pos.entryDate, exitPrice: scale2Price, exitDate: now,
                            exitReason: 'scale_2', pnl, pnlPercent: ((scale2Price - pos.entryPrice) / pos.entryPrice) * 100,
                            holdingDays: Math.round((Date.now() - new Date(pos.entryDate).getTime()) / (1000 * 3600 * 24)),
                            entryScore: pos.entryScore, sector: pos.sector, source: pos.source,
                        });
                        ft.account.cash += sellQty * scale2Price;
                        pos.qty -= sellQty;
                        pos.stopLoss = scale1Price;
                        pos.scaleLevel = 2;
                        ftChanged = true;
                        actions.push({ symbol: pos.symbol, qty: sellQty, reason: 'scale_2', price: scale2Price, system: 'forward_test' });
                        logs.push(`FT SCALE2 ${pos.symbol}: sold ${sellQty} @ $${scale2Price.toFixed(2)} | stop → $${scale1Price.toFixed(2)}`);
                    }
                    continue;
                }
            } catch (e) {
                console.error(`[ExitMonitor] FT check failed for ${pos.symbol}:`, e);
            }
        }

        ft.positions = ft.positions.filter(p => p.qty > 0);
        if (ftChanged) await saveToBlob(FT_PATH, ft);
    }

    // ── Alpaca Paper Exits ──
    const ap = await getFromBlob<AlpacaPaperState>(AP_PATH, null as any);
    if (ap && ap.positions.length > 0) {
        let apChanged = false;

        for (const pos of [...ap.positions]) {
            try {
                const liveData = await fetchLivePrice(pos.symbol);
                const price = (liveData as any)?.price;
                if (!price) continue;

                const atr = pos.atr || (pos.entryPrice * 0.02);

                if (price > pos.highWaterMark) {
                    pos.highWaterMark = price;
                    apChanged = true;
                }

                if (pos.scaleLevel >= 2) {
                    const trail = pos.highWaterMark - (atr * 1.5);
                    if (trail > pos.stopLoss) {
                        pos.stopLoss = trail;
                        apChanged = true;
                    }
                }

                let exitReason: string | null = null;
                let sellQty = pos.qty;
                let exitPrice = price;
                let isPartial = false;
                let newStop = pos.stopLoss;

                if (price <= pos.stopLoss) {
                    exitReason = pos.scaleLevel >= 2 ? 'trail_stop' : 'stop';
                    exitPrice = pos.stopLoss;
                } else if (pos.scaleLevel === 0 && price >= pos.entryPrice + atr) {
                    sellQty = Math.max(1, Math.floor(pos.originalQty * 0.30));
                    if (sellQty < pos.qty) {
                        exitReason = 'scale_1'; isPartial = true;
                        exitPrice = pos.entryPrice + atr;
                        newStop = pos.entryPrice;
                    }
                } else if (pos.scaleLevel === 1 && price >= pos.entryPrice + (atr * 2)) {
                    sellQty = Math.max(1, Math.floor(pos.originalQty * 0.30));
                    if (sellQty < pos.qty) {
                        exitReason = 'scale_2'; isPartial = true;
                        exitPrice = pos.entryPrice + (atr * 2);
                        newStop = pos.entryPrice + atr;
                    }
                }

                if (exitReason) {
                    // Place real sell on Alpaca
                    const order = await submitMarketSell(pos.symbol, sellQty);
                    const fillPrice = order?.filled_avg_price ? parseFloat(order.filled_avg_price) : exitPrice;

                    const pnl = (fillPrice - pos.entryPrice) * sellQty;
                    ap.trades.push({
                        symbol: pos.symbol, qty: sellQty, entryPrice: pos.entryPrice,
                        entryDate: pos.entryDate, exitPrice: fillPrice, exitDate: now,
                        exitReason, pnl, pnlPercent: ((fillPrice - pos.entryPrice) / pos.entryPrice) * 100,
                        holdingDays: Math.round((Date.now() - new Date(pos.entryDate).getTime()) / (1000 * 3600 * 24)),
                        entryScore: pos.entryScore, sector: pos.sector, source: pos.source,
                        alpacaFillPrice: fillPrice, slippage: Math.abs(fillPrice - exitPrice),
                    });

                    if (isPartial) {
                        pos.qty -= sellQty;
                        pos.stopLoss = newStop;
                        pos.scaleLevel += 1;
                    } else {
                        ap.account.cash += pos.qty * fillPrice;
                        ap.positions = ap.positions.filter(p => p !== pos);
                    }
                    apChanged = true;
                    actions.push({ symbol: pos.symbol, qty: sellQty, reason: exitReason, price: fillPrice, system: 'alpaca' });
                    logs.push(`AP ${exitReason.toUpperCase()} ${pos.symbol}: ${sellQty} @ $${fillPrice.toFixed(2)} | PnL: $${pnl.toFixed(2)}`);
                }
            } catch (e) {
                console.error(`[ExitMonitor] AP check failed for ${pos.symbol}:`, e);
            }
        }

        ap.positions = ap.positions.filter(p => p.qty > 0);
        if (apChanged) await saveToBlob(AP_PATH, ap);
    }

    const ftCount = ft?.positions.length || 0;
    const apCount = ap?.positions.length || 0;
    const summary = actions.length > 0
        ? `Exit Monitor: ${actions.length} action(s) executed\n` + logs.join('\n')
        : `Exit Monitor: No exits triggered. Checked ${ftCount} FT + ${apCount} AP positions.`;

    console.log(`[ExitMonitor] ${summary}`);
    return { actions, summary };
}
