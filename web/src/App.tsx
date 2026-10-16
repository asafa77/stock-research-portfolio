import { FormEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { portfolioMode } from "./config";
import type { Candidate, DataHealthResponse, LocalModelStatus, MacroResponse, NyseUniverseResponse, ResearchJob, ResearchReport, ScreenResponse, ScreenSettings } from "./types";
import "./styles.css";

export function isPriceRefreshStale(lastSuccess: string | null | undefined, nowMs = Date.now()) {
  if (!lastSuccess) return true;
  const refreshedAtMs = new Date(lastSuccess).getTime();
  return !Number.isFinite(refreshedAtMs) || nowMs - refreshedAtMs > 24 * 60 * 60 * 1000;
}

const defaultSettings: ScreenSettings = {
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

const flagLabels: Record<string, string> = {
  REVENUE_GROWTH_VALUATION_COMPRESSION: "Revenue growth + compression",
  PB_BELOW_ONE_REVIEW: "P/B below 1 — review",
  RECENTLY_NEGATIVE_EARNINGS: "Recently negative earnings",
  RECENTLY_NEGATIVE_FCF: "Recently negative FCF",
  NEGATIVE_BOOK_VALUE: "Negative book value",
  INSUFFICIENT_HISTORY: "Insufficient history",
};

function MetricPill({ candidate, metric }: { candidate: Candidate; metric: "pe" | "pfcf" | "pb" }) {
  const value = candidate.metrics.find((item) => item.metric === metric);
  const label = metric === "pe" ? "P/E" : metric === "pfcf" ? "P/FCF" : "P/B";
  const discountLabel = value?.discountPct == null
    ? value?.route === "turnaround" ? "Current value negative" : "Not available"
    : value.discountPct >= 0
      ? `${value.discountPct.toFixed(1)}% below`
      : `${Math.abs(value.discountPct).toFixed(1)}% above`;
  const stateLabel = value?.route === "turnaround"
    ? "Recent loss"
    : value?.route === "normal" && value.passesThreshold
      ? metric === "pb" ? "Meets threshold" : "Qualifies"
      : value?.route === "normal"
        ? "Below threshold"
        : value?.route === "excluded"
          ? "Excluded"
          : "Unavailable";
  return (
    <div className={`metric-pill ${value?.route ?? "data_unavailable"}`} title={value?.reason}>
      <div className="metric-head"><span>{label}</span><span className="metric-state">{stateLabel}</span></div>
      <strong className="metric-discount">{discountLabel}</strong>
      <div className="metric-comparison">
        <span><small>Current</small><b>{value?.currentMultiple == null ? "N/A" : `${value.currentMultiple.toFixed(2)}×`}</b></span>
        <span><small>{value?.window ?? "—"} average</small><b>{value?.historicalAverage == null ? "N/A" : `${value.historicalAverage.toFixed(2)}×`}</b></span>
      </div>
      <p className="metric-observations">Needs {value?.thresholdPct ?? 0}% below · {value?.validObservations ?? 0}/{value?.expectedObservations ?? 0} daily observations</p>
      <details className="metric-details">
        <summary>Calculation details</summary>
        <p>{value?.denominatorLabel}: {value?.currentDenominator == null ? "unavailable" : `${value.currentDenominator.toLocaleString()} ${value.denominatorUnit}`}</p>
        {value?.shareCount != null && <p>Market-cap shares: {value.shareCount.toLocaleString()} · period {value.sharePeriodEnd} · SEC {value.shareFilingAccession}</p>}
      </details>
    </div>
  );
}

function CandidateCard({ candidate, turnaround = false, researchState, onResearch, demo = false }: { candidate: Candidate; turnaround?: boolean; researchState: "starting" | "queued" | "running" | null; onResearch: () => void; demo?: boolean }) {
  const urgent = candidate.flags.includes("REVENUE_GROWTH_VALUATION_COMPRESSION");
  return (
    <article className={`candidate-card ${urgent ? "urgent" : ""}`}>
      <div className="candidate-heading">
        <div>
          <div className="ticker-line"><span className="ticker">{candidate.ticker}</span><span>{candidate.exchange}</span></div>
          <h3>{candidate.name}</h3>
          <p>{candidate.sector} · {candidate.industry}</p>
        </div>
        <div className="candidate-actions"><button type="button" className={`select-company ${researchState ? "selected" : ""}`} disabled={!demo && researchState !== null} onClick={onResearch}>{demo ? "View sample research" : researchState === "starting" ? <><span className="inline-spinner"></span>Starting research…</> : researchState === "running" ? "Deep research in progress" : researchState === "queued" ? "Queued for deep research" : "Start deep research"}</button><div className="price-block"><strong>${candidate.price.toFixed(2)}</strong><span>${candidate.marketCapMillions.toLocaleString()}M cap</span></div></div>
      </div>
      <div className="metric-row">
        <MetricPill candidate={candidate} metric="pe" />
        <MetricPill candidate={candidate} metric="pfcf" />
        <MetricPill candidate={candidate} metric="pb" />
      </div>
      <div className="fundamentals">
        <div><span>Revenue growth</span><strong className={(candidate.revenueGrowthPct ?? 0) > 0 ? "positive" : ""}>{candidate.revenueGrowthPct == null ? "Unavailable" : `${candidate.revenueGrowthPct.toFixed(1)}%`}</strong></div>
        <div><span>Operating margin</span><strong>{candidate.operatingMarginPct == null ? "Unavailable" : `${candidate.operatingMarginPct.toFixed(1)}%`}</strong></div>
        <div><span>Net debt / EBITDA</span><strong>{candidate.netDebtToEbitda == null ? "N/A" : `${candidate.netDebtToEbitda.toFixed(1)}×`}</strong></div>
        <div><span>ROE</span><strong>{candidate.returnOnEquityPct == null ? "Unavailable" : `${candidate.returnOnEquityPct.toFixed(1)}%`}</strong></div>
        <div><span>Interest coverage</span><strong>{candidate.interestCoverage == null ? "Unavailable" : `${candidate.interestCoverage.toFixed(1)}×`}</strong></div>
        <div><span>Share dilution</span><strong>{candidate.shareDilutionPct == null ? "Unavailable" : `${candidate.shareDilutionPct.toFixed(1)}%`}</strong></div>
        <div><span>Cash conversion</span><strong>{candidate.cashConversionPct == null ? "Unavailable" : `${candidate.cashConversionPct.toFixed(0)}%`}</strong></div>
      </div>
      {candidate.flags.length > 0 && <div className="flag-list" aria-label="Review flags">
        {candidate.flags.map((flag) => <span className={flag.includes("REVENUE_GROWTH") ? "high" : ""} key={flag}>{flagLabels[flag] ?? flag}</span>)}
      </div>}
      <footer><span>{turnaround ? "Turnaround review" : "Normal valuation-compression candidate"}</span><span>{demo ? "Illustrative data" : "Market data"} as of {candidate.asOf}</span></footer>
      <details className="lineage-details"><summary>Data source & methodology</summary><p>{candidate.source} · {candidate.methodologyVersion} · available {candidate.availableAt.slice(0, 10)} · retrieved {candidate.retrievedAt.slice(0, 10)} · SEC {candidate.filingAccessions.join(", ") || "lineage unavailable"}</p></details>
    </article>
  );
}

function EvidenceLinks({ report, citations }: { report: ResearchReport; citations: string[] }) {
  return <div className="citation-list">{citations.map((citation) => {
    const evidence = report.evidence.find((entry) => entry.chunk_id === citation);
    return evidence ? <a key={citation} href={evidence.source_url} target="_blank" rel="noreferrer" title={evidence.text.slice(0, 500)}>{evidence.form} · {evidence.filed_at}</a> : null;
  })}</div>;
}

function ResearchReportCard({ report }: { report: ResearchReport }) {
  const recommendation = report.analysis.final_recommendation;
  const recommendationLabel = recommendation?.rating ? recommendation.rating.toUpperCase() : recommendation?.stance === "investigate_further" ? "Investigate further" : recommendation?.stance === "watch" ? "Watch" : "Pass for now";
  const recommendationClass = recommendation?.rating ?? recommendation?.stance ?? "legacy";
  const quantitative = report.analysis.quantitative_context;
  return <article className="research-job stored-report">
    <div className="research-job-head"><div><strong>{report.ticker}</strong><span>{report.exchange} · retrieved {new Date(report.generatedAt).toLocaleString()}</span></div><span className="job-status succeeded">Stored locally</span></div>
    <div className="research-report">
      <p className="report-summary">{report.analysis.summary.text}</p>
      <EvidenceLinks report={report} citations={report.analysis.summary.citations} />
      {recommendation && <section className={`final-recommendation ${recommendationClass}`} aria-label="Final recommendation">
        <div className="recommendation-heading"><span>Final recommendation</span><strong>{recommendationLabel}</strong>{recommendation.confidence && <em>{recommendation.confidence} confidence</em>}</div>
        {quantitative?.as_of && <div className="recommendation-data-date">Valuation and market data as of <strong>{quantitative.as_of}</strong></div>}
        {quantitative?.available && <div className="recommendation-stats" aria-label="Quantitative snapshot">
          {quantitative.valuation_metrics?.filter((metric) => metric.currentMultiple != null).map((metric) => <div key={metric.metric}><span>{metric.metric === "pe" ? "P/E" : metric.metric === "pfcf" ? "P/FCF" : "P/B"}</span><strong>{metric.currentMultiple!.toFixed(2)}×</strong><small>{metric.discountPct == null ? "No comparison" : `${metric.discountPct.toFixed(1)}% below ${metric.window} average`}</small></div>)}
          {quantitative.revenue_growth_pct != null && <div><span>Revenue growth</span><strong>{quantitative.revenue_growth_pct.toFixed(1)}%</strong><small>Latest TTM year over year</small></div>}
          {quantitative.return_on_equity_pct != null && <div><span>ROE</span><strong>{quantitative.return_on_equity_pct.toFixed(1)}%</strong><small>Current fundamental context</small></div>}
        </div>}
        {(recommendation.quantitative_assessment || recommendation.filing_assessment) && <div className="recommendation-evidence-grid">
          {recommendation.quantitative_assessment && <div><span>Valuation & fundamentals</span><p>{recommendation.quantitative_assessment}</p></div>}
          {recommendation.filing_assessment && <div><span>SEC filing evidence</span><p>{recommendation.filing_assessment}</p></div>}
        </div>}
        <div className="recommendation-thesis"><span>Combined view</span><p>{recommendation.rationale}</p></div>
        {recommendation.key_risks?.length ? <div className="recommendation-risks"><span>Key risks</span><ul>{recommendation.key_risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></div> : null}
        <div className="recommendation-next"><span>Next diligence step</span>{recommendation.next_step}</div><EvidenceLinks report={report} citations={recommendation.citations} /><small>Research opinion only—not an instruction or authorization to trade. Any future paper-trading system must apply separate deterministic portfolio and risk rules.</small>
      </section>}
      <div className="explanation-grid">{report.analysis.possible_explanations.map((item) => <section key={item.title}><span>{item.confidence} confidence</span><h3>{item.title}</h3><p>{item.explanation}</p><EvidenceLinks report={report} citations={item.citations} /></section>)}</div>
      <details><summary>Counterpoints, unknowns & limitations</summary><h4>Counterpoints</h4><ul>{report.analysis.counterpoints.map((item) => <li key={item.text}>{item.text}<EvidenceLinks report={report} citations={item.citations} /></li>)}</ul><h4>Unknowns</h4><ul>{report.analysis.unknowns.map((item) => <li key={item}>{item}</li>)}</ul><ul>{report.limitations.map((item) => <li key={item}>{item}</li>)}</ul></details>
    </div>
  </article>;
}

function DeepResearchWorkspace({ jobs, reports, reportCount, hasMoreReports, modelStatus, busy, error, startingKeys, onRetry, onRetryJob, onLoadMore, demo = false }: { jobs: ResearchJob[]; reports: ResearchReport[]; reportCount: number; hasMoreReports: boolean; modelStatus: LocalModelStatus | null; busy: boolean; error: string | null; startingKeys: string[]; onRetry: () => void; onRetryJob: (job: ResearchJob) => void; onLoadMore: () => void; demo?: boolean }) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const running = jobs.filter((job) => job.status === "running");
  const queued = jobs.filter((job) => job.status === "queued").sort((left, right) => (left.queuePosition ?? Number.MAX_SAFE_INTEGER) - (right.queuePosition ?? Number.MAX_SAFE_INTEGER) || (left.requestedAt ?? "").localeCompare(right.requestedAt ?? ""));
  const active = [...running, ...queued];
  const failed = jobs.filter((job) => job.status === "failed" && !jobs.some((other) => other.id !== job.id && other.exchange === job.exchange && other.ticker === job.ticker && (other.requestedAt ?? "") > (job.requestedAt ?? ""))).slice(0, 5);
  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null;
  return <main className="workspace deep-research-workspace" id="top">
    <section className="deep-research-hero"><div><span className="eyebrow">{demo ? "Illustrative qualitative research" : "Saved qualitative research"}</span><h1>Deep Research</h1><p>{demo ? "Explore fabricated sample outputs that demonstrate the private application's report structure. No filings are retrieved and no AI is called in this public build." : "Track selected-company SEC retrieval and revisit completed, citation-backed reports stored on this computer."}</p></div><span className={`local-model-state ${modelStatus?.ready ? "ready" : "setup"}`}>{demo ? "Static samples" : modelStatus?.ready ? "Local AI ready" : "Local AI setup needed"}</span></section>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={onRetry}>Retry research library</button></div>}
    {active.length > 0 && <section className="retrieval-section" aria-live="polite" aria-labelledby="retrieval-title"><div className="section-heading"><div><span className="eyebrow">Automatic FIFO queue</span><h2 id="retrieval-title">Retrieval queue</h2></div><span className="retrieval-count">{running.length > 0 && <span className="inline-spinner"></span>}{running.length} active · {queued.length} queued</span></div>{active.map((job) => <article className={`research-job retrieval-card ${job.status === "queued" ? "queued-card" : ""}`} key={job.id}><div className="research-job-head"><div><strong>{job.ticker}</strong><span>{job.status === "queued" ? `Queue position ${job.queuePosition ?? queued.findIndex((item) => item.id === job.id) + 1}` : job.phase}</span></div><span className={`job-status ${job.status}`}>{job.status}</span></div>{job.status === "running" ? <><div className="retrieval-progress"><span></span></div><p><span className="inline-spinner"></span>Retrieval is in process. SEC documents and the completed report will be stored locally here.</p></> : <p>Waiting in line. Deep research will start automatically when the company ahead of it finishes.</p>}</article>)}</section>}
    {failed.length > 0 && <section className="research-failures"><h2>Needs attention</h2>{failed.map((job) => { const retrying = startingKeys.includes(`${job.exchange}:${job.ticker}`); return <div className="inline-error research-failure" key={job.id}><strong>{job.ticker}</strong><span>{job.error ?? "Research did not finish."}</span><button type="button" disabled={retrying || !job.screenRunId} onClick={() => onRetryJob(job)}>{retrying ? <><span className="inline-spinner"></span>Retrying…</> : "Retry deep research"}</button></div>; })}</section>}
    <section className="research-results" aria-labelledby="stored-research-title"><div className="research-results-heading"><div><span className="eyebrow">Local research library</span><h2 id="stored-research-title">Completed reports</h2></div><span>{reportCount} stored</span></div>{busy && !reports.length ? <div className="loading-state"><span className="inline-spinner"></span>Loading saved research…</div> : reports.length ? <div className="report-library-layout"><div className="report-index"><p>Select a report to view its full research.</p><ul aria-label="Completed research reports">{reports.map((report) => { const recommendation = report.analysis.final_recommendation; const label = recommendation?.rating?.toUpperCase() ?? (recommendation?.stance === "investigate_further" ? "Investigate" : recommendation?.stance === "watch" ? "Watch" : recommendation?.stance === "pass_for_now" ? "Pass" : "Report"); return <li key={report.id}><button type="button" className={selectedReport?.id === report.id ? "selected" : ""} aria-pressed={selectedReport?.id === report.id} aria-controls={`report-detail-${report.id}`} onClick={() => setSelectedReportId(report.id)}><span className="report-index-main"><strong>{report.ticker}</strong><small>{report.exchange} · {new Date(report.generatedAt).toLocaleDateString()}</small></span><span className={`report-index-rating ${recommendation?.rating ?? "legacy"}`}>{label}</span><span className="report-index-summary">{report.analysis.summary.text}</span><span className="report-index-arrow" aria-hidden="true">›</span></button></li>; })}</ul>{hasMoreReports && <button className="load-more-research" type="button" disabled={busy} onClick={onLoadMore}>{busy ? "Loading…" : "Load more saved reports"}</button>}</div>{selectedReport && <div className="report-detail-panel" id={`report-detail-${selectedReport.id}`} aria-label={`${selectedReport.ticker} research report`}><ResearchReportCard report={selectedReport} /></div>}</div> : <div className="empty-state"><div className="empty-mark">0</div><h3>No completed deep research yet</h3><p>Select companies from the screener and start deep research. Retrieval progress and completed reports will appear here.</p></div>}</section>
  </main>;
}

function ScreenGuide() {
  return <section className="screen-guide" aria-labelledby="screen-guide-title">
    <div className="guide-copy"><span className="eyebrow">In plain English</span><h2 id="screen-guide-title">What this screener is looking for</h2><p>It compares each company’s current valuation with its own recent average, then keeps only companies that meet your size, liquidity, and selected P/E or P/FCF discount rules. P/B adds review context but does not qualify a company. The result is a research shortlist—not a buy recommendation.</p></div>
    <div className="result-legend" aria-label="Results legend"><h3>How to read the results</h3><ul>
      <li><span className="legend-dot qualifies"></span><div><strong>Qualifies</strong><small>A selected valuation measure meets your discount.</small></div></li>
      <li><span className="legend-dot turnaround"></span><div><strong>Turnaround review</strong><small>A selected measure is currently negative, but your P/E/P/FCF combination must still pass. In OR mode, the other measure must qualify.</small></div></li>
      <li><span className="legend-dot priority"></span><div><strong>Priority review</strong><small>Revenue is growing and a selected valuation measure qualifies.</small></div></li>
      <li><span className="legend-dot review"></span><div><strong>Review flag</strong><small>Extra context, such as P/B below 1—not an automatic buy signal.</small></div></li>
    </ul></div>
  </section>;
}

function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const tooltipId = useId();
  return <span className="help-tip-wrap">
    <button type="button" className="help-tip" aria-label={`Explain ${label}`} aria-describedby={tooltipId}>?</button>
    <span className="help-tip-content" id={tooltipId} role="tooltip">{children}</span>
  </span>;
}

