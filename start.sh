#!/bin/bash

set -e

echo "Starting Binance Alert Bot..."
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "Current directory: $(pwd)"

if [ ! -f "src/index.js" ]; then
  echo "ERROR: src/index.js not found in deployment package."
  exit 1
fi

# Health server is already started by src/index.js (src/health.js).
exec node src/index.js