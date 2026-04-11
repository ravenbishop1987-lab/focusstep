#!/bin/bash

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── colour helpers ──────────────────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ── cleanup on exit ─────────────────────────────────────────────
cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo -e "${GREEN}Done.${NC}"
}
trap cleanup INT TERM EXIT

# ── free port 3003 if already in use ────────────────────────────
EXISTING=$(lsof -ti:3003 2>/dev/null)
if [ -n "$EXISTING" ]; then
  echo -e "${YELLOW}Port 3003 in use (PID $EXISTING) — killing...${NC}"
  kill "$EXISTING" 2>/dev/null
  sleep 1
fi

# ── check node_modules ──────────────────────────────────────────
if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo -e "${CYAN}Installing backend dependencies...${NC}"
  cd "$ROOT/backend" && npm install
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo -e "${CYAN}Installing frontend dependencies...${NC}"
  cd "$ROOT/frontend" && npm install
fi

# ── start backend ───────────────────────────────────────────────
echo -e "${GREEN}Starting backend...${NC}"
cd "$ROOT/backend"
npm run dev &
BACKEND_PID=$!

# give the backend a moment before starting the frontend
sleep 1

# ── start frontend ──────────────────────────────────────────────
echo -e "${GREEN}Starting frontend...${NC}"
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo -e "\n${CYAN}─────────────────────────────────────────${NC}"
echo -e "${CYAN}  Backend  → http://localhost:3003${NC}"
echo -e "${CYAN}  Frontend → http://localhost:5173${NC}"
echo -e "${CYAN}  Press Ctrl+C to stop both${NC}"
echo -e "${CYAN}─────────────────────────────────────────${NC}\n"

# ── wait for both processes ─────────────────────────────────────
wait "$BACKEND_PID" "$FRONTEND_PID"