function ControlLabel({ htmlFor, children, help }: { htmlFor: string; children: ReactNode; help?: ReactNode }) {
  return <div className="control-caption-row">
    <label className="control-caption" htmlFor={htmlFor}>{children}</label>
    {help && <HelpTip label={String(children)}>{help}</HelpTip>}
  </div>;
}

function SettingsPanel({ settings, onChange, onSubmit, onReset, busy }: {
  settings: ScreenSettings;
  onChange: (next: ScreenSettings) => void;
  onSubmit: (event: FormEvent) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const numeric = (key: keyof ScreenSettings) => (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...settings, [key]: Number(event.target.value) });
  const toggleExchange = (exchange: string) => {
    const selected = settings.exchanges.includes(exchange);
    if (selected && settings.exchanges.length === 1) return;
    onChange({
      ...settings,
      exchanges: selected ? settings.exchanges.filter((item) => item !== exchange) : [...settings.exchanges, exchange],
    });
  };
  return <form className="settings-panel" onSubmit={onSubmit}>
    <div className="panel-title"><div><span className="eyebrow">Screen configuration</span><h2>Research lens</h2></div><span className="default-note">Defaults from specification</span></div>
    <div className="control-grid">
      <div className="control-field"><ControlLabel htmlFor="screen-combination">Screen combination</ControlLabel><select id="screen-combination" value={settings.combination} onChange={(event) => onChange({ ...settings, combination: event.target.value as ScreenSettings["combination"] })}>
        <option value="or">P/E or P/FCF</option><option value="and">P/E and P/FCF</option><option value="pe_only">P/E only</option><option value="pfcf_only">P/FCF only</option>
      </select></div>
      <div className="control-field"><ControlLabel htmlFor="positive-history" help="The share of past daily values that must be positive before the app trusts their average.">Positive-history requirement</ControlLabel><span className="input-suffix"><input id="positive-history" type="number" min="1" max="100" value={settings.predominantly_positive_ratio * 100} onChange={(event) => onChange({ ...settings, predominantly_positive_ratio: Number(event.target.value) / 100 })} /><span>%</span></span></div>
      <div className="control-field"><ControlLabel htmlFor="pe-discount" help="How far today’s price-to-earnings ratio must be below its recent average.">P/E discount</ControlLabel><span className="input-suffix"><input id="pe-discount" type="number" min="0" max="100" value={settings.discount_pe} onChange={numeric("discount_pe")} /><span>%</span></span></div>
      <div className="control-field"><ControlLabel htmlFor="pfcf-discount" help="How far today’s price-to-free-cash-flow ratio must be below its recent average.">P/FCF discount</ControlLabel><span className="input-suffix"><input id="pfcf-discount" type="number" min="0" max="100" value={settings.discount_pfcf} onChange={numeric("discount_pfcf")} /><span>%</span></span></div>
      <div className="control-field"><ControlLabel htmlFor="pb-threshold" help="How far today’s price-to-book ratio must be below its recent average to add a review flag. It does not qualify a company.">P/B review threshold</ControlLabel><span className="input-suffix"><input id="pb-threshold" type="number" min="0" max="100" value={settings.discount_pb} onChange={numeric("discount_pb")} /><span>%</span></span></div>
      <div className="control-field"><ControlLabel htmlFor="market-cap" help="The smallest total stock-market value a company can have and still be included.">Minimum market cap</ControlLabel><span className="input-suffix"><span>$</span><input id="market-cap" type="number" min="0" value={settings.min_market_cap_millions} onChange={numeric("min_market_cap_millions")} /><span>M</span></span></div>
      <div className="control-field"><ControlLabel htmlFor="dollar-volume" help="The minimum average dollar value of shares traded each day. This helps avoid hard-to-trade stocks.">Minimum avg. daily dollar volume</ControlLabel><span className="input-suffix"><span>$</span><input id="dollar-volume" type="number" min="0" value={settings.min_average_daily_dollar_volume} onChange={numeric("min_average_daily_dollar_volume")} /></span></div>
      <div className="control-field"><ControlLabel htmlFor="liquidity-window" help="The number of recent trading days used to calculate average daily dollar volume.">Liquidity window</ControlLabel><input id="liquidity-window" type="number" min="1" max="252" value={settings.liquidity_window_days} onChange={numeric("liquidity_window_days")} /></div>
      <div className="control-field"><ControlLabel htmlFor="comparison-window" help="How far back the app looks when calculating each company’s usual valuation.">Valuation comparison period</ControlLabel><select id="comparison-window" value={settings.comparison_window} onChange={(event) => onChange({ ...settings, comparison_window: event.target.value as ScreenSettings["comparison_window"] })}>
        <option value="3m">3-month moving average</option><option value="6m">6-month moving average</option><option value="12m">12-month moving average</option>
      </select></div>
    </div>
    <fieldset><legend><span>Exchanges</span><HelpTip label="Exchanges">Choose which exchanges may be included. Current live coverage is NYSE only.</HelpTip></legend><div className="exchange-row">{["NASDAQ", "NYSE", "NYSE AMERICAN"].map((exchange) => <label className="check" key={exchange}><input type="checkbox" checked={settings.exchanges.includes(exchange)} onChange={() => toggleExchange(exchange)} />{exchange}</label>)}</div></fieldset>
    <div className="settings-actions"><button type="button" className="ghost" disabled={busy} onClick={onReset}>Reset and run defaults</button><button type="submit" disabled={busy}>{busy ? "Running…" : "Run screen"}<span aria-hidden="true">→</span></button></div>
  </form>;
}

