
import { config } from 'dotenv';
config({ path: '.env.local' });
import { fetchAlpacaBars } from './lib/alpaca';

async function checkAlpaca() {
    const symbol = 'SPY';
    console.log(`📡 Checking Alpaca Bars for ${symbol}...`);
    try {
        const bars = await fetchAlpacaBars(symbol, '1Hour', 10);
        if (bars && bars.length > 0) {
            bars.forEach((b, i) => {
                console.log(`Bar ${i}: ${new Date(b.t).toLocaleString()} - Close: ${b.c}`);
            });
            const lastTime = new Date(bars[bars.length-1].t).getTime();
            const now = Date.now();
            console.log(`Last Bar Time: ${new Date(lastTime).toLocaleString()}`);
            console.log(`Current Time: ${new Date(now).toLocaleString()}`);
            console.log(`Diff: ${((now - lastTime) / (1000 * 60 * 60)).toFixed(2)} hours`);
        } else {
            console.log("No bars from Alpaca.");
        }
    } catch (e) {
        console.error("Alpaca Error:", e);
    }
}
checkAlpaca();
