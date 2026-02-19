import { NextRequest, NextResponse } from 'next/server';
import { trackOption, getTrackedOptions, TrackedOption } from '@/lib/tracking';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const ticker = searchParams.get('ticker');

        let tracked = getTrackedOptions();
        if (ticker) {
            const cleanTicker = ticker.trim().toUpperCase();
            tracked = tracked.filter((o: TrackedOption) =>
                (o.ticker || '').trim().toUpperCase() === cleanTicker
            );
        }

        return NextResponse.json({ success: true, tracked });
    } catch (e: any) {
        console.error('[API Tracking] GET Error:', e);
        return NextResponse.json({ error: 'Failed to fetch tracked options' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { option, companyName, underlyingPrice } = body;

        if (!option) {
            return NextResponse.json({ error: 'Option data required' }, { status: 400 });
        }

        const tracked = trackOption(option, companyName, underlyingPrice);
        return NextResponse.json({ success: true, tracked });
    } catch (e: any) {
        console.error('[API Tracking] POST Error:', e);
        return NextResponse.json({ error: e.message || 'Failed to track option' }, { status: 500 });
    }
}
