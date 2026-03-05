#!/usr/bin/env bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ClawOps Local Development Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Step 1: Check dependencies
print_step "Checking dependencies..."

if ! command -v node &> /dev/null; then
  print_error "Node.js is required. Install from: https://nodejs.org"
  exit 1
fi
print_success "Node.js $(node --version) found"

if ! command -v pnpm &> /dev/null; then
  print_error "pnpm is required. Install with: npm install -g pnpm"
  exit 1
fi
print_success "pnpm $(pnpm --version) found"

echo ""

# Step 2: Install dependencies
print_step "Installing dependencies..."
pnpm install
print_success "Dependencies installed"
echo ""

# Step 3: Setup environment variables
print_step "Setting up environment variables..."

if [ ! -f ".env" ]; then
  cp .env.example .env
  print_success "Created .env from .env.example"
  
  # Generate a random API key
  API_KEY=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
  
  # Update .env with generated API key
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/your-api-key-here/$API_KEY/" .env
  else
    sed -i "s/your-api-key-here/$API_KEY/" .env
  fi
  
  print_success "Generated API key: $API_KEY"
  
  # Ask for optional environment variables
  echo ""
  read -p "Do you want to configure OpenClaw gateway settings? (y/N): " configure_gateway
  if [[ "$configure_gateway" =~ ^[Yy]$ ]]; then
    read -p "Enter OpenClaw directory path (default: ~/.openclaw): " openclaw_dir
    read -p "Enter gateway URL (optional): " gateway_url
    read -p "Enter gateway token (optional): " gateway_token
    
    if [ -n "$openclaw_dir" ]; then
      echo "OPENCLAW_DIR=$openclaw_dir" >> .env
    fi
    if [ -n "$gateway_url" ]; then
      echo "OPENCLAW_GATEWAY_URL=$gateway_url" >> .env
    fi
    if [ -n "$gateway_token" ]; then
      echo "OPENCLAW_GATEWAY_TOKEN=$gateway_token" >> .env
    fi
    print_success "Gateway settings configured"
  fi
else
  print_warning ".env already exists, skipping"
fi

echo ""

# Step 4: Build all packages
print_step "Building all packages..."
pnpm build
print_success "All packages built"
echo ""

# Step 5: Run database migrations
print_step "Running database migrations..."
pnpm --filter @clawops/core db:migrate
print_success "Database migrations complete"
echo ""

# Step 6: Link CLI globally
print_step "Installing ClawOps CLI globally..."
cd apps/cli
pnpm link --global
cd ../..
print_success "CLI linked globally"
echo ""

# Step 7: Verify installation
print_step "Verifying installation..."
if command -v clawops &> /dev/null; then
  print_success "clawops command available"
else
  print_error "clawops command not found in PATH"
  print_warning "You may need to restart your shell or add pnpm global bin to PATH"
fi
echo ""

# Step 8: Ask to start dev servers
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "Installation complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start development servers:"
echo "     ${GREEN}pnpm dev${NC}"
echo ""
echo "  2. Access the dashboard:"
echo "     ${GREEN}http://localhost:3000${NC}"
echo ""
echo "  3. Use the CLI:"
echo "     ${GREEN}clawops --help${NC}"
echo "     ${GREEN}clawops connect${NC}    # Connect to OpenClaw"
echo "     ${GREEN}clawops task list${NC}  # List tasks"
echo ""
echo "  4. API endpoint:"
echo "     ${GREEN}http://localhost:3001${NC}"
echo ""

read -p "Start development servers now? (Y/n): " start_dev
if [[ ! "$start_dev" =~ ^[Nn]$ ]]; then
  echo ""
  print_step "Starting development servers..."
  echo ""
  echo "Press Ctrl+C to stop all servers"
  echo ""
  pnpm dev
else
  echo ""
  print_success "Run 'pnpm dev' when ready to start development servers"
fi
