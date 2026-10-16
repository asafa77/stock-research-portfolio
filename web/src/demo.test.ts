import { describe, expect, it } from "vitest";
import { buildDemoScreen, demoApi, demoInitialSettings } from "./demo";

describe("public portfolio data boundary", () => {
  it("runs an interactive deterministic screen over illustrative companies", () => {
    const result = buildDemoScreen(demoInitialSettings);

    expect(result.mode).toBe("live");
    expect(result.normal.map((item) => item.ticker)).toEqual(["DEMO-A", "DEMO-B"]);
    expect(result.turnaround.map((item) => item.ticker)).toEqual(["DEMO-C"]);
    expect([...result.normal, ...result.turnaround].every((item) => item.source.includes("Illustrative"))).toBe(true);
  });

  it("honors the selected metric, discount, exchange, size, and liquidity controls", () => {
    expect(buildDemoScreen({ ...demoInitialSettings, combination: "pe_only" }).normal.map((item) => item.ticker)).toEqual(["DEMO-A"]);
    expect(buildDemoScreen({ ...demoInitialSettings, discount_pfcf: 30 }).normal.map((item) => item.ticker)).toEqual(["DEMO-A", "DEMO-B"]);
    expect(buildDemoScreen({ ...demoInitialSettings, exchanges: ["NASDAQ"] }).counts.afterUniverseFilters).toBe(0);
    expect(buildDemoScreen({ ...demoInitialSettings, min_market_cap_millions: 3_000 }).normal.map((item) => item.ticker)).toEqual(["DEMO-B"]);
    expect(buildDemoScreen({ ...demoInitialSettings, min_average_daily_dollar_volume: 20_000_000 }).counts.afterUniverseFilters).toBe(0);
  });

  it("recalculates valuation history, observation counts, and liquidity for the selected windows", () => {
    const threeMonth = buildDemoScreen({ ...demoInitialSettings, comparison_window: "3m", liquidity_window_days: 5 });
    const twelveMonth = buildDemoScreen({ ...demoInitialSettings, comparison_window: "12m", liquidity_window_days: 120 });
    const threeMonthCandidate = threeMonth.normal.find((item) => item.ticker === "DEMO-A");
    const twelveMonthCandidate = twelveMonth.normal.find((item) => item.ticker === "DEMO-A");
    const threeMonthPe = threeMonthCandidate?.metrics.find((item) => item.metric === "pe");
    const twelveMonthPe = twelveMonthCandidate?.metrics.find((item) => item.metric === "pe");

    expect(threeMonthPe?.historicalAverage).toBe(17.2);
    expect(threeMonthPe?.validObservations).toBe(63);
    expect(twelveMonthPe?.historicalAverage).toBe(19.8);
    expect(twelveMonthPe?.validObservations).toBe(252);
    expect(threeMonthCandidate?.averageDailyDollarVolume).not.toBe(twelveMonthCandidate?.averageDailyDollarVolume);
    expect(threeMonthCandidate?.liquidityWindowDays).toBe(5);
  });

  it("applies the positive-history requirement to normal valuation comparisons", () => {
    const strict = buildDemoScreen({ ...demoInitialSettings, predominantly_positive_ratio: 0.95 });

    expect(strict.normal.map((item) => item.ticker)).toEqual(["DEMO-A"]);
    expect(strict.turnaround).toEqual([]);
  });

  it("never starts a research job and serves only packaged reports", async () => {
    const library = await demoApi.researchLibrary();

    expect(library.jobs).toEqual([]);
    expect(library.reports).toHaveLength(2);
    expect(library.reports.every((report) => report.provider === "portfolio_demo")).toBe(true);
    await expect(demoApi.startResearch("demo", [{ exchange: "NYSE", ticker: "DEMO-A" }])).rejects.toThrow("read-only");
  });
});
