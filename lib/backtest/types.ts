export interface BacktestConfig {
    startDate: string;   // YYYY-MM-DD
    endDate: string;     // YYYY-MM-DD
    initialBalance: number;
    maxPositions: number;
    maxPerSector: number;
    riskPerTrade: number;        // dollar risk per trade (ignored if riskPercent > 0)
    riskPercent: number;         // Fix 6: risk as % of current equity (0 = use fixed riskPerTrade)
    maxNotionalPerTrade: number;
    convictionThreshold: number; // min score to enter (0-100)
    stopAtrMultiple: number;     // stop = entry - (ATR * this)
    target1AtrMultiple: number;  // target = entry + (ATR * this)
    maxHoldingDays: number;      // Fix 3: force exit after N trading days (0 = disabled)
    symbols: string[];
    benchmark: string;           // e.g. 'SPY'
    enableVixRegime: boolean;    // Phase 2: adaptive VIX weighting
    enableEarningsZones: boolean; // Phase 3: tiered earnings protection
    enableCashMode: boolean;     // Fix 1: go flat when VIX>30 AND benchmark < 200 EMA
    enableSymbolBlacklist: boolean; // Fix 2: suspend symbols with <25% WR over last 20 trades
    scanDaily: boolean;          // Fix 4: scan every day instead of Mondays only
    enableScaleOut: boolean;     // Scale-out trailing stop strategy
    scaleOut1Pct: number;        // % of position to sell at 1x ATR profit (e.g. 0.30)
    scaleOut2Pct: number;        // % of position to sell at 2x ATR profit (e.g. 0.30)
    trailingStopAtr: number;     // trailing stop distance in ATR multiples for remaining shares
}

export interface BacktestBar {
    time: number;
    date: string; // YYYY-MM-DD
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface BacktestPosition {
    symbol: string;
    qty: number;
    entryPrice: number;
    entryDate: string;
    stopLoss: number;
    takeProfit: number;
    sector: string;
    entryScore: number;
    entryReason: string;
    earningsZone?: EarningsZone;
    positionSizeMultiplier?: number;
    // Scale-out tracking
    atr?: number;
    originalQty?: number;
    scaleLevel?: number;       // 0 = full, 1 = after first scale, 2 = after second scale
    highWaterMark?: number;    // highest price since entry (for trailing stop)
}

export type VixRegime = 'Low Vol' | 'Normal' | 'High Vol' | 'Crisis';

export interface VixRegimeState {
    vixLevel: number;
    regime: VixRegime;
    convictionBoost: number;       // added to/subtracted from threshold
    stopMultiplierAdj: number;     // multiplied into stop ATR multiple
    targetMultiplierAdj: number;   // multiplied into target ATR multiple
}

export type EarningsZone = 'green' | 'yellow' | 'red' | 'drift';

export interface EarningsModifier {
    zone: EarningsZone;
    daysToEarnings: number;
    positionSizeMultiplier: number; // 1.0 = normal, 0.5 = half, 0 = blocked
    confidenceFloor: number;        // minimum score to enter
    driftBonus: number;             // score boost for post-earnings drift
}

export interface BacktestTrade {
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    entryPrice: number;
    entryDate: string;
    exitPrice: number;
    exitDate: string;
    exitReason: 'stop' | 'target' | 'time_exit' | 'end_of_test' | 'scale_1' | 'scale_2' | 'trail_stop';
    pnl: number;
    pnlPercent: number;
    holdingDays: number;
    entryScore: number;
    sector: string;
    vixRegime?: VixRegime;
    earningsZone?: EarningsZone;
}

export interface DailyEquityPoint {
    date: string;
    equity: number;
    cash: number;
    positionsValue: number;
    positionCount: number;
    benchmarkValue: number;
    drawdownPct: number;
}

export interface BacktestMetrics {
    totalReturn: number;
    benchmarkReturn: number;
    excessReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownDate: string;
    winRate: number;
    totalTrades: number;
    avgWinner: number;
    avgLoser: number;
    profitFactor: number;
    avgHoldingDays: number;
    bestTrade: BacktestTrade | null;
    worstTrade: BacktestTrade | null;
    monthlyReturns: { month: string; return: number; benchReturn: number }[];
    sectorBreakdown: { sector: string; trades: number; pnl: number; winRate: number }[];
    vixRegimeBreakdown?: { regime: string; trades: number; pnl: number; winRate: number }[];
    earningsZoneBreakdown?: { zone: string; trades: number; pnl: number; winRate: number; blocked: number }[];
}

export interface BacktestResult {
    id: string;
    config: BacktestConfig;
    metrics: BacktestMetrics;
    equityCurve: DailyEquityPoint[];
    trades: BacktestTrade[];
    startedAt: string;
    completedAt: string;
    status: 'running' | 'completed' | 'failed';
    error?: string;
    progress?: number;
}
