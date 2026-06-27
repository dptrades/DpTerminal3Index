import { NextRequest, NextResponse } from 'next/server';
import { runForwardTest } from '@/lib/backtest/forward-test';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
    try {
        const { state, summary } = await runForwardTest();
        return NextResponse.json({
            status: 'ok',
            date: state.lastRunDate,
            run: state.totalRuns,
            equity: state.account.equity,
            positions: state.positions.length,
            trades: state.trades.length,
            summary,
        });
    } catch (err: any) {
        console.error('[ForwardTest Cron] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
