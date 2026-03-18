#!/usr/bin/env bash
set -euo pipefail

# ── UI / Theme ───────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SPINNER_FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

print_header() {
  clear 2>/dev/null || true
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  ClawOps — Production Setup${NC}"
  echo -e "${DIM}  Clean install, quiet build, readable progress${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

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

print_info() {
  echo -e "${CYAN}•${NC} $1"
}

append_to_install_log() {
  local title="$1"
  local logfile="$2"

  {
    echo ""
    echo "================================================================"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $title"
    echo "================================================================"
    cat "$logfile"
    echo ""
  } >> "$INSTALL_LOG"
}

run_quiet_step() {
  local label="$1"
  shift

  local logfile
  logfile="$(mktemp -t clawops-install.XXXXXX.log)"

  printf "${BLUE}▶${NC} %s\n" "$label"

  (
    "$@"
  ) >"$logfile" 2>&1 &
  local pid=$!

  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    local frame="${SPINNER_FRAMES[$((i % ${#SPINNER_FRAMES[@]}))]}"
    printf "\r\033[2K${CYAN}%s${NC} %s ${DIM}(working...)${NC}" "$frame" "$label"
    sleep 0.1
    i=$((i + 1))
  done

  wait "$pid"
  local status=$?

  printf "\r\033[2K"
  append_to_install_log "$label" "$logfile"

  if [ $status -eq 0 ]; then
    print_success "$label"
    rm -f "$logfile"
    return 0
  fi

  print_error "$label failed"
  echo ""
  echo -e "${YELLOW}Captured output:${NC}"
  echo -e "${DIM}──────────────────────────────────────────────────────────────────${NC}"
  cat "$logfile"
  echo -e "${DIM}──────────────────────────────────────────────────────────────────${NC}"
  echo -e "${DIM}Full log also written to: $INSTALL_LOG${NC}"
  rm -f "$logfile"
  return $status
}

run_capture_step() {
  local __resultvar="$1"
  shift
  local label="$1"
  shift

  local logfile
  logfile="$(mktemp -t clawops-install.XXXXXX.log)"

  printf "${BLUE}▶${NC} %s\n" "$label"

  (
    "$@"
  ) >"$logfile" 2>&1 &
  local pid=$!

  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    local frame="${SPINNER_FRAMES[$((i % ${#SPINNER_FRAMES[@]}))]}"
    printf "\r\033[2K${CYAN}%s${NC} %s ${DIM}(working...)${NC}" "$frame" "$label"
    sleep 0.1
    i=$((i + 1))
  done

  wait "$pid"
  local status=$?

  printf "\r\033[2K"
  append_to_install_log "$label" "$logfile"

  local output
  output="$(cat "$logfile")"
  rm -f "$logfile"

  printf -v "$__resultvar" '%s' "$output"

  if [ $status -eq 0 ]; then
    print_success "$label"
    return 0
  fi

  print_error "$label failed"
  return $status
}

print_summary() {
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  Installation Summary${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  printf "  %-18s %s\n" "Project root" "$PROJECT_ROOT"
  printf "  %-18s %s\n" "Node.js" "$NODE_VERSION_FULL"
  printf "  %-18s %s\n" "pnpm" "$PNPM_VERSION"
  printf "  %-18s %s\n" "clawops" "$CLAWOPS_VERSION"
  printf "  %-18s %s\n" "Web port" "$WEB_PORT"
  printf "  %-18s %s\n" ".env" "$ENV_STATUS"
  printf "  %-18s %s\n" "Install log" "$INSTALL_LOG"
  echo ""
}

# ── Start ────────────────────────────────────────────────────────────────────

# Check if running from project root
if [ ! -f "package.json" ] || [ ! -f "pnpm-workspace.yaml" ]; then
  echo "✗ Must run from ClawOps project root directory"
  exit 1
fi
PROJECT_ROOT="$(pwd -P)"
INSTALL_LOG="${PROJECT_ROOT}/install.log"

# Start fresh log per install run
: > "$INSTALL_LOG"

print_header
print_info "Install log: $INSTALL_LOG"
echo ""

# ── Step 1: Check prerequisites ─────────────────────────────────────────────

print_step "Checking prerequisites..."

if ! command -v node >/dev/null 2>&1; then
  print_error "Node.js is required. Install from: https://nodejs.org"
  exit 1
fi

NODE_VERSION_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
NODE_VERSION_FULL="$(node --version)"

if [ "$NODE_VERSION_MAJOR" -lt 18 ]; then
  print_error "Node.js >= 18 required (found $NODE_VERSION_FULL)"
  exit 1
fi
print_success "Node.js $NODE_VERSION_FULL found"

if ! command -v pnpm >/dev/null 2>&1; then
  print_error "pnpm is required. Install with: npm install -g pnpm"
  exit 1
fi

PNPM_VERSION="$(pnpm --version)"
print_success "pnpm $PNPM_VERSION found"
echo ""

# ── Step 2: Install dependencies ────────────────────────────────────────────

run_quiet_step "Installing dependencies" pnpm install --frozen-lockfile
echo ""

# ── Step 2.5: Rebuild native modules ────────────────────────────────────────

run_quiet_step "Rebuilding native modules" pnpm rebuild better-sqlite3
echo ""

# ── Step 3: Build all packages ──────────────────────────────────────────────

run_quiet_step "Building all packages" pnpm build
echo ""

# ── Step 4: Port selection ──────────────────────────────────────────────────

DEFAULT_WEB_PORT=3333

check_port() {
  local port=$1
  node -e "
import { checkPort } from './apps/cli/dist/lib/port-check.js';
checkPort($port).then(r => process.exit(r.available ? 0 : 1)).catch(() => process.exit(1));
  " --input-type=module 2>/dev/null
}

stop_tracked_web_process() {
  node -e "
import { stopTrackedWebProcess } from './apps/cli/dist/lib/web-process.js';
const result = stopTrackedWebProcess('$PROJECT_ROOT');
if (result.stopped || result.staleRemoved) {
  process.exit(0);
}
process.exit(1);
  " --input-type=module 2>/dev/null
}

get_listening_pid() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -n 1
    return
  fi
}

get_process_cwd() {
  local pid=$1
  if command -v lsof >/dev/null 2>&1; then
    local cwd_line
    cwd_line=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | tail -n 1 || true)
    printf '%s\n' "${cwd_line#n}"
    return
  fi
  if [ -d "/proc/$pid" ]; then
    readlink -f "/proc/$pid/cwd" 2>/dev/null || true
  fi
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

if ! check_port "$WEB_PORT"; then
  if stop_tracked_web_process && check_port "$WEB_PORT"; then
    print_success "Freed port $WEB_PORT using tracked PID file"
  elif ! stop_process_for_port_if_clawops "$WEB_PORT"; then
    print_warning "Port $WEB_PORT (web) is in use"
    read -r -p "Enter alternative web port (default: 3334): " alt_web
    WEB_PORT=${alt_web:-3334}
    if ! check_port "$WEB_PORT"; then
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
CLAWOPS_DB_PATH=${PROJECT_ROOT}/clawops.db

# Web dashboard port
WEB_PORT=$WEB_PORT
EOF

  ENV_STATUS="created"
  print_success "Created .env"
else
  print_step "Updating .env with selected port..."

  # Update WEB_PORT in existing .env file
  if grep -q "^WEB_PORT=" .env; then
    sed -i.bak "s/^WEB_PORT=.*/WEB_PORT=$WEB_PORT/" .env && rm -f .env.bak
  else
    echo "WEB_PORT=$WEB_PORT" >> .env
  fi

  ENV_STATUS="updated"
  print_success "Updated .env with port $WEB_PORT"
fi

set -a
# shellcheck source=/dev/null
. ".env"
set +a
echo ""

# ── Step 6: Run database migrations ─────────────────────────────────────────

run_migrations() {
  pnpm --filter @clawops/core db:migrate
}

MIGRATION_OUTPUT=""
if run_capture_step MIGRATION_OUTPUT "Running database migrations" run_migrations; then
  :
else
  if echo "$MIGRATION_OUTPUT" | grep -q "already exists"; then
    DB_PATH="${CLAWOPS_DB_PATH:-${PROJECT_ROOT}/clawops.db}"
    if [ -f "$DB_PATH" ]; then
      BACKUP_PATH="${DB_PATH}.bak.$(date +%s)"
      print_warning "Database from a prior install detected (migration failed: table already exists)"
      print_warning "Backing up existing database to ${BACKUP_PATH}"
      mv "$DB_PATH" "$BACKUP_PATH"
      print_step "Retrying migrations with fresh database..."
      if run_quiet_step "Retrying database migrations" run_migrations; then
        print_success "Database migrations complete (old DB backed up)"
      else
        print_error "Database migrations failed even after reset. Restoring backup."
        mv "$BACKUP_PATH" "$DB_PATH"
        exit 1
      fi
    else
      print_error "Database migrations failed:"
      echo "$MIGRATION_OUTPUT"
      exit 1
    fi
  else
    print_error "Database migrations failed:"
    echo "$MIGRATION_OUTPUT"
    exit 1
  fi
fi
echo ""

# ── Step 7: Install CLI globally ────────────────────────────────────────────

run_quiet_step "Installing ClawOps CLI globally" bash -lc 'cd apps/cli && pnpm link --global'
echo ""

# ── Step 8: Verify installation ─────────────────────────────────────────────

print_step "Verifying installation..."
if command -v clawops >/dev/null 2>&1; then
  CLAWOPS_VERSION="$(clawops --version 2>/dev/null || echo "unknown")"
  print_success "clawops $CLAWOPS_VERSION available"
else
  CLAWOPS_VERSION="not found in PATH"
  print_warning "clawops command not found in PATH"
  print_warning "You may need to restart your shell or add pnpm global bin to PATH"
fi
echo ""

# ── Done ────────────────────────────────────────────────────────────────────

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
print_success "ClawOps installed"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

print_summary

echo -e "  ${BOLD}Next:${NC} run 'clawops onboard' to connect to OpenClaw"
echo ""