import type {
  Candidate,
  DataHealthResponse,
  LatestScreenResponse,
  LocalModelStatus,
  MacroResponse,
  MetricResult,
  NyseUniverseResponse,
  ResearchJob,
  ResearchLibrary,
  ResearchReport,
  ScreenResponse,
  ScreenSettings,
} from "./types";

const generatedAt = "2026-10-15T20:00:00Z";
const asOf = "2026-10-15";
const windowObservations: Record<ScreenSettings["comparison_window"], number> = {
  "3m": 63,
  "6m": 126,
  "12m": 252,
};

function metric(
  kind: MetricResult["metric"],
  currentMultiple: number | null,
  historicalAverage: number | null,
  discountPct: number | null,
  route: MetricResult["route"] = "normal",
): MetricResult {
  return {
    metric: kind,
    route,
    discountPct,
    flags: [],
    reason: route === "turnaround"
      ? "The latest denominator is negative; this case is separated for turnaround review."
      : "The current multiple and illustrative historical comparison are usable.",
    currentMultiple,
    historicalAverage,
    comparisonMethod: "arithmetic_mean",
    window: "12m",
    validObservations: 252,
    expectedObservations: 252,
    coveragePct: 100,
    thresholdPct: 20,
    passesThreshold: discountPct !== null && discountPct >= 20,
    currentDenominator: currentMultiple === null ? -18_000_000 : 186_000_000,
    denominatorLabel: kind === "pe" ? "Illustrative TTM net income" : kind === "pfcf" ? "Illustrative TTM free cash flow" : "Illustrative common equity",
    denominatorUnit: "USD",
    denominatorPeriodEnd: "2026-09-30",
    denominatorAvailableAt: "2026-10-08T20:00:00Z",
    normalizationMethod: "portfolio_demo_v1",
    filingAccessions: [],
    shareCount: 48_000_000,
    sharePeriodEnd: "2026-09-30",
    shareAvailableAt: "2026-10-08T20:00:00Z",
    shareRetrievedAt: generatedAt,
    shareFilingAccession: null,
    shareNormalizationMethod: "portfolio_demo_v1",
  };
}

function candidate(overrides: Partial<Candidate> & Pick<Candidate, "ticker" | "name" | "price" | "marketCapMillions" | "metrics">): Candidate {
  return {
    cik: `demo-${overrides.ticker.toLowerCase()}`,
    exchange: "NYSE",
    sector: "Illustrative sector",
    industry: "Illustrative industry",
    averageDailyDollarVolume: 18_500_000,
    liquidityWindowDays: 20,
    revenueGrowthPct: 8.4,
    operatingMarginPct: 13.7,
    netDebtToEbitda: 1.8,
    returnOnEquityPct: 12.6,
    interestCoverage: 6.9,
    shareDilutionPct: -1.2,
    cashConversionPct: 104,
    flags: ["REVENUE_GROWTH_VALUATION_COMPRESSION"],
    bestDiscountPct: Math.max(...overrides.metrics.map((item) => item.discountPct ?? Number.NEGATIVE_INFINITY)),
    filingAccessions: [],
    source: "Illustrative portfolio dataset — not live market data",
    asOf,
    methodologyVersion: "portfolio_demo_v1",
    retrievedAt: generatedAt,
    availableAt: generatedAt,
    lineageNote: "Fabricated values used only to demonstrate the public interface.",
    ...overrides,
  };
}

