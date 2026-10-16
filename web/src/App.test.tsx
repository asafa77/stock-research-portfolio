import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { isPriceRefreshStale } from "./App";

const screenResponse = {
  screenRunId: null,
  generatedAt: "2026-09-25T00:00:00Z",
  mode: "unavailable",
  statusMessage: "Live NYSE listings and partial source data are available, but screening-ready normalized fundamentals and valuation histories are still required.",
  normal: [],
  turnaround: [],
  counts: { universe: 0, afterUniverseFilters: 0, normal: 0, turnaround: 0 },
};

const universeResponse = {
  mode: "live", freshness: "fresh", lastRefreshStatus: "succeeded", exchange: "NYSE",
  source: "Nasdaq Trader otherlisted.txt", retrievedAt: "2026-09-25T12:00:00Z",
  counts: { total: 2, candidates: 1, excluded: 1, filtered: 2 }, limit: 100, offset: 0,
  items: [{ ticker: "IBM", name: "International Business Machines Corporation Common Stock", securityType: "common_stock_pending", classificationState: "pending", warning: "Common-share candidate; remaining universe filters require verification.", retrievedAt: "2026-09-25T12:00:00Z" }],
  limitations: ["This is a current listing directory, not the final investable universe."],
};
const emptyResearchLibrary = { jobs: [], reports: [], reportOffset: 0, hasMoreReports: false, counts: { active: 0, completed: 0, failed: 0 } };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url === "/api/screen/latest") return Promise.resolve(new Response(JSON.stringify({ available: false, maxAgeHours: 72 }), { status: 200 }));
    if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
    if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "NYSE listings are local; valuation inputs are not connected.", coverage: { eligible: 1885, fundamentals: 1, prices: 1, joined: 1, materialized: 1 }, sources: [] }), { status: 200 }));
    if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
    if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("stock research dashboard", () => {
  it("treats missing price refreshes as stale but not the exact 24-hour boundary", () => {
    const now = new Date("2026-10-02T12:00:00Z").getTime();
    expect(isPriceRefreshStale(null, now)).toBe(true);
    expect(isPriceRefreshStale("2026-10-01T12:00:00Z", now)).toBe(false);
    expect(isPriceRefreshStale("2026-10-01T11:59:59Z", now)).toBe(true);
  });

  it("restores the latest saved screen without rerunning and can explicitly refresh it", async () => {
    const generatedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const savedSettings = {
      discount_pe: 20, discount_pfcf: 20, discount_pb: 20,
      predominantly_positive_ratio: 0.8, combination: "or",
      min_market_cap_millions: 200, min_average_daily_dollar_volume: 2_000_000,
      liquidity_window_days: 20, comparison_window: "6m",
      exchanges: ["NYSE"],
    };
    const savedResult = {
      ...screenResponse, screenRunId: "saved-run", mode: "live",
      generatedAt, statusMessage: "Saved result",
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen/latest") return Promise.resolve(new Response(JSON.stringify({
        available: true, maxAgeHours: 72, expiresAt,
        settings: savedSettings, result: savedResult,
      }), { status: 200 }));
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(savedResult), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "Ready", sources: [] }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ ready: true, informationalOnly: true, cards: [] }), { status: 200 }));
    }));

    render(<App />);
    expect(await screen.findByText("Showing your last results—no new exchange-wide screen was run.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Valuation comparison period$/)).toHaveValue("6m");
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/screen")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Run fresh screen" }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/screen")).toHaveLength(1));
    expect(screen.queryByLabelText("Most recent saved screen")).not.toBeInTheDocument();
  });

  it("removes a restored screen at its exact 72-hour expiry while the page remains open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const expiresAt = new Date(Date.now() + 1_000).toISOString();
    const savedSettings = {
      discount_pe: 20, discount_pfcf: 20, discount_pb: 20,
      predominantly_positive_ratio: 0.8, combination: "or",
      min_market_cap_millions: 200, min_average_daily_dollar_volume: 2_000_000,
      liquidity_window_days: 20, comparison_window: "12m", exchanges: ["NYSE"],
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen/latest") return Promise.resolve(new Response(JSON.stringify({
        available: true, maxAgeHours: 72, expiresAt, settings: savedSettings,
        result: { ...screenResponse, screenRunId: "saved", mode: "live" },
      }), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "Ready", sources: [] }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ ready: true, informationalOnly: true, cards: [] }), { status: 200 }));
    }));

    render(<App />);
    expect(await screen.findByLabelText("Most recent saved screen")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByLabelText("Saved screen expired")).toBeInTheDocument();
    expect(screen.queryByLabelText("Most recent saved screen")).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/screen")).toHaveLength(0);
  });

  it("shows no placeholder companies while valuation inputs are unavailable", async () => {
    render(<App />);
    expect(screen.getByText("What this screener is looking for")).toBeInTheDocument();
    expect(screen.getByText(/your P\/E\/P\/FCF combination must still pass/i)).toBeInTheDocument();
    expect(screen.getByText(/P\/B adds review context but does not qualify a company/i)).toBeInTheDocument();
    expect(await screen.findByText("Valuation history not ready")).toBeInTheDocument();
    expect(screen.getByText("Partial live coverage")).toBeInTheDocument();
    expect(screen.getByText("Waiting for valuation data")).toBeInTheDocument();
    expect(screen.getByText(/1 of 1,885 currently eligible NYSE companies/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("article", { name: /candidate/i })).toHaveLength(0);
    expect(screen.getByRole("tab", { name: /Normal valuation compression 0/ })).toBeInTheDocument();
  });

  it("alerts on launch when the last successful price refresh is older than 24 hours", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen/latest") return Promise.resolve(new Response(JSON.stringify({ available: false, maxAgeHours: 72 }), { status: 200 }));
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({
        mode: "partial_live", summary: "Old prices", sources: [{
          name: "Yahoo Finance via yfinance", capability: "Prices", freshness: "stale",
          coverage: "complete", lastSuccess: "2020-01-01T00:00:00Z",
          latestObservation: new Date().toISOString(),
        }],
      }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, cards: [] }), { status: 200 }));
    }));

    render(<App />);
    expect(await screen.findByRole("alert", { name: "" })).toHaveTextContent("Pricing update needed");
    expect(screen.getByText(/more than 24 hours/i)).toBeInTheDocument();
  });

  it("does not show the stale-price alert when pricing was refreshed recently", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen/latest") return Promise.resolve(new Response(JSON.stringify({ available: false, maxAgeHours: 72 }), { status: 200 }));
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({
        mode: "partial_live", summary: "Current prices", sources: [{
          name: "Yahoo Finance via yfinance", capability: "Prices", freshness: "fresh",
          coverage: "complete", lastSuccess: new Date().toISOString(),
        }],
      }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, cards: [] }), { status: 200 }));
    }));

    render(<App />);
    await screen.findByText("Valuation history not ready");
    expect(screen.queryByText("Pricing update needed")).not.toBeInTheDocument();
  });

  it("keeps macro context explicitly informational", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Macro & sectors" }));
    expect(await screen.findByText("Macro & sector context")).toBeInTheDocument();
    expect(screen.getByText(/deliberately isolated from stock qualification/i)).toBeInTheDocument();
  });

  it("shows persisted deep-research retrieval progress in its own tab", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "Ready", sources: [] }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url === "/api/research/local-model") return Promise.resolve(new Response(JSON.stringify({ ready: true, model: "test", message: "Ready" }), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify({
        jobs: [{ id: "active-1", exchange: "NYSE", ticker: "IBM", status: "running", phase: "Downloading 10-K filed 2026-02-01", error: null, report: null }],
        reports: [], reportOffset: 0, hasMoreReports: false, counts: { active: 1, completed: 0, failed: 0 },
      }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
    }));
    render(<App />);
    const tab = await screen.findByRole("button", { name: /Deep Research/ });
    fireEvent.click(tab);
    expect(await screen.findByText("Retrieval queue")).toBeInTheDocument();
    expect(screen.getByText("Retrieval is in process. SEC documents and the completed report will be stored locally here.")).toBeInTheDocument();
    expect(screen.getByText("Retrieving SEC filings")).toBeInTheDocument();
    expect(screen.getByText("Downloading 10-K filed 2026-02-01")).toBeInTheDocument();
  });

  it("shows completed research as a compact selectable list with one open report", async () => {
    const report = (id: string, ticker: string, summary: string) => ({
      id, exchange: "NYSE", ticker, generatedAt: "2026-10-02T10:00:00Z",
      provider: "local", model: "test",
      analysis: {
        summary: { text: summary, citations: [] }, possible_explanations: [],
        counterpoints: [], unknowns: [],
        final_recommendation: {
          rating: ticker === "IBM" ? "buy" : "hold", confidence: "medium",
          quantitative_assessment: "Valuation context.", filing_assessment: "Filing context.",
          rationale: `${ticker} combined view.`, key_risks: ["Execution"],
          next_step: "Review the next filing.", citations: [],
        },
      },
      evidence: [], limitations: [],
    });
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen/latest") return Promise.resolve(new Response(JSON.stringify({ available: false, maxAgeHours: 72 }), { status: 200 }));
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "Ready", sources: [] }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url === "/api/research/local-model") return Promise.resolve(new Response(JSON.stringify({ ready: true, model: "test", message: "Ready" }), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify({
        jobs: [], reports: [report("report-ibm", "IBM", "IBM report summary."), report("report-msft", "MSFT", "MSFT report summary.")],
        reportOffset: 0, hasMoreReports: false, counts: { active: 0, completed: 2, failed: 0 },
      }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
    }));

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Deep Research/ }));
    const ibmButton = await screen.findByRole("button", { name: /IBM.*BUY.*IBM report summary/i });
    const msftButton = screen.getByRole("button", { name: /MSFT.*HOLD.*MSFT report summary/i });
    expect(ibmButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("IBM research report")).toBeInTheDocument();
    expect(screen.queryByLabelText("MSFT research report")).not.toBeInTheDocument();

    fireEvent.click(msftButton);
    expect(msftButton).toHaveAttribute("aria-pressed", "true");
    expect(ibmButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("MSFT research report")).toBeInTheDocument();
    expect(screen.queryByLabelText("IBM research report")).not.toBeInTheDocument();
  });

  it("ignores a stale empty library response after a newer active response", async () => {
    let resolveInitial: ((response: Response) => void) | undefined;
    let libraryCalls = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "Ready", sources: [] }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url === "/api/research/local-model") return Promise.resolve(new Response(JSON.stringify({ ready: true, model: "test", message: "Ready" }), { status: 200 }));
      if (url.startsWith("/api/research/library")) {
        libraryCalls += 1;
        if (libraryCalls === 1) return new Promise<Response>((resolve) => { resolveInitial = resolve; });
        return Promise.resolve(new Response(JSON.stringify({
          jobs: [{ id: "new-job", exchange: "NYSE", ticker: "NEW", status: "running", phase: "Checking SEC filings", error: null, report: null }],
          reports: [], reportOffset: 0, hasMoreReports: false, counts: { active: 1, completed: 0, failed: 0 },
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
    }));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Deep Research/ }));
    expect(await screen.findByText("Checking SEC filings")).toBeInTheDocument();
    resolveInitial?.(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
    await waitFor(() => expect(screen.getByText("Checking SEC filings")).toBeInTheDocument());
  });

  it("retries a failed research job from the Deep Research tab", async () => {
    let retried = false;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "Ready", sources: [] }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url === "/api/research/local-model") return Promise.resolve(new Response(JSON.stringify({ ready: true, model: "test", message: "Ready" }), { status: 200 }));
      if (url === "/api/research/jobs") {
        retried = true;
        expect(JSON.parse(String(init?.body))).toEqual({ screenRunId: "run-cava", companies: [{ exchange: "NYSE", ticker: "CAVA" }] });
        return Promise.resolve(new Response(JSON.stringify({ jobs: [{ id: "retry-cava", screenRunId: "run-cava", exchange: "NYSE", ticker: "CAVA", status: "queued", phase: "Waiting", error: null, requestedAt: "2026-09-30T13:21:00Z", queuePosition: 1, report: null }] }), { status: 202 }));
      }
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify({
        jobs: retried
          ? [{ id: "retry-cava", screenRunId: "run-cava", exchange: "NYSE", ticker: "CAVA", status: "queued", phase: "Waiting", error: null, requestedAt: "2026-09-30T13:21:00Z", queuePosition: 1, report: null }]
          : [{ id: "failed-cava", screenRunId: "run-cava", exchange: "NYSE", ticker: "CAVA", status: "failed", phase: "Needs attention", error: "Local analysis exceeded 15 minutes. Ollama is installed; retry this company.", requestedAt: "2026-09-30T13:10:00Z", report: null }],
        reports: [], reportOffset: 0, hasMoreReports: false, counts: { active: retried ? 1 : 0, completed: 0, failed: retried ? 0 : 1 },
      }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
    }));

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Deep Research/ }));
    const retry = await screen.findByRole("button", { name: "Retry deep research" });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText("Queue position 1")).toBeInTheDocument());
    expect(screen.queryByText("Local analysis exceeded 15 minutes. Ollama is installed; retry this company.")).not.toBeInTheDocument();
  });

  it("submits settings and reset reapplies the empty live-data state", async () => {
    render(<App />);
    await screen.findByText("Valuation history not ready");
    fireEvent.change(screen.getByLabelText(/^P\/E discount$/), { target: { value: "30" } });
    expect(screen.getByLabelText(/^P\/B review threshold$/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Valuation comparison period$/), { target: { value: "3m" } });
    fireEvent.click(screen.getByRole("button", { name: /Run screen/ }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/screen")).toHaveLength(2));
    let lastCall = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/screen").at(-1)!;
    expect(JSON.parse(String(lastCall[1]?.body)).comparison_window).toBe("3m");

    fireEvent.click(screen.getByRole("button", { name: "Reset and run defaults" }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/screen")).toHaveLength(3));
    lastCall = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/screen").at(-1)!;
    expect(JSON.parse(String(lastCall[1]?.body)).comparison_window).toBe("12m");
  });

  it("explains every research setting except screen combination in plain language", async () => {
    render(<App />);
    await screen.findByText("Valuation history not ready");

    expect(screen.getAllByRole("button", { name: /^Explain / })).toHaveLength(9);
    expect(screen.queryByRole("button", { name: "Explain Screen combination" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explain P/E discount" })).toHaveAttribute("aria-describedby");
    expect(screen.getByText(/How far today’s price-to-earnings ratio must be below its recent average/i)).toBeInTheDocument();
    expect(screen.getByText(/P\/B.*does not qualify a company/i)).toBeInTheDocument();
    expect(screen.getByText(/Current live coverage is NYSE only/i)).toBeInTheDocument();
  });

  it("keeps a health failure visible and retries independently", async () => {
    let healthAttempts = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
      if (url === "/api/data-health") {
        healthAttempts += 1;
        return Promise.resolve(new Response(
          healthAttempts === 1 ? JSON.stringify({ detail: "offline" }) : JSON.stringify({ mode: "partial_live", summary: "Recovered", sources: [] }),
          { status: healthAttempts === 1 ? 503 : 200 },
        ));
      }
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
    }));
    render(<App />);
    expect(await screen.findByText("Data health could not be loaded.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry data health" }));
    expect(await screen.findByText("Recovered")).toBeInTheDocument();
  });

  it("shows partial price-batch coverage from the latest ingestion warning", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify(screenResponse), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({
        mode: "partial_live", summary: "Partial prices", sources: [{
          name: "Yahoo Finance via yfinance", capability: "Historical price and volume",
          freshness: "fresh", coverage: "partial", lastSuccess: "2026-09-25T00:00:00Z",
          latestObservation: "2026-09-24", recordsSeen: 200, recordsWritten: 200,
          warning: "Best-effort Yahoo/yfinance coverage: 1/2 companies succeeded; 1 failed (BAD).",
        }],
      }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
    }));
    render(<App />);
    expect(await screen.findByText(/1\/2 companies succeeded/)).toBeInTheDocument();
    expect(screen.getByText("200/200 rows stored")).toBeInTheDocument();
  });

  it("renders a live repository-backed candidate with metric and lineage evidence", async () => {
    const metric = (name: "pe" | "pfcf" | "pb", current: number, average: number) => ({
      metric: name, route: "normal", discountPct: 25, flags: [], reason: "Usable.",
      currentMultiple: current, historicalAverage: average, comparisonMethod: "arithmetic_mean",
      window: "12m", validObservations: 252, expectedObservations: 262, coveragePct: 96.2,
      thresholdPct: 20, passesThreshold: true, currentDenominator: 10_000_000_000,
      denominatorLabel: "TTM denominator", denominatorUnit: "USD",
      denominatorPeriodEnd: "2026-06-30", denominatorAvailableAt: "2026-07-23T23:59:59Z",
      normalizationMethod: "annual_plus_ytd_less_comparable_ytd_v1",
      filingAccessions: ["0000051143-26-000078"],
      shareCount: 942134390, sharePeriodEnd: "2026-06-30",
      shareAvailableAt: "2026-07-23T23:59:59Z", shareRetrievedAt: "2026-09-25T12:00:00Z",
      shareFilingAccession: "0000051143-26-000078",
      shareNormalizationMethod: "latest_reported_instant_v1",
    });
    const candidate = {
      cik: "0000051143",
      ticker: "IBM", name: "International Business Machines Corporation", exchange: "NYSE",
      sector: "Unavailable from current free sources", industry: "Unavailable from current free sources",
      marketCapMillions: 213921, averageDailyDollarVolume: 1_318_000_000,
      liquidityWindowDays: 20, price: 227.06, revenueGrowthPct: 7.9,
      operatingMarginPct: null, netDebtToEbitda: null, returnOnEquityPct: 31.1,
      interestCoverage: null, shareDilutionPct: 0.8, cashConversionPct: 123,
      metrics: [metric("pe", 19.95, 28.2), metric("pfcf", 15.51, 19.67), metric("pb", 6.21, 8.17)],
      flags: ["REVENUE_GROWTH_VALUATION_COMPRESSION"], bestDiscountPct: 29.27,
      filingAccessions: ["0000051143-26-000078"], source: "SEC Company Facts + Yahoo Finance via yfinance",
      asOf: "2026-09-24", methodologyVersion: "sec_ttm_price_multiple_v1",
      retrievedAt: "2026-09-25T12:00:00Z", availableAt: "2026-07-23T23:59:59Z",
      lineageNote: "Point-in-time SEC facts.",
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify({
        screenRunId: "run-1", generatedAt: "2026-09-26T00:00:00Z", mode: "live", statusMessage: "Evaluated 1",
        normal: [candidate], turnaround: [],
        counts: { universe: 1, afterUniverseFilters: 1, normal: 1, turnaround: 0 },
      }), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "Joined", sources: [] }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url === "/api/research/local-model") return Promise.resolve(new Response(JSON.stringify({ ready: true, model: "test", message: "Local AI is ready." }), { status: 200 }));
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify(emptyResearchLibrary), { status: 200 }));
      if (url === "/api/research/jobs") return Promise.resolve(new Response(JSON.stringify({ jobs: [{
        id: "job-1", exchange: "NYSE", ticker: "IBM", status: "succeeded", phase: "Research ready", error: null,
        report: {
          id: "report-1", exchange: "NYSE", ticker: "IBM", generatedAt: "2026-09-26T00:00:00Z", provider: "local", model: "test",
          analysis: { summary: { text: "Filings identify competitive pressure.", citations: ["accession:0"] }, possible_explanations: [{ title: "Competition", explanation: "The filing discusses stronger competition.", confidence: "medium", citations: ["accession:0"] }], counterpoints: [{ text: "Demand remains.", citations: ["accession:0"] }], unknowns: ["Market expectations"], quantitative_context: { available: true, as_of: "2026-09-24", revenue_growth_pct: 7.9, return_on_equity_pct: 31.1, valuation_metrics: [{ metric: "pe", currentMultiple: 19.95, historicalAverage: 28.23, discountPct: 29.27, thresholdPct: 20, window: "12m" }] }, final_recommendation: { rating: "buy", confidence: "medium", quantitative_assessment: "P/E is below its trailing average while revenue is growing.", filing_assessment: "Competitive pressure is material but demand remains.", rationale: "The discount may compensate for the cited risks.", key_risks: ["Competition"], next_step: "Review the next quarterly filing.", citations: ["accession:0"] } },
          evidence: [{ chunk_id: "accession:0", accession: "accession", form: "10-K", filed_at: "2026-02-01", source_url: "https://www.sec.gov/Archives/example.htm", text: "Competition increased." }],
          limitations: ["Qualitative only."],
        },
      }] }), { status: 202 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
    }));
    render(<App />);
    expect(await screen.findByText("International Business Machines Corporation")).toBeInTheDocument();
    expect(screen.getByText("Revenue growth + compression")).toBeInTheDocument();
    expect(screen.getByText("Live valuation")).toBeInTheDocument();
    expect(screen.getByText("19.95×")).toBeInTheDocument();
    expect(screen.getAllByText("Qualifies").length).toBeGreaterThan(0);
    expect(screen.getByText("Meets threshold")).toBeInTheDocument();
    expect(screen.getAllByText(/0000051143-26-000078/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Start deep research" }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/research/jobs")).toBe(true));
    const researchCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/research/jobs")!;
    expect(JSON.parse(String(researchCall[1]?.body))).toEqual({
      screenRunId: "run-1", companies: [{ exchange: "NYSE", ticker: "IBM" }],
    });
    fireEvent.click(screen.getByRole("button", { name: /Open Deep Research/ }));
    expect(await screen.findByLabelText("IBM research report")).toBeInTheDocument();
    expect(screen.getAllByText("Filings identify competitive pressure.")).toHaveLength(2);
    expect(screen.getByText("Final recommendation")).toBeInTheDocument();
    expect(screen.getAllByText("BUY")).toHaveLength(2);
    expect(screen.getByText("Valuation & fundamentals")).toBeInTheDocument();
    expect(screen.getByText("SEC filing evidence")).toBeInTheDocument();
    expect(screen.getByText(/Valuation and market data as of/)).toHaveTextContent("2026-09-24");
    expect(screen.getByLabelText("Quantitative snapshot")).toHaveTextContent("29.3% below 12m average");
    expect(screen.getByText("Review the next quarterly filing.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "10-K · 2026-02-01" })[0]).toHaveAttribute("href", "https://www.sec.gov/Archives/example.htm");
  });

  it("starts research on selection and queues later companies in order", async () => {
    const baseCandidate = {
      cik: "0000051143", ticker: "IBM", name: "International Business Machines Corporation", exchange: "NYSE",
      sector: "Technology", industry: "Services", marketCapMillions: 213921, averageDailyDollarVolume: 1_318_000_000,
      liquidityWindowDays: 20, price: 227.06, revenueGrowthPct: 7.9, operatingMarginPct: null,
      netDebtToEbitda: null, returnOnEquityPct: 31.1, interestCoverage: null, shareDilutionPct: 0.8,
      cashConversionPct: 123, metrics: [], flags: [], bestDiscountPct: 29.27, filingAccessions: [],
      source: "SEC + Yahoo", asOf: "2026-09-24", methodologyVersion: "test", retrievedAt: "2026-09-25T12:00:00Z",
      availableAt: "2026-07-23T23:59:59Z", lineageNote: "Point-in-time test data.",
    };
    const first = baseCandidate;
    const second = { ...baseCandidate, cik: "0000789019", ticker: "MSFT", name: "Microsoft Corporation" };
    const submitted: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/screen") return Promise.resolve(new Response(JSON.stringify({
        screenRunId: "run-queue", generatedAt: "2026-09-26T00:00:00Z", mode: "live", statusMessage: "Evaluated 2",
        normal: [first, second], turnaround: [], counts: { universe: 2, afterUniverseFilters: 2, normal: 2, turnaround: 0 },
      }), { status: 200 }));
      if (url === "/api/data-health") return Promise.resolve(new Response(JSON.stringify({ mode: "partial_live", summary: "Ready", sources: [] }), { status: 200 }));
      if (url.startsWith("/api/universe/nyse")) return Promise.resolve(new Response(JSON.stringify(universeResponse), { status: 200 }));
      if (url === "/api/research/local-model") return Promise.resolve(new Response(JSON.stringify({ ready: true, model: "test", message: "Ready" }), { status: 200 }));
      if (url === "/api/research/jobs") {
        const body = JSON.parse(String(init?.body));
        const ticker = body.companies[0].ticker;
        const job = { id: `job-${ticker}`, exchange: "NYSE", ticker, status: submitted.length ? "queued" : "running", phase: submitted.length ? "Waiting for earlier research" : "Checking SEC filings", error: null, queuePosition: submitted.length ? 1 : null, requestedAt: `2026-09-26T00:00:0${submitted.length}Z`, report: null };
        submitted.push(job);
        return Promise.resolve(new Response(JSON.stringify({ jobs: [job] }), { status: 202 }));
      }
      if (url.startsWith("/api/research/library")) return Promise.resolve(new Response(JSON.stringify({ jobs: submitted, reports: [], reportOffset: 0, hasMoreReports: false, counts: { active: submitted.length, completed: 0, failed: 0 } }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ mode: "unavailable", informationalOnly: true, asOf: null, cards: [] }), { status: 200 }));
    }));

    render(<App />);
    expect(await screen.findByText("Microsoft Corporation")).toBeInTheDocument();
    let actions = screen.getAllByRole("button", { name: "Start deep research" });
    fireEvent.click(actions[0]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Deep research in progress" })).toBeDisabled());
    actions = screen.getAllByRole("button", { name: "Start deep research" });
    fireEvent.click(actions[0]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Queued for deep research" })).toBeDisabled());
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/research/jobs")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Open Deep Research/ }));
    expect(await screen.findByText("1 active · 1 queued")).toBeInTheDocument();
    expect(screen.getByText("Queue position 1")).toBeInTheDocument();
    expect(screen.getByText(/will start automatically/i)).toBeInTheDocument();
  });

  it("keeps the live NYSE listing browser available", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "NYSE universe" }));
    expect(await screen.findByText("International Business Machines Corporation Common Stock")).toBeInTheDocument();
    expect(screen.getByText("Live directory snapshot")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next NYSE page" }));
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("offset=100"))).toBe(true));
  });
});
