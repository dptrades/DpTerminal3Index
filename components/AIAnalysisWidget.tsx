import { Activity, TrendingUp, TrendingDown, Target, Zap, Clock } from "lucide-react";
import { MultiTimeframeAnalysis } from "@/lib/market-data";
import { UnusualOption } from "@/lib/options-flow";

export interface Fundamentals {
    marketCap?: number;
    peRatio?: number;
    forwardPE?: number;
    beta?: number;
    dividendYield?: number;
    targetMeanPrice?: number;
    recommendationKey?: string;
    obs?: number; // numberOfAnalystOpinions
}

interface AIAnalysisWidgetProps {
    symbol: string;
    analysis: MultiTimeframeAnalysis;
    optionsFlow: UnusualOption[];
    fundamentals: Fundamentals;
}

export default function AIAnalysisWidget({ symbol, analysis, optionsFlow, fundamentals }: AIAnalysisWidgetProps) {
    const { 
        signal, 
        score, 
        executionAction, 
        entryPrice, 
        entryReason, 
        techDetails 
    } = generateSignal(symbol, analysis, optionsFlow, fundamentals);

    const isBullish = score >= 6.5;
    const isBearish = score <= 4;
    const scoreColor = isBullish ? "text-[#00FF94]" : isBearish ? "text-[#FF2E2E]" : "text-[#FFB800]";
    const borderColor = isBullish ? "border-[#00FF94]/20" : isBearish ? "border-[#FF2E2E]/20" : "border-[#FFB800]/20";
    const bgGlow = isBullish ? "shadow-[0_0_30px_-10px_rgba(0,255,148,0.2)]" : isBearish ? "shadow-[0_0_30px_-10px_rgba(255,46,46,0.2)]" : "shadow-[0_0_30px_-10px_rgba(255,184,0,0.2)]";

    return (
        <div className={`relative bg-[#0B0F17]/90 backdrop-blur-2xl rounded-2xl border ${borderColor} p-8 ${bgGlow} transition-all duration-700 overflow-hidden`}>
            {/* Background Texture */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            
            <div className="relative z-10 flex flex-col lg:grid lg:grid-cols-12 gap-8">
                
                {/* LEFT COLUMN: PRIMARY SIGNAL & EXECUTION (4/12) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* 1. AI SIGNAL */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col items-center text-center shadow-xl">
                        <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">AI Terminal Signal</div>
                        <div className={`text-3xl font-black ${scoreColor} tracking-tighter mb-1 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`}>{signal}</div>
                        <div className="text-6xl font-black text-white tracking-tighter">
                            {score}<span className="text-xl text-white/30 font-bold ml-1">/10</span>
                        </div>
                    </div>

                    {/* 2. EXECUTION STRATEGY */}
                    <div className={`p-6 rounded-2xl border flex flex-col gap-3 shadow-xl ${executionAction === 'BUY' ? 'bg-[#00FF94]/5 border-[#00FF94]/20' : 'bg-[#FFB800]/5 border-[#FFB800]/20'}`}>
                        <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${executionAction === 'BUY' ? 'text-[#00FF94]' : 'text-[#FFB800]'}`} />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Execution Strategy</span>
                        </div>
                        <div className={`text-2xl font-black ${executionAction === 'BUY' ? 'text-[#00FF94]' : 'text-[#FFB800]'}`}>
                            {executionAction === 'BUY' ? 'BUY / ENTER NOW' : 'WAIT FOR SETUP'}
                        </div>
                        <div className="text-xs font-bold text-white/80 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                            {executionAction === 'BUY' 
                                ? `Primary Entry: $${entryPrice.toFixed(2)}`
                                : "No immediate entry. Await confluence reversal or 1h EMAs to clear overhead supply."}
                        </div>
                    </div>

                    {/* 3. TARGET PRICE */}
                    {fundamentals.targetMeanPrice && (
                        <div className="bg-[#161B22] rounded-2xl p-6 border border-white/5 flex flex-col gap-2 shadow-2xl">
                            <div className="flex items-center gap-1.5 text-[9px] font-black text-white/40 uppercase tracking-widest">
                                <Target className="w-4 h-4 text-blue-400" /> Analyst Target (Mean)
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-3xl font-black text-white">${fundamentals.targetMeanPrice.toFixed(0)}</span>
                                <div className={`flex flex-col items-end`}>
                                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${analysis.currentPrice < fundamentals.targetMeanPrice ? "bg-[#00FF94]/10 text-[#00FF94]" : "bg-[#FF2E2E]/10 text-[#FF2E2E]"}`}>
                                        {analysis.currentPrice < fundamentals.targetMeanPrice ? "+" : ""}{((fundamentals.targetMeanPrice - analysis.currentPrice) / analysis.currentPrice * 100).toFixed(1)}% Implied
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: TECHNICAL CONFLUENCE & ENTRY LOGIC (8/12) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    {/* TECHNICAL DETAIL BREAKDOWN */}
                    <div className="bg-white/5 rounded-2xl p-8 border border-white/5 flex-grow shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <Activity className="w-5 h-5 text-blue-400" />
                            <h4 className="text-sm font-black text-white uppercase tracking-widest">Technical Confluence Analysis</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            {/* EMA & RSI Group */}
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Trend & EMAs</div>
                                    <div className="space-y-2.5">
                                        {techDetails.emas.map((point, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${point.sentiment === 'positive' ? 'bg-[#00FF94]' : point.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-gray-500'}`}></div>
                                                <span className="text-xs text-white/70 font-bold leading-snug">{point.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Momentum (RSI)</div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${techDetails.rsi.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.rsi.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-[#FFB800]'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-snug">{techDetails.rsi.text}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Volatility & Liquidity Group */}
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Bollinger Bands</div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${techDetails.bb.sentiment === 'positive' ? 'bg-[#00FF94]' : techDetails.bb.sentiment === 'negative' ? 'bg-[#FF2E2E]' : 'bg-gray-500'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-snug">{techDetails.bb.text}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Fair Value Gaps (FVG)</div>
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full ${techDetails.fvg.sentiment === 'positive' ? 'bg-[#00FF94]' : 'bg-[#FF2E2E]'}`}></div>
                                        <span className="text-xs text-white/70 font-bold leading-snug">{techDetails.fvg.text}</span>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Institutional Flow</div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        <span className="text-xs text-white/70 font-bold leading-snug">{techDetails.options.text}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ENTRY PRICE LOGIC EXPLANATION */}
                    <div className="bg-[#00FF94]/5 rounded-2xl p-6 border border-[#00FF94]/20 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <Zap className="w-5 h-5 text-[#00FF94]" />
                            <h4 className="text-sm font-black text-white uppercase tracking-widest">Entry Condition & Strategy</h4>
                        </div>
                        <p className="text-xs font-bold text-[#00FF94]/80 leading-relaxed italic">
                            {entryReason}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function generateSignal(symbol: string, analysis: MultiTimeframeAnalysis, options: UnusualOption[], fundamentals: Fundamentals) {
    let score = 5.0; // Neutral Start
    
    // Detailed Technical Object
    const techDetails = {
        emas: [] as { text: string, sentiment: 'positive' | 'negative' | 'neutral' }[],
        rsi: { text: '', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' },
        bb: { text: '', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' },
        fvg: { text: 'No significant Fair Value Gaps detected in immediate price action.', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' },
        options: { text: 'Neutral participation detected in institutional flow.', sentiment: 'neutral' as 'positive' | 'negative' | 'neutral' }
    };

    const daily = analysis.timeframes.find(t => t.timeframe === '1d');
    const price = analysis.currentPrice;

    // 1. EMA ANALYSIS
    if (daily) {
        if (price > daily.ema200!) {
            techDetails.emas.push({ text: "Price is holding above the 200-day EMA, maintaining long-term bullish structural integrity.", sentiment: 'positive' });
            score += 0.5;
        } else {
            techDetails.emas.push({ text: "Price is currently below the 200-day EMA, indicating a secular bearish regime.", sentiment: 'negative' });
            score -= 1.0;
        }

        if (price > (daily.ema50 || 0)) {
            techDetails.emas.push({ text: "Medium-term momentum is positive as price sustains levels above the 50-day EMA.", sentiment: 'positive' });
            score += 0.5;
        } else {
            techDetails.emas.push({ text: "Significant overhead resistance found at the 50-day EMA; trend remains suppressed.", sentiment: 'negative' });
            score -= 0.5;
        }

        if ((daily.ema9 || 0) > (daily.ema21 || 0)) {
            techDetails.emas.push({ text: "Short-term trend acceleration: 9 EMA has crossed above the 21 EMA (Bullish Cross).", sentiment: 'positive' });
            score += 0.5;
        } else {
            techDetails.emas.push({ text: "Negative short-term stack: 9 EMA is trending below the 21 EMA.", sentiment: 'negative' });
            score -= 0.5;
        }
    }

    // 2. RSI ANALYSIS
    if (daily && daily.rsi) {
        if (daily.rsi > 70) {
            techDetails.rsi = { text: `RSI is Overextended at ${daily.rsi.toFixed(1)}, suggesting a high probability of exhaustion or short-term pullback.`, sentiment: 'negative' };
            score -= 1.0;
        } else if (daily.rsi < 30) {
            techDetails.rsi = { text: `RSI is Oversold at ${daily.rsi.toFixed(1)}, indicating a potential bottoming process or mean reversion bounce.`, sentiment: 'positive' };
            score += 1.0;
        } else {
            techDetails.rsi = { text: `RSI is Neutral at ${daily.rsi.toFixed(0)}, leaving room for expansion in either direction without immediate exhaustion.`, sentiment: 'neutral' };
        }
    }

    // 3. BOLLINGER BANDS
    if (daily && daily.bollinger) {
        const { pb } = daily.bollinger;
        if (pb > 0.9) {
            techDetails.bb = { text: "Price is riding the Upper Bollinger Band, signaling extreme strength but also high relative extension.", sentiment: 'positive' };
            score += 0.5;
        } else if (pb < 0.1) {
            techDetails.bb = { text: "Price is tagging the Lower Bollinger Band; historically a zone for institutional dip-buying.", sentiment: 'negative' }; // negative position, positive opportunity
        } else {
            techDetails.bb = { text: "Price is consolidating within the bands; volatility is contracting, suggesting an upcoming expansion.", sentiment: 'neutral' };
        }
    }

    // 4. FVG Analysis
    if (daily?.fvg?.type === 'BULLISH') {
        techDetails.fvg = { text: `Bullish FVG support identified between $${daily.fvg.gapLow.toFixed(2)} - $${daily.fvg.gapHigh.toFixed(2)}. This acts as a magnet for buy orders.`, sentiment: 'positive' };
        score += 1.0;
    } else if (daily?.fvg?.type === 'BEARISH') {
        techDetails.fvg = { text: `Bearish FVG resistance active between $${daily.fvg.gapLow.toFixed(2)} - $${daily.fvg.gapHigh.toFixed(2)}. Expect supply to hit at these levels.`, sentiment: 'negative' };
        score -= 1.0;
    }

    // 5. Options Flow
    const callVol = options.filter(o => o.type === 'CALL').reduce((a, b) => a + (b.volume || 0), 0);
    const putVol = options.filter(o => o.type === 'PUT').reduce((a, b) => a + (b.volume || 0), 0);
    if (callVol > putVol * 1.5) {
        techDetails.options = { text: "Heavy call flow detected; institutional participants are positioning for upside momentum.", sentiment: 'positive' };
        score += 1.0;
    } else if (putVol > callVol * 1.5) {
        techDetails.options = { text: "Aggressive put buying dominance suggests cautious or bearish institutional bias.", sentiment: 'negative' };
        score -= 1.0;
    }

    // Clamp Score
    score = Math.min(10, Math.max(0, score));
    score = Number(score.toFixed(1));

    // Determine Signal & Strategy
    let signal = "NEUTRAL";
    if (score >= 8) signal = "STRONG BUY";
    else if (score >= 6.5) signal = "BUY";
    else if (score <= 2) signal = "STRONG SELL";
    else if (score <= 4) signal = "SELL";

    const executionAction = score >= 6.5 ? 'BUY' : 'WAIT';
    
    // Entry Point Explanation
    let entryReason = "";
    const entryPrice = price;

    if (executionAction === 'BUY') {
        if (daily?.fvg?.type === 'BULLISH') {
            entryReason = `Long entry recommended near the top of the Bullish Fair Value Gap ($${daily.fvg.gapHigh.toFixed(2)}) or on a retest of the daily 21 EMA. Overall confluence suggests high conviction for upside expansion with minimal drawdown expected.`;
        } else {
            entryReason = `Current market price is attractive for a momentum entry. Scaling in near the 9 EMA ($${daily?.ema9?.toFixed(2)}) is advised to maintain a tight risk-to-reward ratio while trend remains intact.`;
        }
    } else {
        if (daily?.fvg?.type === 'BEARISH') {
            entryReason = `Wait for a daily close above the Bearish Fair Value Gap ($${daily.fvg.gapHigh.toFixed(2)}) before seeking long entry. Current overhead supply of $${daily.fvg.gapLow.toFixed(2)} is acting as a hard ceiling for price action.`;
        } else {
            entryReason = `Market is currently in 'Price Discovery' mode with no clear confluence. Patience is required. Monitor for a breach of the daily 50 EMA or an RSI divergence before deploying capital.`;
        }
    }

    return { signal, score, executionAction, entryPrice, entryReason, techDetails };
}
