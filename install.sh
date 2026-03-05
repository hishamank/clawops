#!/usr/bin/env bash
set -e

echo "Installing ClawOps CLI..."
echo ""

# Check if npm is available
if ! command -v npm &> /dev/null; then
  echo "npm is required. Install Node.js first: https://nodejs.org"
  exit 1
fi

# Use a secure temp file
ERRFILE=$(mktemp)
trap 'rm -f "$ERRFILE"' EXIT

# Install globally — handle permission errors gracefully
if ! npm install -g @clawops/cli 2>"$ERRFILE"; then
  if grep -qE "EACCES|permission denied" "$ERRFILE" 2>/dev/null; then
    echo ""
    echo "Permission denied. Try one of:"
    echo "  sudo npm install -g @clawops/cli"
    echo "  OR fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors"
    echo "  OR use a Node version manager (nvm, fnm) which installs without sudo"
  fi
  cat "$ERRFILE" >&2
  exit 1
fi

echo ""
echo "ClawOps CLI installed!"
echo ""
echo "Get started:"
echo "  clawops --help"
echo "  clawops connect    # Connect your OpenClaw setup"
echo "  clawops task list  # List tasks"
