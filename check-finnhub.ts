
import { config } from 'dotenv';
config({ path: '.env.local' });
import { finnhubClient } from './lib/finnhub';

async function checkFinnhub() {
    const symbol = 'SPY';
    console.log(`📡 Checking Finnhub Bars for ${symbol}...`);
    try {
        const nowSec = Math.floor(Date.now() / 1000);
        const fromSec = nowSec - (5 * 3600); // 5 hours ago
        const data = await finnhubClient.getCandles(symbol, '60', fromSec, nowSec);
        
        if (data && data.s === 'ok') {
            data.t.forEach((t, i) => {
                console.log(`Bar ${i}: ${new Date(t * 1000).toLocaleString()} - Close: ${data.c[i]}`);
            });
            const lastTime = data.t[data.t.length-1] * 1000;
            console.log(`Last Bar Time: ${new Date(lastTime).toLocaleString()}`);
            console.log(`Current Time: ${new Date().toLocaleString()}`);
        } else {
            console.log("No bars from Finnhub or error:", data?.s);
        }
    } catch (e) {
        console.error("Finnhub Error:", e);
    }
}
checkFinnhub();
