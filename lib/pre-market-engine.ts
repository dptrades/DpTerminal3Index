import { DiscoveredStock } from '@/types/stock';
import { scanUnusualVolume, scanTopGainers, scanSocialBuzz, scanBreakingNews } from './smart-scanner';

export interface PreMarketMover extends DiscoveredStock {
    catalystScore: number;
    factors: {
        volume: boolean;
        price: boolean;
        social: boolean;
        news: boolean;
    };
}

export async function runPreMarketEngine(): Promise<PreMarketMover[]> {
    console.log('[PreMarketEngine] Starting multi-factor scan...');
    const startTime = Date.now();

    const [volumeStocks, gainerStocks, socialStocks, newsStocks] = await Promise.all([
        scanUnusualVolume(),
        scanTopGainers(),
        scanSocialBuzz(),
        scanBreakingNews()
    ]);

    const symbolMap = new Map<string, PreMarketMover>();

    const addToMap = (stock: DiscoveredStock, factor: keyof PreMarketMover['factors']) => {
        let existing = symbolMap.get(stock.symbol);
        if (!existing) {
            existing = {
                symbol: stock.symbol,
                name: stock.name,
                source: stock.source,
                signal: stock.signal,
                strength: stock.strength,
                timestamp: stock.timestamp,
                catalystScore: 0,
                factors: { volume: false, price: false, social: false, news: false }
            };
            symbolMap.set(stock.symbol, existing);
        } else {
            // Append signal
            if (!existing.signal.includes(stock.signal)) {
                existing.signal = `${existing.signal} | ${stock.signal}`;
            }
        }

        // Update factors
        existing.factors[factor] = true;
    };

    volumeStocks.forEach(s => addToMap(s, 'volume'));
    gainerStocks.forEach(s => addToMap(s, 'price'));
    socialStocks.forEach(s => addToMap(s, 'social'));
    newsStocks.forEach(s => addToMap(s, 'news'));

    // Calculate Composite Catalyst Score (0-100)
    for (const mover of symbolMap.values()) {
        let score = 0;

        // Base points for just being detected
        if (mover.factors.volume) score += 35; // Max 35
        if (mover.factors.price) score += 30;  // Max 30
        if (mover.factors.news) score += 20;   // Max 20
        if (mover.factors.social) score += 15; // Max 15

        // Give a little bonus variance based on the original strength metric
        const bonus = (mover.strength / 100) * 10;

        mover.catalystScore = Math.min(100, Math.round(score + bonus));
    }

    // Sort by Catalyst Score descending
    const sorted = Array.from(symbolMap.values())
        .sort((a, b) => b.catalystScore - a.catalystScore);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[PreMarketEngine] Scan complete in ${elapsed}s. Found ${sorted.length} stocks.`);

    // Return top 25
    return sorted.slice(0, 25);
}
