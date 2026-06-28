import { NextRequest, NextResponse } from 'next/server';
import { runBacktest, DEFAULT_CONFIG } from '@/lib/backtest/engine';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));

        const config = {
            startDate: body.startDate || DEFAULT_CONFIG.startDate,
            endDate: body.endDate || DEFAULT_CONFIG.endDate,
            initialBalance: body.initialBalance || DEFAULT_CONFIG.initialBalance,
            maxPositions: body.maxPositions || DEFAULT_CONFIG.maxPositions,
            maxPerSector: body.maxPerSector || DEFAULT_CONFIG.maxPerSector,
            riskPerTrade: body.riskPerTrade || DEFAULT_CONFIG.riskPerTrade,
            riskPercent: body.riskPercent ?? DEFAULT_CONFIG.riskPercent,
            maxNotionalPerTrade: body.maxNotionalPerTrade || DEFAULT_CONFIG.maxNotionalPerTrade,
            convictionThreshold: body.convictionThreshold || DEFAULT_CONFIG.convictionThreshold,
            stopAtrMultiple: body.stopAtrMultiple || DEFAULT_CONFIG.stopAtrMultiple,
            target1AtrMultiple: body.target1AtrMultiple || DEFAULT_CONFIG.target1AtrMultiple,
            maxHoldingDays: body.maxHoldingDays ?? DEFAULT_CONFIG.maxHoldingDays,
            symbols: body.symbols || [],
            benchmark: body.benchmark || DEFAULT_CONFIG.benchmark,
            enableVixRegime: body.enableVixRegime ?? DEFAULT_CONFIG.enableVixRegime,
            enableEarningsZones: body.enableEarningsZones ?? DEFAULT_CONFIG.enableEarningsZones,
            enableCashMode: body.enableCashMode ?? DEFAULT_CONFIG.enableCashMode,
            enableSymbolBlacklist: body.enableSymbolBlacklist ?? DEFAULT_CONFIG.enableSymbolBlacklist,
            scanDaily: body.scanDaily ?? DEFAULT_CONFIG.scanDaily,
            enableScaleOut: body.enableScaleOut ?? DEFAULT_CONFIG.enableScaleOut,
            scaleOut1Pct: body.scaleOut1Pct ?? DEFAULT_CONFIG.scaleOut1Pct,
            scaleOut2Pct: body.scaleOut2Pct ?? DEFAULT_CONFIG.scaleOut2Pct,
            trailingStopAtr: body.trailingStopAtr ?? DEFAULT_CONFIG.trailingStopAtr,
        };

        const result = await runBacktest(config);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[Backtest API] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
