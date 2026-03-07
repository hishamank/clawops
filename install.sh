#!/usr/bin/env bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ClawOps — Production Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
  echo -e "${BLUE}▶${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running from project root
if [ ! -f "package.json" ] || [ ! -f "pnpm-workspace.yaml" ]; then
  print_error "Must run from ClawOps project root directory"
  exit 1
fi
PROJECT_ROOT="$(pwd -P)"

# ── Step 1: Check prerequisites ─────────────────────────────────────────────

print_step "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  print_error "Node.js is required. Install from: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  print_error "Node.js >= 18 required (found $(node -v))"
  exit 1
fi
print_success "Node.js $(node --version) found"

if ! command -v pnpm &> /dev/null; then
  print_error "pnpm is required. Install with: npm install -g pnpm"
  exit 1
fi
print_success "pnpm $(pnpm --version) found"
echo ""

# ── Step 2: Install dependencies ────────────────────────────────────────────

print_step "Installing dependencies..."
pnpm install --frozen-lockfile
print_success "Dependencies installed"
echo ""

# ── Step 3: Build all packages ──────────────────────────────────────────────

print_step "Building all packages..."
pnpm build
print_success "All packages built"
echo ""

# ── Step 4: Port selection ──────────────────────────────────────────────────

DEFAULT_WEB_PORT=3333

# Check if port is available using the built port-check utility
check_port() {
  local port=$1
  node -e "
import { checkPort } from './apps/cli/dist/lib/port-check.js';
checkPort($port).then(r => process.exit(r.available ? 0 : 1)).catch(() => process.exit(1));
  " --input-type=module 2>/dev/null
}

get_listening_pid() {
  local port=$1
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1
}

get_process_cwd() {
  local pid=$1
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  local cwd_line
  cwd_line=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | tail -n 1 || true)
  printf '%s\n' "${cwd_line#n}"
}

is_clawops_web_process() {
  local pid=$1
  local cmd
  local cwd

  cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
  cwd=$(get_process_cwd "$pid")

  if [ -n "$cwd" ] && [[ "$cwd" == "$PROJECT_ROOT"* ]] && [[ "$cmd" == *"next"* ]]; then
    return 0
  fi
  if [[ "$cmd" == *"@clawops/web"* ]] || [[ "$cmd" == *"clawops"* && "$cmd" == *"next"* ]]; then
    return 0
  fi

  return 1
}

stop_process_for_port_if_clawops() {
  local port=$1
  local pid

  pid=$(get_listening_pid "$port")
  if [ -z "$pid" ]; then
    return 1
  fi

  if ! is_clawops_web_process "$pid"; then
    return 1
  fi

  print_warning "Port $port is used by existing ClawOps web process (PID $pid). Stopping it..."
  kill "$pid" 2>/dev/null || true
  sleep 1

  if ! check_port "$port"; then
    print_warning "Process $pid did not stop in time. Sending SIGKILL..."
    kill -9 "$pid" 2>/dev/null || true
    sleep 1
  fi

  if check_port "$port"; then
    print_success "Freed port $port by stopping existing ClawOps process"
    return 0
  fi

  print_warning "Could not free port $port automatically"
  return 1
}

WEB_PORT=$DEFAULT_WEB_PORT

if ! check_port $WEB_PORT; then
  if ! stop_process_for_port_if_clawops "$WEB_PORT"; then
    print_warning "Port $WEB_PORT (web) is in use"
    read -p "Enter alternative web port (default: 3334): " alt_web
    WEB_PORT=${alt_web:-3334}
    if ! check_port $WEB_PORT; then
      print_error "Port $WEB_PORT is also in use. Free up a port and try again."
      exit 1
    fi
  fi
fi
print_success "Web port: $WEB_PORT"
echo ""

# ── Step 5: Write .env ──────────────────────────────────────────────────────

if [ ! -f ".env" ]; then
  print_step "Creating .env..."

  cat > .env <<EOF
# SQLite database path
CLAWOPS_DB_PATH=./clawops.db

# Web dashboard port
WEB_PORT=$WEB_PORT
EOF

  print_success "Created .env"
else
  print_warning ".env already exists, skipping"
fi

# Load env vars for migrations
set -a
# shellcheck source=/dev/null
. ".env"
set +a
echo ""

# ── Step 6: Run database migrations ─────────────────────────────────────────

print_step "Running database migrations..."
pnpm --filter @clawops/core db:migrate
print_success "Database migrations complete"
echo ""

# ── Step 7: Install CLI globally ────────────────────────────────────────────

print_step "Installing ClawOps CLI globally..."
cd apps/cli && pnpm link --global && cd ../..
print_success "CLI linked globally"
echo ""

# ── Step 8: Verify installation ─────────────────────────────────────────────

print_step "Verifying installation..."
if command -v clawops &> /dev/null; then
  CLAWOPS_VERSION=$(clawops --version 2>/dev/null || echo "unknown")
  print_success "clawops $CLAWOPS_VERSION available"
else
  print_warning "clawops command not found in PATH"
  print_warning "You may need to restart your shell or add pnpm global bin to PATH"
fi
echo ""

# ── Done ────────────────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "ClawOps installed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Next: run 'clawops onboard' to connect to OpenClaw"
echo ""
