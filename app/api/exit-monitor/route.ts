import { NextResponse } from 'next/server';
import { runExitMonitor } from '@/lib/backtest/exit-monitor';

export async function GET() {
    try {
        const { actions, summary } = await runExitMonitor();
        return NextResponse.json({ status: 'ok', actions, summary });
    } catch (err: any) {
        console.error('[ExitMonitor API] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
