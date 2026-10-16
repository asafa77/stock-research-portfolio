import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import App from "./App";

const portfolioIt = import.meta.env.VITE_PORTFOLIO_MODE === "true" ? it : it.skip;

portfolioIt("renders the interactive portfolio edition without making a network request", async () => {
  const fetchSpy = vi.fn(() => Promise.reject(new Error("Portfolio mode must not use fetch.")));
  vi.stubGlobal("fetch", fetchSpy);
  try {
    render(<App />);

    expect(screen.getByText("Public portfolio demonstration")).toBeInTheDocument();
    expect(await screen.findByText("DEMO-A")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "View sample research" })[0]);
    expect(await screen.findByText("Completed reports")).toBeInTheDocument();
    expect(screen.getByText("Static samples")).toBeInTheDocument();
    expect(screen.getByText(/No filings are retrieved and no AI is called/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    cleanup();
    vi.unstubAllGlobals();
  }
});
