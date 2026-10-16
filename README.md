# Stock Research Portfolio Demo

[Open the live interactive demo](https://asafa77.github.io/stock-research-portfolio/)

An interactive, résumé-facing demonstration of a local-first stock valuation and research
application. The public edition shows the product experience and deterministic screening logic
without publishing private market-data caches, SEC documents, credentials, local databases, or
the private Python/Ollama runtime.

## What the demo shows

- Adjustable P/E and P/FCF valuation-compression screening
- Three-, six-, and twelve-month comparison windows
- Market-cap, liquidity, and positive-history requirements
- Separate normal-compression and recently-negative turnaround queues
- P/B below one as a review flag rather than an automatic qualification
- An informational macro dashboard that does not affect screening
- Fabricated sample deep-research reports with quantitative context and buy/hold/sell ratings

Every company, price, metric, and report in the public edition is fabricated and visibly labelled.
The app makes no network, market-data, SEC, AI, or backend calls.

## Development

```bash
cd web
pnpm install
cd ..
./scripts/build_portfolio.sh
```

The verified static output is generated in `web/portfolio-dist/`. GitHub Actions builds and
publishes that artifact to GitHub Pages after each push to `main`.

This project is for software demonstration and research education only. It is not investment
advice and does not place trades.