const baseCandidates: Candidate[] = [
  candidate({
    ticker: "DEMO-A",
    name: "Northstar Industrial Systems (illustrative)",
    price: 42.60,
    marketCapMillions: 2_045,
    sector: "Industrials",
    industry: "Specialty machinery",
    revenueGrowthPct: 11.2,
    metrics: [metric("pe", 13.4, 19.8, 32.3), metric("pfcf", 12.1, 16.3, 25.8), metric("pb", 0.92, 1.18, 22.0)],
    flags: ["REVENUE_GROWTH_VALUATION_COMPRESSION", "PB_BELOW_ONE_REVIEW"],
  }),
  candidate({
    ticker: "DEMO-B",
    name: "Harborline Health Services (illustrative)",
    price: 68.25,
    marketCapMillions: 6_880,
    sector: "Health care",
    industry: "Managed services",
    revenueGrowthPct: 5.7,
    returnOnEquityPct: 16.2,
    metrics: [metric("pe", 18.6, 22.0, 15.5), metric("pfcf", 14.2, 20.6, 31.1), metric("pb", 2.1, 2.35, 10.6)],
  }),
  candidate({
    ticker: "DEMO-C",
    name: "Apex Consumer Group (illustrative turnaround)",
    price: 17.90,
    marketCapMillions: 912,
    sector: "Consumer discretionary",
    industry: "Specialty retail",
    revenueGrowthPct: 3.9,
    operatingMarginPct: -0.8,
    returnOnEquityPct: -2.4,
    metrics: [metric("pe", null, 24.8, null, "turnaround"), metric("pfcf", 8.9, 12.4, 28.2), metric("pb", 0.76, 0.91, 16.5)],
    flags: ["RECENTLY_NEGATIVE_EARNINGS", "PB_BELOW_ONE_REVIEW", "REVENUE_GROWTH_VALUATION_COMPRESSION"],
  }),
  candidate({
    ticker: "DEMO-D",
    name: "Summit Data Infrastructure (illustrative)",
    price: 31.40,
    marketCapMillions: 1_430,
    sector: "Information technology",
    industry: "Infrastructure software",
    revenueGrowthPct: -1.1,
    metrics: [metric("pe", 27.4, 30.2, 9.3), metric("pfcf", 24.8, 27.1, 8.5), metric("pb", 3.2, 3.35, 4.5)],
    flags: [],
  }),
];

const windowAverages: Record<string, Record<MetricResult["metric"], Record<ScreenSettings["comparison_window"], number>>> = {
  "DEMO-A": {
    pe: { "3m": 17.2, "6m": 18.4, "12m": 19.8 },
    pfcf: { "3m": 14.1, "6m": 15.2, "12m": 16.3 },
    pb: { "3m": 1.05, "6m": 1.12, "12m": 1.18 },
  },
  "DEMO-B": {
    pe: { "3m": 20.5, "6m": 21.3, "12m": 22.0 },
    pfcf: { "3m": 18.0, "6m": 19.2, "12m": 20.6 },
    pb: { "3m": 2.2, "6m": 2.28, "12m": 2.35 },
  },
  "DEMO-C": {
    pe: { "3m": 21.0, "6m": 23.0, "12m": 24.8 },
    pfcf: { "3m": 10.6, "6m": 11.5, "12m": 12.4 },
    pb: { "3m": 0.82, "6m": 0.86, "12m": 0.91 },
  },
  "DEMO-D": {
    pe: { "3m": 28.5, "6m": 29.2, "12m": 30.2 },
    pfcf: { "3m": 25.4, "6m": 26.2, "12m": 27.1 },
    pb: { "3m": 3.25, "6m": 3.30, "12m": 3.35 },
  },
};

const positiveHistoryRatios: Record<string, Record<MetricResult["metric"], number>> = {
  "DEMO-A": { pe: 0.96, pfcf: 0.96, pb: 1 },
  "DEMO-B": { pe: 0.85, pfcf: 0.94, pb: 1 },
  "DEMO-C": { pe: 0.45, pfcf: 0.91, pb: 0.98 },
  "DEMO-D": { pe: 0.97, pfcf: 0.97, pb: 1 },
};

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function liquidityFor(candidate: Candidate, days: number): number {
  const observations = Array.from({ length: 252 }, (_, index) => {
    const tickerOffset = candidate.ticker.charCodeAt(candidate.ticker.length - 1) - 65;
    const trend = 0.94 + (index / 251) * (0.08 + tickerOffset * 0.006);
    const cycle = Math.sin((index + tickerOffset * 7) / 13) * 0.025;
    return candidate.averageDailyDollarVolume * (trend + cycle);
  });
  const effectiveDays = Math.min(Math.max(Math.round(days), 1), observations.length);
  const selected = observations.slice(-effectiveDays);
  return round(selected.reduce((sum, value) => sum + value, 0) / selected.length, 0);
}

function enabledMetrics(settings: ScreenSettings): Array<"pe" | "pfcf"> {
  if (settings.combination === "pe_only") return ["pe"];
  if (settings.combination === "pfcf_only") return ["pfcf"];
  return ["pe", "pfcf"];
}

