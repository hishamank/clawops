#!/usr/bin/env bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ClawOps — Web App Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Load env
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

WEB_PORT=${WEB_PORT:-3333}

# Step 1: Stop existing process
echo ""
echo "▶ Stopping existing web process..."

# Function to get process command line
get_process_command() {
  local pid=$1
  ps -p "$pid" -o command= 2>/dev/null || echo ""
}

# Function to get process working directory
get_process_cwd() {
  local pid=$1
  if command -v lsof &> /dev/null; then
    local cwd_line
    cwd_line=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | tail -n 1 || true)
    printf '%s\n' "${cwd_line#n}"
  fi
}

# Function to check if a process looks like ClawOps web
is_clawops_web_process() {
  local pid=$1
  local cmd
  local cwd

  cmd=$(get_process_command "$pid")
  cwd=$(get_process_cwd "$pid")

  # Check if command contains next or clawops
  if [[ "$cmd" == *"next"* ]] || [[ "$cmd" == *"clawops"* ]]; then
    # Also verify working directory is within project root
    if [ -n "$cwd" ] && [[ "$cwd" == "$PROJECT_ROOT"* ]]; then
      return 0
    fi
    # Or if command explicitly mentions clawops
    if [[ "$cmd" == *"clawops"* ]]; then
      return 0
    fi
  fi

  return 1
}

# Function to kill process on a port (only if it's a ClawOps process)
kill_process_on_port() {
  local port=$1
  local pid

  # Try to find PID using ss or netstat (portable parsing without grep -P)
  if command -v ss &> /dev/null; then
    pid=$(ss -tlnp 2>/dev/null | grep ":$port " | awk -F'pid=' '{print $2}' | awk '{print $1}' | head -1)
  elif command -v netstat &> /dev/null; then
    pid=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | head -1)
  elif command -v lsof &> /dev/null; then
    pid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1)
  fi

  if [ -n "$pid" ]; then
    # Only kill if it looks like a ClawOps process
    if is_clawops_web_process "$pid"; then
      echo "  Found ClawOps process $pid on port $port"
      kill "$pid" 2>/dev/null || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
      fi
      echo "✓ Process $pid stopped"
      return 0
    else
      echo "  Process $pid on port $port does not appear to be ClawOps, skipping"
      return 1
    fi
  fi
  return 1
}

if command -v pm2 &> /dev/null; then
  pm2 stop clawops-web 2>/dev/null || true
  pm2 delete clawops-web 2>/dev/null || true
  echo "✓ PM2 process stopped"
fi

# Also kill any ClawOps process still holding the port (fallback)
kill_process_on_port "$WEB_PORT" || true

# Step 2: Clean build artifacts
echo ""
echo "▶ Cleaning build artifacts..."
rm -rf apps/web/.next apps/web/out
echo "✓ Cleaned"

# Step 3: Build
echo ""
echo "▶ Building @clawops/web..."
pnpm build --filter @clawops/web
echo "✓ Build complete"

# Step 4: Start with PM2 or standalone
echo ""
if command -v pm2 &> /dev/null; then
  echo "▶ Starting with PM2..."
  pm2 start apps/web/ecosystem.config.js
  pm2 save
  echo "✓ PM2 started"

  # Wait for server to be ready
  echo "  Waiting for server to be ready..."
  if command -v curl &> /dev/null; then
    for i in {1..10}; do
      # Use -L to follow redirects, check for 2xx or 3xx status codes
      http_code=$(curl -s -o /dev/null -w "%{http_code}" -L http://localhost:$WEB_PORT/api/health 2>/dev/null || echo "000")
      if [[ "$http_code" =~ ^[23][0-9][0-9]$ ]]; then
        echo "✓ Server is responding (HTTP $http_code)"
        break
      fi
      sleep 1
    done
  else
    echo "  ⚠ curl not found, skipping health check"
  fi

  pm2 status
else
  echo "▶ PM2 not found. Starting standalone server..."
  echo "⚠ Consider installing PM2: npm install -g pm2"
  cd apps/web/.next/standalone
  # Next.js standalone server uses PORT env var, not WEB_PORT
  PORT=$WEB_PORT node server.js &
  echo $! > "$PROJECT_ROOT/.clawops-web.pid"
  echo "✓ Server started (PID: $(cat $PROJECT_ROOT/.clawops-web.pid))"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Deployment complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Web dashboard: http://localhost:$WEB_PORT"
echo ""
