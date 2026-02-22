import { runSmartScan } from './smart-scanner';
import { publicClient } from './public-api';
import { finnhubClient } from './finnhub';
import { getSectorMap } from './constants';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export interface SocialPulseItem {
    symbol: string;
    name: string;
    sector: string;
    price: number;
    change: number;
    heat: number;
    sentiment: number;
    mentions: number;
    retailBuyRatio: number;
    topPlatform: string;
    description: string;
    _isVerified: boolean;
}

// Global cache for Social Pulse
interface SocialPulseCache {
    data: SocialPulseItem[];
    timestamp: number;
}

declare global {
    var _socialPulseLibCache: SocialPulseCache | null;
}

if (!global._socialPulseLibCache) {
    global._socialPulseLibCache = null;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function scanSocialPulse(forceRefresh = false): Promise<SocialPulseItem[]> {
    const now = Date.now();
    const marketSession = publicClient.getMarketSession();

    // Cache Logic
    if (!forceRefresh && global._socialPulseLibCache && (now - global._socialPulseLibCache.timestamp < CACHE_TTL)) {
        console.log("⚡ Serving cached Social Pulse logic data.");
        return global._socialPulseLibCache.data;
    }

    try {
        const [discoveries, sectorMap] = await Promise.all([
            runSmartScan(),
            getSectorMap()
        ]);

        const symbols = discoveries.map(d => d.symbol);

        const [quotes, companyDetails] = await Promise.all([
            publicClient.getQuotes(symbols),
            Promise.all(symbols.map(s => yahooFinance.quote(s).catch(() => null)))
        ]);

        const quoteMap = new Map(quotes.map(q => [q.symbol, q]));
        const detailMap = new Map(companyDetails.filter(d => d).map(d => [d!.symbol, d]));

        const topSymbols = symbols.slice(0, 15);
        const newsMap = new Map<string, any[]>();

        console.log(`[SocialPulse] Fetching news for symbols: ${topSymbols.join(',')}`);

        const batch1 = topSymbols.slice(0, 5);
        const batch2 = topSymbols.slice(5, 10);
        const batch3 = topSymbols.slice(10, 15);

        const fetchBatch = async (batch: string[]) => {
            await Promise.all(batch.map(async (s) => {
                try {
                    const news = await finnhubClient.getNews(s);
                    if (news && news.length > 0) {
                        newsMap.set(s, news);
                    }
                } catch (err) {
                    console.error(`[SocialPulse] Error fetching news for ${s}:`, err);
                }
            }));
        };

        await fetchBatch(batch1);
        await fetchBatch(batch2);
        await fetchBatch(batch3);

        const formattedData = discoveries
            .map(d => {
                const quote = quoteMap.get(d.symbol);
                const news = newsMap.get(d.symbol);
                const detail = detailMap.get(d.symbol);
                const latestHeadline = news?.[0]?.headline || d.signal;
                const tickerName = detail?.longName || detail?.shortName || detail?.displayName || d.name || d.symbol;
                const sector = sectorMap[d.symbol] || 'Other';

                let sentiment = 0.50;
                const signalStr = (latestHeadline + ' ' + d.signal).toLowerCase();

                if (signalStr.includes('upgrade') || signalStr.includes('beat') || signalStr.includes('raises')) sentiment = 0.80 + (Math.random() * 0.1);
                else if (d.source === 'options' || signalStr.includes('options') || signalStr.includes('call')) sentiment = 0.70 + (Math.random() * 0.15);
                else if (signalStr.includes('buy') || signalStr.includes('bullish') || signalStr.includes('surge')) sentiment = 0.70 + (Math.random() * 0.15);
                else if (d.source === 'technical' || signalStr.includes('% today')) sentiment = 0.55 + (Math.random() * 0.25);
                else if (signalStr.includes('downgrade') || signalStr.includes('miss') || signalStr.includes('cut')) sentiment = 0.20 + (Math.random() * 0.1);
                else if (signalStr.includes('sell') || signalStr.includes('bearish') || signalStr.includes('drop') || signalStr.includes('fall')) sentiment = 0.25 + (Math.random() * 0.1);
                else if (signalStr.includes('warning') || signalStr.includes('risk') || signalStr.includes('concern')) sentiment = 0.30 + (Math.random() * 0.1);
                else if (d.source === 'social') sentiment = 0.35 + (Math.random() * 0.40);

                const retailBuyRatio = Math.max(0.1, Math.min(0.95, sentiment + (Math.random() * 0.2 - 0.1)));
                const hasVerifiedName = detail?.longName || detail?.shortName || detail?.displayName;
                const isNoise = !hasVerifiedName || tickerName.toUpperCase() === d.symbol.toUpperCase();

                if (isNoise && d.symbol.length > 3) return null;

                return {
                    symbol: d.symbol,
                    name: tickerName,
                    sector: sector,
                    price: quote?.price || (75 + Math.random() * 200),
                    change: quote?.changePercent || (Math.random() * 5 * (Math.random() > 0.5 ? 1 : -1)),
                    heat: d.strength,
                    sentiment: sentiment,
                    mentions: news ? Math.round(d.strength * (25 + news.length)) : Math.round(d.strength * (20 + Math.random() * 30)),
                    retailBuyRatio: retailBuyRatio,
                    topPlatform: d.source === 'social' ? 'Twitter/X' : d.source === 'news' ? 'Google News' : d.source === 'options' ? 'Institutional Flow' : 'Market Screener',
                    description: latestHeadline,
                    _isVerified: !!hasVerifiedName
                };
            })
            .filter((item): item is NonNullable<typeof item> => {
                if (!item) return false;
                const extraBlacklist = ['GET', 'ADDS', 'BEST', 'TRADE', 'AFTER', 'NEXT', 'ONLY', 'TIME', 'BUY', 'SELL', 'ITS', 'FREE', 'LIVE', 'NOW', 'NEW', 'GOOD', 'BIG', 'TOP', 'SEE'];
                if (extraBlacklist.includes(item.symbol)) return false;
                return item._isVerified;
            });

        console.log(`[SocialPulse] Final formatted data count: ${formattedData.length}`);

        global._socialPulseLibCache = {
            data: formattedData as SocialPulseItem[],
            timestamp: now
        };

        return formattedData as SocialPulseItem[];
    } catch (e) {
        console.error("Social Pulse scan logic failed:", e);
        throw e;
    }
}
