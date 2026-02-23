import { scanAlphaHunter } from "./lib/conviction";
import { runSmartScan } from "./lib/smart-scanner";
import { scanSocialPulse } from "./lib/social";

async function main() {
    try {
        console.log("Fetching Alpha Hunter...");
        const hunters = await scanAlphaHunter(false);
        const hunterSymbols = new Set(hunters.map(h => h.symbol));

        console.log("Fetching Top Picks...");
        const picks = await runSmartScan();
        const pickSymbols = new Set(picks.map(p => p.symbol));

        console.log("Fetching Social Pulse...");
        const socials = await scanSocialPulse(false);
        const socialSymbols = new Set(socials.map(s => s.symbol));

        console.log(`\nSizes: Alpha Hunter: ${hunterSymbols.size}, Top Picks: ${pickSymbols.size}, Social Pulse: ${socialSymbols.size}`);

        const common = [];
        for (const sym of pickSymbols) {
            if (hunterSymbols.has(sym) && socialSymbols.has(sym)) {
                common.push(sym);
            }
        }

        console.log("\nStocks common in all three:");
        if (common.length === 0) {
            console.log("None found.");
        } else {
            console.log(common.join(", "));
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
