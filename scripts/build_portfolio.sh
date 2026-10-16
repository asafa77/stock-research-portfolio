#!/bin/bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
web_dir="$project_dir/web"
node_bin="$("$project_dir/scripts/resolve_node.sh")"
python_bin="${PYTHON_BIN:-$(command -v python3 || true)}"
if [[ -z "$python_bin" ]]; then echo "Python 3 is required for artifact verification." >&2; exit 1; fi

cd "$project_dir"
"$node_bin" "$web_dir/node_modules/typescript/bin/tsc" -b "$web_dir/tsconfig.json"
VITE_PORTFOLIO_MODE=true "$node_bin" "$web_dir/node_modules/vitest/vitest.mjs" run --config "$web_dir/vite.config.ts" "$web_dir/src/portfolio-mode.test.tsx"
VITE_PORTFOLIO_MODE=true "$node_bin" "$web_dir/node_modules/vite/bin/vite.js" build "$web_dir" --outDir portfolio-dist
"$python_bin" "$project_dir/scripts/verify_portfolio_artifact.py" "$web_dir/portfolio-dist"