export function buildDemoScreen(settings: ScreenSettings): ScreenResponse {
  const selectedMetrics = enabledMetrics(settings);
  const thresholdFor = (kind: MetricResult["metric"]) => kind === "pe" ? settings.discount_pe : kind === "pfcf" ? settings.discount_pfcf : settings.discount_pb;
  const prepared = baseCandidates.map((item) => {
    const metrics = item.metrics.map((itemMetric) => {
      const historicalAverage = windowAverages[item.ticker][itemMetric.metric][settings.comparison_window];
      const discountPct = itemMetric.currentMultiple === null
        ? null
        : round(((historicalAverage - itemMetric.currentMultiple) / historicalAverage) * 100);
      const positiveHistoryPasses = itemMetric.route === "turnaround"
        || positiveHistoryRatios[item.ticker][itemMetric.metric] >= settings.predominantly_positive_ratio;
      const route = !positiveHistoryPasses && itemMetric.route === "normal" ? "excluded" as const : itemMetric.route;
      const thresholdPct = thresholdFor(itemMetric.metric);
      return {
        ...itemMetric,
        route,
        reason: route === "excluded"
          ? "Too much of the selected history was negative for a normal valuation comparison."
          : itemMetric.reason,
        flags: route === "excluded" ? [...itemMetric.flags, "POSITIVE_HISTORY_REQUIREMENT_NOT_MET"] : itemMetric.flags,
        historicalAverage,
        discountPct,
        thresholdPct,
        passesThreshold: route === "normal" && discountPct !== null && discountPct >= thresholdPct,
        window: settings.comparison_window,
        validObservations: windowObservations[settings.comparison_window],
        expectedObservations: windowObservations[settings.comparison_window],
      };
    });
    return {
      ...item,
      averageDailyDollarVolume: liquidityFor(item, settings.liquidity_window_days),
      liquidityWindowDays: settings.liquidity_window_days,
      metrics,
      bestDiscountPct: Math.max(...metrics.map((entry) => entry.discountPct ?? Number.NEGATIVE_INFINITY)),
    };
  });
  const universe = prepared.filter((item) =>
    settings.exchanges.includes(item.exchange)
    && item.marketCapMillions >= settings.min_market_cap_millions
    && item.averageDailyDollarVolume >= settings.min_average_daily_dollar_volume,
  );
  const passes = universe.filter((item) => {
    const outcomes = selectedMetrics.map((kind) => item.metrics.find((entry) => entry.metric === kind)?.passesThreshold === true);
    return settings.combination === "and" ? outcomes.every(Boolean) : outcomes.some(Boolean);
  });
  const turnaround: Candidate[] = [];
  const normal: Candidate[] = [];
  passes.forEach((item) => {
    const hasSelectedTurnaround = selectedMetrics.some((kind) => item.metrics.some((entry) => entry.metric === kind && entry.route === "turnaround"));
    (hasSelectedTurnaround ? turnaround : normal).push(item);
  });
  return {
    screenRunId: "portfolio-demo-run",
    generatedAt,
    mode: "live",
    statusMessage: "Interactive results calculated from a small illustrative portfolio dataset.",
    normal,
    turnaround,
    counts: { universe: baseCandidates.length, afterUniverseFilters: universe.length, normal: normal.length, turnaround: turnaround.length },
  };
}

const demoSettings: ScreenSettings = {
  discount_pe: 20,
  discount_pfcf: 20,
  discount_pb: 20,
  predominantly_positive_ratio: 0.8,
  combination: "or",
  min_market_cap_millions: 200,
  min_average_daily_dollar_volume: 2_000_000,
  liquidity_window_days: 20,
  comparison_window: "12m",
  exchanges: ["NASDAQ", "NYSE", "NYSE AMERICAN"],
};

