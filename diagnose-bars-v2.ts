
import { config } from 'dotenv';
config({ path: '.env.local' });
import { fetchMultiTimeframeAnalysis } from './lib/market-data';

async function diagnose() {
    const symbol = 'SPY';
    try {
        console.log(`🔍 [DIAGNOSTIC V2] Analyzing ${symbol} 1H Bars...`);
        const analysis = await fetchMultiTimeframeAnalysis(symbol, true);
        
        if (analysis) {
            const h1 = analysis.timeframes.find(t => t.timeframe === '1h');
            console.log(`\n📊 [SPY 1H SUMMARY]`);
            console.log(`Price: ${analysis.currentPrice}`);
            console.log(`Trend: ${h1?.trend}`);
            console.log(`RSI: ${h1?.rsi}`);
            console.log(`Data Source: ${analysis.dataSource}`);
            
            if (h1 && h1.rsi! > 99) {
                console.log("❌ FAILURE: RSI is still 100.");
            } else if (h1 && h1.rsi! > 0) {
                console.log("✅ SUCCESS: RSI is realistic.");
            } else {
                console.log("⚠️ WARNING: RSI is null or 0.");
            }
        }
    } catch (e) {
        console.error("DIAGNOSE ERROR:", e);
    }
}
diagnose();
