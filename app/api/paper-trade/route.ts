import { NextRequest, NextResponse } from 'next/server';
import { runAlpacaPaper, loadAlpacaState, resetAlpacaPaper } from '@/lib/backtest/alpaca-paper';
import { getAccount, getPositions, getOrders } from '@/lib/alpaca-trading';

export const maxDuration = 300;

export async function GET() {
    try {
        const [state, account, positions, orders] = await Promise.all([
            loadAlpacaState(),
            getAccount(),
            getPositions(),
            getOrders('all', 20),
        ]);
        return NextResponse.json({ state, alpaca: { account, positions, orders } });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));

        if (body.action === 'reset') {
            const state = await resetAlpacaPaper();
            return NextResponse.json({ status: 'reset', state });
        }

        const { state, summary } = await runAlpacaPaper();
        return NextResponse.json({ status: 'ok', summary, state });
    } catch (err: any) {
        console.error('[PaperTrade API] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