const reports: ResearchReport[] = [
  {
    id: "demo-report-a",
    exchange: "NYSE",
    ticker: "DEMO-A",
    generatedAt,
    provider: "portfolio_demo",
    model: "illustrative_only",
    analysis: {
      summary: { text: "Illustrative research summary: valuation compression coincides with continued revenue growth, while cyclical demand and execution risk warrant further diligence.", citations: [] },
      possible_explanations: [
        { title: "Cyclical expectations", explanation: "The sample scenario assumes investors have reduced the multiple because forward demand is less certain than trailing results suggest.", confidence: "medium", citations: [] },
        { title: "Margin investment", explanation: "The sample filing narrative describes near-term spending that could pressure margins before expected efficiency gains arrive.", confidence: "medium", citations: [] },
      ],
      counterpoints: [{ text: "A lower multiple may reflect a durable earnings slowdown rather than temporary pessimism.", citations: [] }],
      unknowns: ["Forward order conversion", "Durability of margin improvement", "Capital allocation priorities"],
      quantitative_context: {
        available: true,
        as_of: asOf,
        screen_generated_at: generatedAt,
        price: 42.60,
        market_cap_millions: 2_045,
        revenue_growth_pct: 11.2,
        return_on_equity_pct: 12.6,
        share_dilution_pct: -1.2,
        cash_conversion_pct: 104,
        valuation_metrics: [
          { metric: "pe", currentMultiple: 13.4, historicalAverage: 19.8, discountPct: 32.3, thresholdPct: 20, window: "12m" },
          { metric: "pfcf", currentMultiple: 12.1, historicalAverage: 16.3, discountPct: 25.8, thresholdPct: 20, window: "12m" },
          { metric: "pb", currentMultiple: 0.92, historicalAverage: 1.18, discountPct: 22.0, thresholdPct: 20, window: "12m" },
        ],
      },
      final_recommendation: {
        rating: "hold",
        confidence: "medium",
        quantitative_assessment: "The illustrative P/E and P/FCF multiples clear the configured 20% discount while revenue remains positive; P/B below one is retained only as a review flag.",
        filing_assessment: "The example narrative points to cyclical uncertainty and deliberate investment as plausible reasons for compression, but it does not establish that the discount is temporary.",
        rationale: "The combined sample evidence supports continued investigation rather than an automatic purchase. Valuation is attractive relative to the fabricated trailing history, but forward demand must be validated.",
        key_risks: ["Demand weakness persists", "Margin investment produces limited returns", "The historical average is no longer representative"],
        next_step: "Compare the next quarterly order update and margin bridge with management's stated milestones.",
        citations: [],
      },
    },
    evidence: [],
    limitations: ["This is a fabricated portfolio demonstration. It contains no real company, filing, price, or investment recommendation."],
  },
  {
    id: "demo-report-c",
    exchange: "NYSE",
    ticker: "DEMO-C",
    generatedAt: "2026-10-14T18:30:00Z",
    provider: "portfolio_demo",
    model: "illustrative_only",
    analysis: {
      summary: { text: "Illustrative turnaround report: free-cash-flow valuation qualifies, but recent negative earnings keep the company separate from normal compression candidates.", citations: [] },
      possible_explanations: [{ title: "Restructuring period", explanation: "The sample narrative assumes restructuring expenses and weak store productivity drove the recent loss.", confidence: "medium", citations: [] }],
      counterpoints: [{ text: "Positive free cash flow may be temporary if working-capital benefits reverse.", citations: [] }],
      unknowns: ["Normalized earnings power", "Lease-adjusted leverage", "Store-level recovery"],
      quantitative_context: {
        available: true,
        as_of: asOf,
        price: 17.90,
        market_cap_millions: 912,
        revenue_growth_pct: 3.9,
        return_on_equity_pct: -2.4,
        valuation_metrics: [
          { metric: "pe", currentMultiple: null, historicalAverage: 24.8, discountPct: null, thresholdPct: 20, window: "12m" },
          { metric: "pfcf", currentMultiple: 8.9, historicalAverage: 12.4, discountPct: 28.2, thresholdPct: 20, window: "12m" },
        ],
      },
      final_recommendation: {
        rating: "sell",
        confidence: "low",
        quantitative_assessment: "The illustrative P/FCF discount qualifies, but negative earnings and weak ROE make the case dependent on a turnaround.",
        filing_assessment: "The sample restructuring explanation is plausible, though evidence of a durable recovery is intentionally incomplete.",
        rationale: "The sample risk/reward does not justify ownership until earnings recovery and cash-flow durability are demonstrated.",
        key_risks: ["Cash conversion reverses", "Losses persist", "Restructuring takes longer than assumed"],
        next_step: "Wait for positive normalized earnings and verify that free cash flow excludes one-time working-capital effects.",
        citations: [],
      },
    },
    evidence: [],
    limitations: ["This is a fabricated portfolio demonstration. It contains no real company, filing, price, or investment recommendation."],
  },
];

