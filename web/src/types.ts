export type MetricRoute = "normal" | "turnaround" | "excluded" | "data_unavailable";

export interface MetricResult {
  metric: "pe" | "pfcf" | "pb";
  route: MetricRoute;
  discountPct: number | null;
  flags: string[];
  reason: string;
  currentMultiple: number | null;
  historicalAverage: number | null;
  comparisonMethod: "arithmetic_mean";
  window: "3m" | "6m" | "12m" | "3y" | "5y";
  validObservations: number;
  expectedObservations: number;
  coveragePct: number;
  thresholdPct: number;
  passesThreshold: boolean;
  currentDenominator: number | null;
  denominatorLabel: string;
  denominatorUnit: string;
  denominatorPeriodEnd: string | null;
  denominatorAvailableAt: string | null;
  normalizationMethod: string | null;
  filingAccessions: string[];
  shareCount: number | null;
  sharePeriodEnd: string | null;
  shareAvailableAt: string | null;
  shareRetrievedAt: string | null;
  shareFilingAccession: string | null;
  shareNormalizationMethod: string | null;
}

export interface Candidate {
  cik: string;
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCapMillions: number;
  averageDailyDollarVolume: number;
  liquidityWindowDays: number;
  price: number;
  revenueGrowthPct: number | null;
  operatingMarginPct: number | null;
  netDebtToEbitda: number | null;
  returnOnEquityPct: number | null;
  interestCoverage: number | null;
  shareDilutionPct: number | null;
  cashConversionPct: number | null;
  metrics: MetricResult[];
  flags: string[];
  bestDiscountPct: number | null;
  filingAccessions: string[];
  source: string;
  asOf: string;
  methodologyVersion: string;
  retrievedAt: string;
  availableAt: string;
  lineageNote: string;
}

export interface ScreenSettings {
  discount_pe: number;
  discount_pfcf: number;
  discount_pb: number;
  predominantly_positive_ratio: number;
  combination: "or" | "and" | "pe_only" | "pfcf_only";
  min_market_cap_millions: number;
  min_average_daily_dollar_volume: number;
  liquidity_window_days: number;
  comparison_window: "3m" | "6m" | "12m";
  exchanges: string[];
}

export interface ScreenResponse {
  screenRunId: string | null;
  generatedAt: string;
  mode: "unavailable" | "live";
  statusMessage: string;
  normal: Candidate[];
  turnaround: Candidate[];
  counts: {
    universe: number;
    afterUniverseFilters: number;
    normal: number;
    turnaround: number;
  };
}

export interface LatestScreenResponse {
  available: boolean;
  maxAgeHours: number;
  expiresAt?: string;
  settings?: ScreenSettings;
  result?: ScreenResponse;
}

export interface ResearchEvidence {
  chunk_id: string;
  accession: string;
  form: string;
  filed_at: string;
  source_url: string;
  text: string;
}

export interface ResearchReport {
  id: string;
  exchange: string;
  ticker: string;
  generatedAt: string;
  provider: string;
  model: string;
  analysis: {
    summary: { text: string; citations: string[] };
    possible_explanations: Array<{
      title: string;
      explanation: string;
      confidence: "low" | "medium" | "high";
      citations: string[];
    }>;
    counterpoints: Array<{ text: string; citations: string[] }>;
    unknowns: string[];
    quantitative_context?: {
      available: boolean;
      as_of?: string | null;
      screen_generated_at?: string | null;
      price?: number | null;
      market_cap_millions?: number | null;
      revenue_growth_pct?: number | null;
      return_on_equity_pct?: number | null;
      share_dilution_pct?: number | null;
      cash_conversion_pct?: number | null;
      valuation_metrics?: Array<{
        metric: "pe" | "pfcf" | "pb";
        currentMultiple: number | null;
        historicalAverage: number | null;
        discountPct: number | null;
        thresholdPct: number;
        window: string;
      }>;
    };
    final_recommendation?: {
      rating?: "buy" | "hold" | "sell";
      stance?: "investigate_further" | "watch" | "pass_for_now";
      confidence?: "low" | "medium" | "high";
      quantitative_assessment?: string;
      filing_assessment?: string;
      rationale: string;
      key_risks?: string[];
      next_step: string;
      citations: string[];
    };
  };
  evidence: ResearchEvidence[];
  limitations: string[];
}

export interface ResearchJob {
  id: string;
  screenRunId?: string;
  exchange: string;
  ticker: string;
  status: "queued" | "running" | "succeeded" | "failed";
  phase: string;
  error: string | null;
  requestedAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  queuePosition?: number | null;
  report: ResearchReport | null;
}

export interface LocalModelStatus {
  ready: boolean;
  model: string;
  message: string;
}

export interface ResearchLibrary {
  jobs: ResearchJob[];
  reports: ResearchReport[];
  reportOffset: number;
  hasMoreReports: boolean;
  counts: { active: number; completed: number; failed: number };
}

export interface DataHealthResponse {
  mode: string;
  summary: string;
  coverage?: {
    eligible: number;
    fundamentals: number;
    prices: number;
    joined: number;
    materialized: number;
  };
  sources: Array<{
    name: string;
    capability: string;
    freshness: string;
    coverage: string;
    lastSuccess: string | null;
    latestObservation?: string | null;
    warning?: string | null;
    error?: string | null;
    recordsSeen?: number;
    recordsWritten?: number;
  }>;
}

export interface MacroResponse {
  mode: string;
  informationalOnly: boolean;
  asOf: string | null;
  cards: Array<{ label: string; value: string; note: string }>;
}

export interface NyseUniverseResponse {
  mode: "live" | "unavailable";
  freshness: "fresh" | "stale" | "failed" | "unavailable";
  lastRefreshStatus: "running" | "succeeded" | "failed" | null;
  exchange: "NYSE";
  source: string;
  retrievedAt: string | null;
  counts: { total: number; candidates: number; excluded: number; filtered: number };
  limit: number;
  offset: number;
  items: Array<{
    ticker: string;
    name: string;
    securityType: string;
    classificationState: "pending" | "excluded";
    warning: string;
    retrievedAt: string;
  }>;
  limitations: string[];
}