function DataHealth({ health, error, onRetry }: { health: DataHealthResponse | null; error: string | null; onRetry: () => void }) {
  return <section className="health-section" aria-labelledby="health-title">
    <div className="section-heading"><div><span className="eyebrow">Provenance first</span><h2 id="health-title">Data health</h2></div><p>{health?.summary ?? "Checking local sources…"}</p></div>
    {error ? <div className="inline-error"><span>{error}</span><button onClick={onRetry}>Retry data health</button></div> : <div className="health-grid">{health?.sources.map((source) => <article key={source.name}><div className={`status-dot ${source.coverage}`}></div><div><h3>{source.name}</h3><p>{source.capability}</p>{source.latestObservation && <p>Latest completed market observation: {source.latestObservation}</p>}{source.warning && <p className="source-warning">{source.warning}</p>}{source.error && <p className="source-error">Latest attempt: {source.error}</p>}</div><div className="health-state"><strong>{source.freshness}</strong><span>{source.coverage} coverage</span>{source.recordsSeen !== undefined && <span>{source.recordsWritten ?? 0}/{source.recordsSeen} rows stored</span>}</div></article>)}</div>}
  </section>;
}

function MacroDashboard({ macro, error, onRetry }: { macro: MacroResponse | null; error: string | null; onRetry: () => void }) {
  return <main className="workspace macro-workspace">
    <div className="macro-banner"><span className="eyebrow">Informational only</span><h1>Macro & sector context</h1><p>This dashboard is deliberately isolated from stock qualification and ranking. Nothing shown here can include or exclude a company.</p></div>
    {error ? <div className="inline-error"><span>{error}</span><button onClick={onRetry}>Retry macro data</button></div> : <div className="macro-grid">{macro?.cards.map((card) => <article key={card.label}><span>{card.label}</span><strong>{card.value}</strong><p>{card.note}</p></article>)}</div>}
    <div className="empty-state"><div className="empty-mark">◌</div><h2>Waiting for documented free sources</h2><p>Aggregate valuation history will appear here only when it can be obtained legally, consistently, and with clear methodology.</p></div>
  </main>;
}

