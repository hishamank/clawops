#!/usr/bin/env bash
set -e

echo "Installing ClawOps CLI..."
echo ""

# Check if npm is available
if ! command -v npm &> /dev/null; then
  echo "npm is required. Install Node.js first: https://nodejs.org"
  exit 1
fi

# Install globally
npm install -g @clawops/cli

echo ""
echo "ClawOps CLI installed!"
echo ""
echo "Get started:"
echo "  clawops --help"
echo "  clawops connect    # Connect your OpenClaw setup"
echo "  clawops task list  # List tasks"
