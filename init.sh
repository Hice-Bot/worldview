#!/bin/bash
set -e

echo "========================================="
echo "  🌍 WorldView — Setup & Start"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 1. Install dependencies
echo -e "${CYAN}[1/4]${NC} Installing npm dependencies..."
npm install
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# 2. Create root .env if it doesn't exist
if [ ! -f .env ]; then
  echo -e "${CYAN}[2/4]${NC} Creating .env with placeholder keys..."
  cat > .env << 'EOF'
# Client-side environment variables (loaded by Vite)
# Only VITE_ prefixed variables are exposed to the browser

# Google Maps Platform API key for Photorealistic 3D Tiles
# Falls back to OpenStreetMap if not set
VITE_GOOGLE_API_KEY=

# Cesium Ion access token
VITE_CESIUM_ION_TOKEN=
EOF
  echo -e "${GREEN}✓${NC} Created .env"
else
  echo -e "${YELLOW}[2/4]${NC} .env already exists, skipping"
fi

# 3. Create server/.env if it doesn't exist
if [ ! -f server/.env ]; then
  echo -e "${CYAN}[3/4]${NC} Creating server/.env with placeholder keys..."
  cat > server/.env << 'EOF'
# Server-side environment variables (Express proxy)
# These keys are NEVER exposed to the browser

PORT=3001

# OpenSky Network (optional)
OPENSKY_CLIENT_ID=
OPENSKY_CLIENT_SECRET=

# Transport for NSW CCTV cameras (optional)
NSW_TRANSPORT_API_KEY=

# AISStream.io for ship tracking (optional)
AISSTREAM_API_KEY=
EOF
  echo -e "${GREEN}✓${NC} Created server/.env"
else
  echo -e "${YELLOW}[3/4]${NC} server/.env already exists, skipping"
fi
echo ""

# 4. Start both servers
echo -e "${CYAN}[4/4]${NC} Starting WorldView..."
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "  📡 Express proxy: ${CYAN}http://localhost:3001${NC}"
echo -e "  🖥️  Vite frontend: ${CYAN}http://localhost:5173${NC}"
echo -e "  🔗 WebSocket:     ${CYAN}ws://localhost:3001/ws${NC}"
echo -e ""
echo -e "  API Endpoints:"
echo -e "    /api/health       — Server health + cache stats"
echo -e "    /api/earthquakes  — USGS seismic data"
echo -e "    /api/satellites   — TLE orbital elements"
echo -e "    /api/flights      — Global flight tracking"
echo -e "    /api/flights/live — Regional live flights"
echo -e "    /api/cctv         — CCTV camera feeds"
echo -e "    /api/ships        — AIS vessel data"
echo -e "    /api/traffic/roads— OSM road network"
echo -e ""
echo -e "  ${YELLOW}Note: All API keys are optional.${NC}"
echo -e "  ${YELLOW}Free APIs (USGS, CelesTrak, adsb.fi, OSM, TfL) work without keys.${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

# Start both servers concurrently
npx concurrently \
  --names "SERVER,VITE" \
  --prefix-colors "cyan,magenta" \
  "node server/index.js" \
  "npx vite dev"
