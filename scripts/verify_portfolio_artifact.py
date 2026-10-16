"""Reject portfolio bundles that expose private runtime configuration or API paths."""

from __future__ import annotations

from pathlib import Path
import re
import sys


FORBIDDEN = (
    b"/api/",
    b"127.0.0.1:8000",
    b"research.sqlite3",
    b"SEC_USER_AGENT",
)

EMAIL_PATTERN = re.compile(rb"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)


def main() -> int:
    output = Path(sys.argv[1]).resolve()
    index = output / "index.html"
    if not index.is_file():
        print(f"Portfolio verification failed: {index} is missing.")
        return 1

    files = [path for path in output.rglob("*") if path.is_file()]
    for path in files:
        payload = path.read_bytes()
        for marker in FORBIDDEN:
            if marker in payload:
                print(f"Portfolio verification failed: {path} contains forbidden marker {marker!r}.")
                return 1
        if EMAIL_PATTERN.search(payload):
            print(f"Portfolio verification failed: {path} contains an email address.")
            return 1

    if not any(path.suffix == ".js" for path in files):
        print("Portfolio verification failed: no JavaScript bundle was produced.")
        return 1

    print(f"Portfolio artifact verified: {len(files)} static files; no private runtime markers found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
