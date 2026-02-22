import { NextResponse } from 'next/server';
import { scanSocialPulse } from '@/lib/social';
import { publicClient } from '@/lib/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const marketSession = publicClient.getMarketSession();

    try {
        const data = await scanSocialPulse(forceRefresh);

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            count: data.length,
            data: data,
            isMarketClosed: marketSession === 'OFF'
        });
    } catch (e) {
        console.error("Social Pulse API failed:", e);
        return NextResponse.json({ error: "Failed to fetch pulse" }, { status: 500 });
    }
}