function NyseUniverse({ universe, error, busy, search, onSearchChange, onSearch, onRetry, onPage, demo = false }: {
  universe: NyseUniverseResponse | null;
  error: string | null;
  busy: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onRetry: () => void;
  onPage: (offset: number) => void;
  demo?: boolean;
}) {
  const first = universe ? universe.offset + 1 : 0;
  const last = universe ? Math.min(universe.offset + universe.items.length, universe.counts.filtered) : 0;
  return <main className="workspace universe-workspace">
    <section className="universe-hero">
      <div><span className="eyebrow">{demo ? "Portfolio sample directory" : "Live listing directory"}</span><h1>NYSE universe</h1><p>{demo ? "Explore a small fabricated directory that demonstrates search, classification, and review states without publishing the private market-data cache." : "Start with the exchange roster, then verify security type, trading history, liquidity, size, and fundamentals before screening."}</p></div>
      <div className={`live-source-badge ${universe?.mode ?? "unavailable"}`}><span></span>{demo ? "Static sample" : universe?.mode === "live" ? "Live directory snapshot" : "No live snapshot"}{universe?.mode === "live" && <small>{demo ? "illustrative" : universe.freshness}</small>}</div>
    </section>
    <div className="universe-warning" role="note"><strong>Classification is intentionally conservative.</strong><span>This is not yet the final investable universe and no valuation conclusion is being made.</span></div>
    <section className="universe-panel">
      <div className="universe-toolbar">
        <form onSubmit={onSearch}><label htmlFor="nyse-search">Find a company or ticker</label><div><input id="nyse-search" type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="e.g. IBM or International Business Machines" /><button type="submit" disabled={busy}>Search</button></div></form>
        {universe && <div className="universe-counts"><span><strong>{universe.counts.total.toLocaleString()}</strong>Total listings</span><span><strong>{universe.counts.candidates.toLocaleString()}</strong>Needs verification</span><span><strong>{universe.counts.excluded.toLocaleString()}</strong>Rule exclusions</span></div>}
      </div>
      {error ? <div className="inline-error"><span>{error}</span><button onClick={onRetry}>Retry NYSE data</button></div> : busy && !universe ? <div className="loading-state"><span className="inline-spinner"></span>Loading the local NYSE snapshot…</div> : universe?.items.length ? <>
        <div className="snapshot-meta"><span>Source: {universe.source}</span><span>Retrieved: {universe.retrievedAt ? new Date(universe.retrievedAt).toLocaleString() : "Unavailable"}</span><span>Showing {first.toLocaleString()}–{last.toLocaleString()} of {universe.counts.filtered.toLocaleString()} matches</span>{busy && <span className="table-loading"><span className="inline-spinner"></span>Updating…</span>}</div>
        <div className="universe-table-wrap"><table><thead><tr><th scope="col">Ticker</th><th scope="col">Company / security</th><th scope="col">Classification</th><th scope="col">Review state</th></tr></thead><tbody>{universe.items.map((item) => <tr key={item.ticker}><td><strong>{item.ticker}</strong></td><td><span>{item.name}</span><small>{item.warning}</small></td><td>{item.securityType.replaceAll("_", " ")}</td><td><span className={`classification-state ${item.classificationState}`}>{item.classificationState === "excluded" ? "Excluded by rule" : "Verify"}</span></td></tr>)}</tbody></table></div>
        <div className="universe-pagination"><button type="button" aria-label="Previous NYSE page" disabled={busy || universe.offset === 0} onClick={() => onPage(Math.max(0, universe.offset - universe.limit))}>Previous</button><span>{first.toLocaleString()}–{last.toLocaleString()} of {universe.counts.filtered.toLocaleString()}</span><button type="button" aria-label="Next NYSE page" disabled={busy || last >= universe.counts.filtered} onClick={() => onPage(universe.offset + universe.limit)}>Next</button></div>
      </> : <div className="empty-state"><div className="empty-mark">0</div><h2>{universe?.mode === "unavailable" ? "Live NYSE snapshot not loaded" : "No matching listings"}</h2><p>{universe?.mode === "unavailable" ? "Run the documented NYSE refresh command to populate this view." : "Try a different ticker or company name."}</p></div>}
      {universe && <ul className="limitation-list">{universe.limitations.map((item) => <li key={item}>{item}</li>)}</ul>}
    </section>
  </main>;
}

