import { NextRequest, NextResponse } from 'next/server';
import { getBacktestResult, getAllBacktestResults } from '@/lib/backtest/engine';

export async function GET(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id');

    if (id) {
        const result = getBacktestResult(id);
        if (!result) {
            return NextResponse.json({ error: 'Backtest not found' }, { status: 404 });
        }
        return NextResponse.json(result);
    }

    const results = getAllBacktestResults();
    return NextResponse.json(results);
}
