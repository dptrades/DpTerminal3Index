import { NextRequest, NextResponse } from 'next/server';
import { runForwardTest, loadState, resetForwardTest } from '@/lib/backtest/forward-test';

export const maxDuration = 300;

export async function GET() {
    try {
        const state = await loadState();
        return NextResponse.json(state);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));

        if (body.action === 'reset') {
            const state = await resetForwardTest();
            return NextResponse.json({ status: 'reset', state });
        }

        const { state, summary } = await runForwardTest();
        return NextResponse.json({ status: 'ok', summary, state });
    } catch (err: any) {
        console.error('[ForwardTest API] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
