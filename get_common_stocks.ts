async function findCommonStocks() {
    try {
        console.log("Fetching Top Picks...");
        const picksRes = await fetch("http://localhost:3000/api/conviction");
        const picks = await picksRes.json();
        const pickSymbols = new Set(picks.map((p: any) => p.symbol));

        console.log("Fetching Alpha Hunter...");
        const hunterRes = await fetch("http://localhost:3000/api/alpha-hunter");
        const hunters = await hunterRes.json();
        const hunterSymbols = new Set(hunters.map((p: any) => p.symbol));

        console.log("Fetching Social Pulse...");
        const socialRes = await fetch("http://localhost:3000/api/social-pulse");
        const socials = await socialRes.json();
        const socialSymbols = new Set(socials.map((p: any) => p.symbol));

        console.log(`Found ${pickSymbols.size} Top Picks, ${hunterSymbols.size} Alpha Hunters, ${socialSymbols.size} Social Pulse.`);

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

findCommonStocks();
