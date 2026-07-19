"""
clean_routes_data.py

Stub file — Bengali spelling corrections and route overrides have been removed.
All route text now comes directly from the source Excel sheets.
"""

import json
import sys
import os


def clean_routes(input_path: str, output_path: str, converted_path: str | None = None) -> None:
    """Passthrough — reads routes JSON and writes it unchanged."""
    with open(input_path, "r", encoding="utf-8-sig") as f:
        raw = json.load(f)

    routes = raw if isinstance(raw, list) else list(raw.values()) if isinstance(raw, dict) else []

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"Passthrough written to: {output_path}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Clean routes data (passthrough)")
    parser.add_argument("--input", default=None, help="Input JSON file")
    parser.add_argument("--converted", default=None, help="Ignored (kept for compat)")
    parser.add_argument("--output", default="cleaned_routes.json", help="Output JSON file")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))

    if args.input is None:
        candidates = [
            os.path.join(script_dir, "Metro RTC ActiveRoute__112.json"),
            os.path.join(os.path.dirname(script_dir), "Metro RTC ActiveRoute__112.json"),
        ]
        input_path = next((c for c in candidates if os.path.exists(c)), None)
        if input_path is None:
            print("Error: Could not find input file. Specify with --input")
            sys.exit(1)
    else:
        input_path = args.input

    clean_routes(input_path, args.output)
