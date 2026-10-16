import type { Candidate, DataHealthResponse, LatestScreenResponse, LocalModelStatus, MacroResponse, NyseUniverseResponse, ResearchJob, ResearchLibrary, ScreenResponse, ScreenSettings } from "./types";
import { portfolioMode } from "./config";
import { demoApi } from "./demo";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : "The local research service could not complete the request.");
  }
  return response.json() as Promise<T>;
}

const liveApi = {
  latestScreen: (signal?: AbortSignal) =>
    fetch("/api/screen/latest", { signal }).then(readJson<LatestScreenResponse>),
  screen: (settings: ScreenSettings, signal?: AbortSignal) =>
    fetch("/api/screen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
      signal,
    }).then(readJson<ScreenResponse>),
  dataHealth: (signal?: AbortSignal) =>
    fetch("/api/data-health", { signal }).then(readJson<DataHealthResponse>),
  macro: (signal?: AbortSignal) =>
    fetch("/api/macro", { signal }).then(readJson<MacroResponse>),
  nyseUniverse: (search = "", offset = 0, signal?: AbortSignal) =>
    fetch(`/api/universe/nyse?search=${encodeURIComponent(search)}&offset=${offset}`, { signal }).then(readJson<NyseUniverseResponse>),
  localModel: (signal?: AbortSignal) =>
    fetch("/api/research/local-model", { signal }).then(readJson<LocalModelStatus>),
  researchLibrary: (reportOffset = 0, signal?: AbortSignal) =>
    fetch(`/api/research/library?report_limit=25&report_offset=${reportOffset}`, { signal }).then(readJson<ResearchLibrary>),
  startResearch: (screenRunId: string, companies: Array<Pick<Candidate, "exchange" | "ticker">>) =>
    fetch("/api/research/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        screenRunId,
        companies: companies.map(({ exchange, ticker }) => ({ exchange, ticker })),
      }),
    }).then(readJson<{ jobs: ResearchJob[] }>),
  researchJob: (jobId: string, signal?: AbortSignal) =>
    fetch(`/api/research/jobs/${encodeURIComponent(jobId)}`, { signal }).then(readJson<ResearchJob>),
};

export const api = portfolioMode ? demoApi : liveApi;
