import { fetchAlpacaBars } from './alpaca';
import { calculateIndicators, calculateConfluenceScore } from './indicators';
import { getNewsData } from './news-service';
import { calculateSentimentScore } from './news';
import { publicClient } from './public-api';
import { schwabClient } from './schwab';
import { calculateVolatilityProxy, getNextMonthlyExpiry } from './options';
import { ConvictionStock } from '../types/stock';
import { OptionRecommendation } from '../types/options';

export interface DayDreamPick {
    symbol: string;
    direction: 'CALL' | 'PUT';
    confidence: number;
    reason: string;
    options: OptionRecommendation[];
    technicalScore: number;
    sentimentScore: number;
    socialScore: number;
}

const INDICES = ['SPY', 'QQQ', 'IWM'];

export async function getDayDreamPicks(): Promise<DayDreamPick[]> {
    const results: DayDreamPick[] = [];

    // Parallelize processing to prevent timeouts
    await Promise.all(INDICES.map(async (symbol) => {
        try {
            console.log(`[DayDream] 🔍 Processing ${symbol}...`);

            // 1. Fetch Technicals
            const bars = await fetchAlpacaBars(symbol, '1Day', 200);
            if (!bars || bars.length < 50) {
                console.warn(`[DayDream] ⚠️ Not enough data for ${symbol}`);
                return;
            }

            const cleanData = bars.map(b => ({
                time: new Date(b.t).getTime(),
                open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v
            }));
            const currentPrice = cleanData[cleanData.length - 1].close;
            const indicators = calculateIndicators(cleanData);
            const latest = indicators[indicators.length - 1];

            const confluence = calculateConfluenceScore(latest);
            const techScore = confluence.strength;

            // 2. Fetch News/Social
            const [news, social] = await Promise.all([
                getNewsData(symbol, 'news'),
                getNewsData(symbol, 'social')
            ]);
            const newsSentiment = calculateSentimentScore(news);
            const socialSentiment = calculateSentimentScore(social);

            // 3. Direction
            const totalScore = (techScore * 0.4) + (newsSentiment.score * 0.3) + (socialSentiment.score * 0.3);
            const direction = totalScore >= 50 ? 'CALL' : 'PUT';

            // 4. Expiry Selection
            let expirations: string[] = [];
            let chain: any = null;

            if (schwabClient.isConfigured()) {
                chain = await schwabClient.getOptionChainNormalized(symbol);
                if (chain) expirations = chain.expirations;
            }
            if (expirations.length === 0) {
                expirations = await publicClient.getOptionExpirations(symbol) || [];
            }
            if (expirations.length === 0) return;

            const target = Date.now() + (30 * 24 * 60 * 60 * 1000);
            const expiry = [...expirations].sort((a, b) =>
                Math.abs(new Date(a).getTime() - target) - Math.abs(new Date(b).getTime() - target)
            )[0];

            console.log(`[DayDream] 📅 ${symbol} Expiry: ${expiry} | Bias: ${direction}`);

            // 5. Fetch Full Chain
            if (!chain) {
                chain = await publicClient.getOptionChain(symbol, expiry);
            }
            const candidates: OptionRecommendation[] = [];
            const strikes = chain?.options?.[expiry];

            if (strikes) {
                // Focus on strikes near ATM
                const strikeKeys = Object.keys(strikes)
                    .map(s => parseFloat(s))
                    .sort((a, b) => Math.abs(a - currentPrice) - Math.abs(b - currentPrice))
                    .slice(0, 10); // Reduced to 10 for speed safety

                const tempCandidates: any[] = [];
                for (const strikePrice of strikeKeys) {
                    const data = strikes[strikePrice];
                    const opt = direction === 'CALL' ? data.call : data.put;
                    if (!opt) continue;
                    if (opt.volume < 1 && opt.openInterest < 5) continue;

                    tempCandidates.push({
                        type: direction,
                        strike: strikePrice,
                        expiry,
                        contractPrice: (opt.bid + opt.ask) / 2 || opt.last,
                        volume: opt.volume,
                        openInterest: opt.openInterest,
                        symbol: opt.symbol,
                        entryPrice: currentPrice,
                        strategy: "Golden Strike",
                        greeks: opt.greeks
                    });
                }

                for (const cand of tempCandidates) {
                    try {
                        let greeks = cand.greeks;
                        if (!greeks && cand.symbol) {
                            greeks = await publicClient.getGreeks(cand.symbol);
                            await new Promise(r => setTimeout(r, 400));
                        }

                        if (greeks) {
                            const delta = Math.abs(greeks.delta);
                            if (delta >= 0.20 && delta <= 0.70) {
                                const deltaScore = (1 - Math.abs(delta - 0.45)) * 40;
                                const volWeight = Math.min(cand.volume / 100, 1) * 30;
                                const oiWeight = Math.min(cand.openInterest / 500, 1) * 10;
                                const ivProxy = calculateVolatilityProxy(currentPrice, undefined, symbol);
                                const ivEfficiency = Math.max(0, 20 - (Math.abs((greeks.impliedVolatility || 0) - ivProxy) * 20));

                                candidates.push({
                                    ...cand,
                                    confidence: Math.round(deltaScore + volWeight + oiWeight + ivEfficiency),
                                    reason: `Delta ${delta.toFixed(2)} | Vol/OI Flux: ${(cand.openInterest > 0 ? cand.volume / cand.openInterest : 0).toFixed(1)}x`,
                                    probabilityITM: delta,
                                    iv: greeks.impliedVolatility
                                } as any);
                            }
                        }
                    } catch (e) {
                        console.error(`[DayDream] Greek error for ${cand.symbol}:`, e);
                    }
                }

                results.push({
                    symbol,
                    direction,
                    confidence: Math.round(totalScore),
                    reason: `${direction} Bias: Tech (${techScore}) + Sentiment (${Math.round((newsSentiment.score + socialSentiment.score) / 2)})`,
                    options: candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 3),
                    technicalScore: techScore,
                    sentimentScore: newsSentiment.score,
                    socialScore: socialSentiment.score
                });
            }
        } catch (e) {
            console.error(`[DayDream] Fatal error for ${symbol}:`, e);
        }
    }));

    return results;
}
