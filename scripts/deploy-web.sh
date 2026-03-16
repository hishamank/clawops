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

# Function to kill process on a port
kill_process_on_port() {
  local port=$1
  local pid
  
  # Try to find PID using ss or netstat
  if command -v ss &> /dev/null; then
    pid=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1)
  elif command -v netstat &> /dev/null; then
    pid=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | head -1)
  fi
  
  if [ -n "$pid" ]; then
    echo "  Found process $pid on port $port"
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
      sleep 1
    fi
    echo "✓ Process $pid stopped"
    return 0
  fi
  return 1
}

if command -v pm2 &> /dev/null; then
  pm2 stop clawops-web 2>/dev/null || true
  pm2 delete clawops-web 2>/dev/null || true
  echo "✓ PM2 process stopped"
fi

# Also kill any process still holding the port (fallback)
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
  for i in {1..10}; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$WEB_PORT | grep -q "200"; then
      echo "✓ Server is responding"
      break
    fi
    sleep 1
  done
  
  pm2 status
else
  echo "▶ PM2 not found. Starting standalone server..."
  echo "⚠ Consider installing PM2: npm install -g pm2"
  cd apps/web/.next/standalone
  WEB_PORT=$WEB_PORT node server.js &
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
