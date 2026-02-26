import { NextResponse } from 'next/server';
import { runPreMarketEngine } from '@/lib/pre-market-engine';

export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
    try {
        const movers = await runPreMarketEngine();
        return NextResponse.json(movers);
    } catch (e) {
        console.error('[PreMarket API]', e);
        return NextResponse.json(
            { error: 'Failed to fetch pre-market movers', details: e instanceof Error ? e.message : 'Unknown' },
            { status: 500 }
        );
    }
}
