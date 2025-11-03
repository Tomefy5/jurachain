#!/usr/bin/env python3
import sys
import httpx

def main():
    try:
        response = httpx.get("http://localhost:8000/health", timeout=3.0)
        if response.status_code == 200:
            sys.exit(0)
        else:
            sys.exit(1)
    except Exception:
        sys.exit(1)

if __name__ == "__main__":
    main()