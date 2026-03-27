
import { config } from 'dotenv';
config({ path: '.env.local' });
import { fetchMultiTimeframeAnalysis } from './lib/market-data';

async function diagnose() {
    const symbol = 'SPY';
    try {
        console.log(`🔍 [DIAGNOSTIC] Analyzing ${symbol} 1H Bars with Emergency Synthesis...`);
        const analysis = await fetchMultiTimeframeAnalysis(symbol, true);
        
        if (analysis) {
            const h1 = analysis.timeframes.find(t => t.timeframe === '1h');
            console.log(`\n📊 [SPY 1H SUMMARY]`);
            console.log(`Price: ${analysis.currentPrice}`);
            console.log(`Trend: ${h1?.trend}`);
            console.log(`RSI: ${h1?.rsi}`);
            console.log(`Data Source: ${analysis.dataSource}`);
            
            if (h1 && h1.rsi < 35) {
                console.log("✅ SUCCESS: RSI is correctly showing Oversold/Dropping state.");
            } else {
                console.log("⚠️ WARNING: RSI still too high.");
            }
        }
    } catch (e) {
        console.error("DIAGNOSE ERROR:", e);
    }
}
diagnose();
