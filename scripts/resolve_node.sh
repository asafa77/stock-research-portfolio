#!/bin/bash
set -euo pipefail

if [[ -n "${NODE_BIN:-}" && -x "$NODE_BIN" ]]; then
  printf '%s\n' "$NODE_BIN"
  exit 0
fi

if command -v node >/dev/null 2>&1; then
  command -v node
  exit 0
fi

# Codex desktop exposes pnpm through a small wrapper beside its bundled Node runtime.
# Resolve that relationship without embedding a user- or machine-specific absolute path.
if command -v pnpm >/dev/null 2>&1; then
  pnpm_path="$(command -v pnpm)"
  bundled_node="$(cd "$(dirname "$pnpm_path")/../.." && pwd)/node/bin/node"
  if [[ -x "$bundled_node" ]]; then
    printf '%s\n' "$bundled_node"
    exit 0
  fi
fi

echo "Node.js 22 or newer is required." >&2
exit 1
