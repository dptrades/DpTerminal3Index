import { NextResponse } from 'next/server';
import { publicClient } from '@/lib/public-api';
import { getSectorMap, SCANNER_WATCHLIST } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// ── Server-side cache ────────────────────────────────────────────────────────
// Sector data doesn't need sub-minute freshness for the tile grid.
// 5 min during market hours, 30 min off-hours.
interface SlimStock {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    volume: number;
    sector: string;
}

interface SectorsCacheEntry {
    data: SlimStock[];
    timestamp: number;
}

declare global {
    var _sectorsCache: SectorsCacheEntry | null;
}
if (!global._sectorsCache) global._sectorsCache = null;

const TTL_MARKET = 5 * 60 * 1000;  // 5 minutes
const TTL_OFF = 30 * 60 * 1000; // 30 minutes

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const now = Date.now();
    const session = publicClient.getMarketSession();
    const ttl = session === 'OFF' ? TTL_OFF : TTL_MARKET;

    // Serve from cache if fresh
    if (!forceRefresh && global._sectorsCache && (now - global._sectorsCache.timestamp < ttl)) {
        return NextResponse.json(global._sectorsCache.data, {
            headers: { 'X-Cache': 'HIT' }
        });
    }

    try {
        // One batch quote call + sector map lookup — no historical bars, no indicators
        const [quotes, sectorMap] = await Promise.all([
            publicClient.getQuotes(SCANNER_WATCHLIST),
            getSectorMap()
        ]);

        const stocks: SlimStock[] = quotes
            .filter(q => q.price > 0)
            .map(q => ({
                symbol: q.symbol,
                name: q.symbol,           // name enrichment not needed for sector tiles
                price: q.price,
                change24h: q.changePercent ?? 0,
                volume: q.volume ?? 0,
                sector: sectorMap[q.symbol] || 'Other',
            }))
            // Exclude ETF noise categories used internally
            .filter(s => s.sector !== 'Internals' && s.sector !== 'Indices');

        global._sectorsCache = { data: stocks, timestamp: now };

        return NextResponse.json(stocks, {
            headers: { 'X-Cache': 'MISS' }
        });
    } catch (e) {
        console.error('[/api/sectors] Failed:', e);
        // Serve stale cache on error rather than returning nothing
        if (global._sectorsCache) {
            return NextResponse.json(global._sectorsCache.data, {
                headers: { 'X-Cache': 'STALE' }
            });
        }
        return NextResponse.json({ error: 'Failed to fetch sector data' }, { status: 500 });
    }
}