const health: DataHealthResponse = {
  mode: "portfolio_demo",
  summary: "This public build uses a small, fabricated dataset so no private database, credentials, or licensed market-data cache is exposed.",
  coverage: { eligible: 4, fundamentals: 4, prices: 4, joined: 4, materialized: 4 },
  sources: [
    { name: "Illustrative company facts", capability: "Portfolio demonstration", freshness: "fixed", coverage: "complete", lastSuccess: generatedAt },
    { name: "Illustrative valuation history", capability: "Interactive screen controls", freshness: "fixed", coverage: "complete", lastSuccess: generatedAt },
    { name: "Illustrative research reports", capability: "Report-library demonstration", freshness: "fixed", coverage: "partial", lastSuccess: generatedAt },
  ],
};

const universeItems: NyseUniverseResponse["items"] = baseCandidates.map((item) => ({
  ticker: item.ticker,
  name: item.name,
  securityType: "illustrative_common_stock",
  classificationState: "pending",
  warning: "Fabricated listing included only to demonstrate search and classification UI.",
  retrievedAt: generatedAt,
}));

export const demoApi = {
  latestScreen: async (_signal?: AbortSignal): Promise<LatestScreenResponse> => ({ available: false, maxAgeHours: 72 }),
  screen: async (settings: ScreenSettings, _signal?: AbortSignal): Promise<ScreenResponse> => buildDemoScreen(settings),
  dataHealth: async (_signal?: AbortSignal): Promise<DataHealthResponse> => health,
  macro: async (_signal?: AbortSignal): Promise<MacroResponse> => ({
    mode: "portfolio_demo",
    informationalOnly: true,
    asOf,
    cards: [
      { label: "Broad market", value: "Neutral", note: "Illustrative context only; never used as a stock-screening filter." },
      { label: "Credit conditions", value: "Watch", note: "Example qualitative dashboard state." },
      { label: "Cyclical sectors", value: "Mixed", note: "Displayed separately from company qualification." },
    ],
  }),
  nyseUniverse: async (search = "", offset = 0, _signal?: AbortSignal): Promise<NyseUniverseResponse> => {
    const term = search.trim().toLowerCase();
    const filtered = universeItems.filter((item) => !term || item.ticker.toLowerCase().includes(term) || item.name.toLowerCase().includes(term));
    return {
      mode: "live",
      freshness: "fresh",
      lastRefreshStatus: "succeeded",
      exchange: "NYSE",
      source: "Fabricated portfolio dataset",
      retrievedAt: generatedAt,
      counts: { total: universeItems.length, candidates: universeItems.length, excluded: 0, filtered: filtered.length },
      limit: 100,
      offset,
      items: filtered.slice(offset, offset + 100),
      limitations: ["This portfolio edition contains illustrative securities only and is not an exchange directory."],
    };
  },
  localModel: async (_signal?: AbortSignal): Promise<LocalModelStatus> => ({ ready: true, model: "static-demo", message: "Sample reports only; this public build makes no AI calls." }),
  researchLibrary: async (reportOffset = 0, _signal?: AbortSignal): Promise<ResearchLibrary> => ({
    jobs: [],
    reports: reports.slice(reportOffset, reportOffset + 25),
    reportOffset,
    hasMoreReports: false,
    counts: { active: 0, completed: reports.length, failed: 0 },
  }),
  startResearch: async (_screenRunId: string, _companies: Array<Pick<Candidate, "exchange" | "ticker">>): Promise<{ jobs: ResearchJob[] }> => {
    throw new Error("This public portfolio edition is read-only. Open Deep Research to explore the sample reports.");
  },
  researchJob: async (jobId: string, _signal?: AbortSignal): Promise<ResearchJob> => ({
    id: jobId,
    exchange: "NYSE",
    ticker: "DEMO",
    status: "failed",
    phase: "Portfolio demo",
    error: "Research jobs are disabled in the public portfolio edition.",
    report: null,
  }),
};

export const demoInitialSettings = demoSettings;