function SystemStatus({ busy, error, completedAt, recentlyUpdated, unavailable = false, mode, activity = "screen", demo = false }: { busy: boolean; error: string | null; completedAt: string | null; recentlyUpdated: boolean; unavailable?: boolean; mode: string; activity?: "screen" | "restore" | "NYSE" | "research"; demo?: boolean }) {
  const state = demo ? "ready" : error ? "error" : busy ? "working" : recentlyUpdated ? "updated" : "ready";
  const title = demo ? "Portfolio demo" : error ? `${activity} needs attention` : busy ? (activity === "NYSE" ? "Loading NYSE listings" : activity === "research" ? "Retrieving SEC filings" : activity === "restore" ? "Loading saved screen" : "Running screen") : unavailable ? "Waiting for valuation data" : recentlyUpdated ? (activity === "NYSE" ? "NYSE listings loaded" : "Results updated") : "Application running";
  const detail = demo
    ? "Interactive illustrative dataset · no backend calls"
    : error
    ? "Review the error below"
    : busy
      ? (activity === "NYSE" ? "Reading the local exchange snapshot…" : activity === "research" ? "Selected-company retrieval and local analysis are in process…" : activity === "restore" ? "Reading the most recent local result…" : "Applying filters and valuation rules…")
      : unavailable
        ? "NYSE listings are live; screening inputs are not connected"
      : completedAt
        ? activity === "NYSE"
          ? `Snapshot retrieved ${new Date(completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : activity === "research"
            ? `Latest report stored ${new Date(completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : `${recentlyUpdated ? "Last run" : "Ready · Last screen ran"} ${new Date(completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "Ready";
  return <div className={`system-status ${state}`} role="status" aria-live="polite">
    <span className="system-indicator" aria-hidden="true"></span>
    <span className="system-copy"><strong>{title}</strong><small>{detail}</small></span>
    <span className="system-mode">{demo ? "Static build" : mode}</span>
  </div>;
}

export default function App() {
  const [view, setView] = useState<"screen" | "research" | "universe" | "macro">("screen");
  const [resultTab, setResultTab] = useState<"normal" | "turnaround">("normal");
  const [settings, setSettings] = useState(defaultSettings);
  const [results, setResults] = useState<ScreenResponse | null>(null);
  const [health, setHealth] = useState<DataHealthResponse | null>(null);
  const [macro, setMacro] = useState<MacroResponse | null>(null);
  const [universe, setUniverse] = useState<NyseUniverseResponse | null>(null);
  const [universeSearch, setUniverseSearch] = useState("");
  const [universeBusy, setUniverseBusy] = useState(true);
  const [universeRecentlyUpdated, setUniverseRecentlyUpdated] = useState(false);
  const [busy, setBusy] = useState(true);
  const [screenActivity, setScreenActivity] = useState<"restore" | "screen">("restore");
  const [screenSource, setScreenSource] = useState<"saved" | "fresh" | null>(null);
  const [savedScreenExpiresAt, setSavedScreenExpiresAt] = useState<string | null>(null);
  const [savedScreenExpired, setSavedScreenExpired] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [macroError, setMacroError] = useState<string | null>(null);
  const [universeError, setUniverseError] = useState<string | null>(null);
  const [researchStartingKeys, setResearchStartingKeys] = useState<string[]>([]);
  const [researchJobs, setResearchJobs] = useState<ResearchJob[]>([]);
  const [researchReports, setResearchReports] = useState<ResearchReport[]>([]);
  const [researchReportCount, setResearchReportCount] = useState(0);
  const [hasMoreResearchReports, setHasMoreResearchReports] = useState(false);
  const [researchLibraryBusy, setResearchLibraryBusy] = useState(true);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<LocalModelStatus | null>(null);
  const updateNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const universeUpdateNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const researchLibraryRequestId = useRef(0);
  const researchReportsRef = useRef<ResearchReport[]>([]);

  const runScreen = async (next: ScreenSettings) => {
    setScreenActivity("screen");
    setBusy(true); setRecentlyUpdated(false); setScreenError(null);
    try {
      const response = await api.screen(next);
      setResults(response);
      setScreenSource("fresh");
      setSavedScreenExpiresAt(null);
      setSavedScreenExpired(false);
      setRecentlyUpdated(response.mode === "live");
      if (updateNoticeTimer.current) clearTimeout(updateNoticeTimer.current);
      updateNoticeTimer.current = setTimeout(() => setRecentlyUpdated(false), 2500);
    } catch (reason) { setScreenError(reason instanceof Error ? reason.message : "Screen failed."); }
    finally { setBusy(false); }
  };

  const loadInitialScreen = async (signal?: AbortSignal) => {
    setScreenActivity("restore"); setBusy(true); setRecentlyUpdated(false); setScreenError(null);
    try {
      const latest = await api.latestScreen(signal);
      if (latest.available && latest.result && latest.settings) {
        setResults(latest.result);
        setSettings(latest.settings);
        setScreenSource("saved");
        setSavedScreenExpiresAt(latest.expiresAt ?? null);
        setSavedScreenExpired(false);
        setBusy(false);
        return;
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") {
        setBusy(false);
        return;
      }
    }
    await runScreen(defaultSettings);
  };

  const loadHealth = async (signal?: AbortSignal) => {
    setHealthError(null);
    try { setHealth(await api.dataHealth(signal)); } catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setHealthError("Data health could not be loaded."); }
  };

  const loadMacro = async (signal?: AbortSignal) => {
    setMacroError(null);
    try { setMacro(await api.macro(signal)); } catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setMacroError("Macro context could not be loaded."); }
  };

  const loadUniverse = async (search = universeSearch, offset = 0, signal?: AbortSignal) => {
    setUniverseBusy(true); setUniverseRecentlyUpdated(false); setUniverseError(null);
    try {
      setUniverse(await api.nyseUniverse(search, offset, signal));
      setUniverseRecentlyUpdated(true);
      if (universeUpdateNoticeTimer.current) clearTimeout(universeUpdateNoticeTimer.current);
      universeUpdateNoticeTimer.current = setTimeout(() => setUniverseRecentlyUpdated(false), 2500);
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setUniverseError("The NYSE listing snapshot could not be loaded."); }
    finally { setUniverseBusy(false); }
  };

  const loadResearchLibrary = async (options: { signal?: AbortSignal; offset?: number } = {}) => {
    const requestId = ++researchLibraryRequestId.current;
    const offset = options.offset ?? 0;
    setResearchLibraryBusy(true); setResearchError(null);
    try {
      const library = await api.researchLibrary(offset, options.signal);
      if (requestId !== researchLibraryRequestId.current) return;
      setResearchJobs(library.jobs);
      const combined = offset === 0
        ? [...library.reports, ...researchReportsRef.current]
        : [...researchReportsRef.current, ...library.reports];
      const uniqueReports = Array.from(new Map(combined.map((report) => [report.id, report])).values());
      researchReportsRef.current = uniqueReports;
      setResearchReports(uniqueReports);
      setResearchReportCount(library.counts.completed);
      setHasMoreResearchReports(uniqueReports.length < library.counts.completed);
    } catch (reason) {
      if (requestId === researchLibraryRequestId.current && !(reason instanceof DOMException && reason.name === "AbortError")) setResearchError("The saved deep-research library could not be loaded.");
    } finally {
      if (requestId === researchLibraryRequestId.current) setResearchLibraryBusy(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadHealth(controller.signal);
    loadMacro(controller.signal);
    loadUniverse("", 0, controller.signal);
    loadInitialScreen(controller.signal);
    api.localModel(controller.signal).then(setModelStatus).catch(() => null);
    loadResearchLibrary({ signal: controller.signal });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!researchJobs.some((job) => job.status === "queued" || job.status === "running")) return;
    const timer = setInterval(() => { loadResearchLibrary(); }, 2000);
    return () => clearInterval(timer);
  }, [researchJobs]);

  useEffect(() => {
    if (screenSource !== "saved" || !savedScreenExpiresAt) return;
    const expire = () => {
      setResults(null);
      setScreenSource(null);
      setSavedScreenExpiresAt(null);
      setSavedScreenExpired(true);
    };
    const delay = new Date(savedScreenExpiresAt).getTime() - Date.now();
    if (delay <= 0) {
      expire();
      return;
    }
    const timer = setTimeout(expire, delay);
    return () => clearTimeout(timer);
  }, [screenSource, savedScreenExpiresAt]);

  useEffect(() => () => {
    if (updateNoticeTimer.current) clearTimeout(updateNoticeTimer.current);
    if (universeUpdateNoticeTimer.current) clearTimeout(universeUpdateNoticeTimer.current);
  }, []);

  const visibleCandidates = useMemo(() => results?.[resultTab] ?? [], [results, resultTab]);
  const priceSource = health?.sources.find((source) => source.name === "Yahoo Finance via yfinance");
  const pricingNeedsRefresh = priceSource !== undefined && isPriceRefreshStale(priceSource.lastSuccess);
  const startDeepResearch = async (candidate: Pick<Candidate, "exchange" | "ticker">, screenRunId = results?.screenRunId) => {
    if (!screenRunId) return;
    const key = `${candidate.exchange}:${candidate.ticker}`;
    if (researchStartingKeys.includes(key) || researchJobs.some((job) => `${job.exchange}:${job.ticker}` === key && (job.status === "queued" || job.status === "running"))) return;
    setResearchStartingKeys((current) => [...current, key]); setResearchError(null);
    try {
      const response = await api.startResearch(screenRunId, [candidate]);
      researchLibraryRequestId.current += 1;
      setResearchJobs((current) => Array.from(new Map([...response.jobs, ...current].map((job) => [job.id, job])).values()));
      const completed = response.jobs.flatMap((job) => job.report ? [job.report] : []);
      if (completed.length) {
        const combined = [...completed, ...researchReportsRef.current.filter((report) => !completed.some((item) => item.id === report.id))];
        researchReportsRef.current = combined;
        setResearchReports(combined);
      }
      void loadResearchLibrary();
    } catch (reason) { setResearchError(reason instanceof Error ? reason.message : "Deep research could not start."); }
    finally { setResearchStartingKeys((current) => current.filter((item) => item !== key)); }
  };

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="Stock Research home"><span className="brand-mark">SR</span><span><strong>Stock Research</strong><small>{portfolioMode ? "Public portfolio edition" : "Valuation intelligence"}</small></span></a><nav aria-label="Primary navigation"><button aria-pressed={view === "screen"} className={view === "screen" ? "active" : ""} onClick={() => setView("screen")}>Screener</button><button aria-pressed={view === "research"} className={view === "research" ? "active" : ""} onClick={() => { setView("research"); loadResearchLibrary(); }}>Deep Research{researchJobs.some((job) => job.status === "queued" || job.status === "running") && <span className="nav-activity-dot" aria-label="Research in progress"></span>}</button><button aria-pressed={view === "universe"} className={view === "universe" ? "active" : ""} onClick={() => setView("universe")}>NYSE universe</button><button aria-pressed={view === "macro"} className={view === "macro" ? "active" : ""} onClick={() => setView("macro")}>Macro & sectors</button></nav><SystemStatus busy={view === "research" ? researchJobs.some((job) => job.status === "queued" || job.status === "running") : view === "universe" ? universeBusy : busy} error={view === "research" ? researchError : view === "universe" ? universeError : screenError} completedAt={view === "research" ? researchReports[0]?.generatedAt ?? null : view === "universe" ? universe?.retrievedAt ?? null : results?.generatedAt ?? null} recentlyUpdated={view === "universe" ? universeRecentlyUpdated : recentlyUpdated} unavailable={view === "screen" && results?.mode === "unavailable"} mode={view === "research" ? "Local AI" : view === "universe" && universe?.mode === "live" ? "NYSE live" : results?.mode === "live" ? "Live valuation" : "Valuation pending"} activity={view === "research" ? "research" : view === "universe" ? "NYSE" : busy ? screenActivity : "screen"} demo={portfolioMode} /></header>
    {portfolioMode && <aside className="portfolio-banner" role="note"><div><strong>Public portfolio demonstration</strong><span>Interactive controls use a small fabricated dataset. No live prices, private database, SEC downloads, or AI requests are included.</span></div><span className="portfolio-badge">Read-only · illustrative</span></aside>}
    {view === "macro" ? <MacroDashboard macro={macro} error={macroError} onRetry={() => loadMacro()} /> : view === "universe" ? <NyseUniverse universe={universe} error={universeError} busy={universeBusy} search={universeSearch} onSearchChange={setUniverseSearch} onSearch={(event) => { event.preventDefault(); loadUniverse(universeSearch, 0); }} onRetry={() => loadUniverse(universeSearch, universe?.offset ?? 0)} onPage={(offset) => loadUniverse(universeSearch, offset)} demo={portfolioMode} /> : view === "research" ? <DeepResearchWorkspace jobs={researchJobs} reports={researchReports} reportCount={researchReportCount} hasMoreReports={hasMoreResearchReports} modelStatus={modelStatus} busy={researchLibraryBusy} error={researchError} startingKeys={researchStartingKeys} onRetry={() => loadResearchLibrary()} onRetryJob={(job) => startDeepResearch({ exchange: job.exchange, ticker: job.ticker }, job.screenRunId)} onLoadMore={() => loadResearchLibrary({ offset: researchReports.length })} demo={portfolioMode} /> : <main className="workspace" id="top">
      <section className="hero"><div><span className="eyebrow">Point-in-time research workspace</span><h1>Find valuation compression.<br /><em>Keep the context.</em></h1><p>Find companies trading at lower valuation multiples than their own recent history, while keeping recent-loss cases separate and visible.</p></div><div className="hero-note"><span>Methodology</span><strong>Deterministic by design</strong><p>No AI is used for valuation, filtering, flags, or ranking.</p></div></section>
      <ScreenGuide />
      {pricingNeedsRefresh && <div className="price-stale-alert" role="alert"><div><strong>Pricing update needed</strong><span>{priceSource?.lastSuccess ? `Prices were last refreshed ${new Date(priceSource.lastSuccess).toLocaleString()}.` : "No successful price refresh is recorded."} Refresh pricing before running a new screen so current companies are not rejected as stale.</span></div><small>Alert threshold: more than 24 hours since the last successful refresh.</small></div>}
      <div className="data-warning" role="status"><strong>{portfolioMode ? "Illustrative demo data" : "Partial live coverage"}</strong><span>{portfolioMode ? "Four fabricated companies demonstrate filtering, normal-versus-turnaround routing, valuation flags, and report review without exposing local runtime data." : health?.coverage ? `${health.coverage.joined.toLocaleString()} of ${health.coverage.eligible.toLocaleString()} currently eligible NYSE companies have joined SEC fundamentals and price history; ${health.coverage.materialized.toLocaleString()} have a current fast-screen cache. Resumable ingestion is expanding coverage in measured batches.` : "Results use only companies with joined SEC fundamentals and price history. Coverage expands through resumable, measured NYSE batches."}</span></div>
      {screenSource === "saved" && results?.mode === "live" && <section className="saved-screen-banner" aria-label="Most recent saved screen"><div><span className="eyebrow">Most recent saved screen</span><strong>Showing your last results—no new exchange-wide screen was run.</strong><small>Saved screens expire automatically after 72 hours{savedScreenExpiresAt ? ` · available until ${new Date(savedScreenExpiresAt).toLocaleString()}` : ""}.</small></div><button type="button" disabled={busy} onClick={() => runScreen(settings)}>Run fresh screen</button></section>}
      {savedScreenExpired && <section className="saved-screen-banner expired" aria-label="Saved screen expired"><div><span className="eyebrow">Saved screen expired</span><strong>The prior results were removed after 72 hours so outdated candidates are not shown.</strong><small>Run a fresh screen to rebuild the research queue from current local data.</small></div><button type="button" disabled={busy} onClick={() => runScreen(settings)}>Run fresh screen</button></section>}
      <SettingsPanel settings={settings} onChange={setSettings} busy={busy} onSubmit={(event) => { event.preventDefault(); runScreen(settings); }} onReset={() => { setSettings(defaultSettings); runScreen(defaultSettings); }} />
      {screenError && <div className="error-banner" role="alert"><span>{screenError}</span><button onClick={() => runScreen(settings)}>Retry screen</button></div>}
      <section className="results-section" aria-live="polite">
        <div className="results-top"><div><span className="eyebrow">Quantitative survivors</span><h2>Research queue</h2></div>{results && <div className="run-stats"><span><strong>{results.counts.afterUniverseFilters}</strong> in universe</span><span><strong>{results.counts.normal}</strong> normal</span><span><strong>{results.counts.turnaround}</strong> turnaround</span></div>}</div>
        <div className="result-tabs" role="tablist" aria-label="Candidate category" onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") setResultTab(resultTab === "normal" ? "turnaround" : "normal"); }}><button id="normal-tab" role="tab" aria-controls="candidate-panel" aria-selected={resultTab === "normal"} onClick={() => setResultTab("normal")}>Normal valuation compression <span>{results?.counts.normal ?? "—"}</span></button><button id="turnaround-tab" role="tab" aria-controls="candidate-panel" aria-selected={resultTab === "turnaround"} onClick={() => setResultTab("turnaround")}>Recently negative / turnaround <span>{results?.counts.turnaround ?? "—"}</span></button></div>
        {results?.mode === "live" && <div className="research-tray"><div><strong>{portfolioMode ? "Sample deep research included" : "One click starts deep research"}</strong><span>{portfolioMode ? "Open the report library to inspect example quantitative context, qualitative analysis, risks, and a final rating." : "Use “Start deep research” on any company. It begins immediately; additional companies automatically join the queue in selection order."}</span><small>{modelStatus?.message ?? "Checking the local, zero-API-cost AI…"}</small></div><button type="button" onClick={() => { setView("research"); loadResearchLibrary(); }}>Open Deep Research{researchJobs.some((job) => job.status === "queued") ? ` · ${researchJobs.filter((job) => job.status === "queued").length} queued` : ""}</button></div>}
        {researchError && <div className="error-banner" role="alert"><span>{researchError}</span></div>}
        <div id="candidate-panel" role="tabpanel" aria-labelledby={`${resultTab}-tab`}>{busy && !results ? <div className="loading-state">Running deterministic screen…</div> : visibleCandidates.length ? <div className="candidate-list">{visibleCandidates.map((candidate) => { const key = `${candidate.exchange}:${candidate.ticker}`; const activeJob = researchJobs.find((job) => `${job.exchange}:${job.ticker}` === key && (job.status === "queued" || job.status === "running")); const researchState = researchStartingKeys.includes(key) ? "starting" as const : activeJob?.status === "running" ? "running" as const : activeJob?.status === "queued" ? "queued" as const : null; return <CandidateCard key={key} candidate={candidate} turnaround={resultTab === "turnaround"} researchState={researchState} onResearch={() => portfolioMode ? setView("research") : startDeepResearch(candidate)} demo={portfolioMode} />; })}</div> : <div className="empty-state"><div className="empty-mark">0</div><h3>{results?.mode === "unavailable" ? "Valuation history not ready" : "No companies match this view"}</h3><p>{results?.mode === "unavailable" ? results.statusMessage : "Adjust the research lens or select the other result category."}</p></div>}</div>
      </section>
      <DataHealth health={health} error={healthError} onRetry={() => loadHealth()} />
    </main>}
  </div>;
}
