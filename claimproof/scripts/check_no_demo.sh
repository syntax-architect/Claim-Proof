#!/usr/bin/env bash
set -e

if [ ! -d "dist" ]; then
  npm run build
fi

echo "Checking dist/ for activateDemoPlan references..."
if grep -rn "activateDemoPlan" dist/; then
  echo "FAILED: Found activateDemoPlan in dist/"
  exit 1
fi

if grep -rn "Try without paying (demo license)" dist/; then
  echo "FAILED: Found demo license button in dist/"
  exit 1
fi

echo "PASSED: Production build is clean."
