# WorldView

Real-time geospatial intelligence dashboard — a tactical operations interface rendering 6 live data layers on a CesiumJS 3D globe.

## Overview

WorldView is a browser-based application that fuses live global data onto an interactive 3D Earth rendered with CesiumJS and Google Photorealistic 3D Tiles. It tracks 27,000+ aircraft, satellites, ships, earthquakes, street traffic, and CCTV cameras simultaneously, with military-style post-processing visual filters (CRT, Night Vision, FLIR) and a tactical operations UI.

## Tech Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4
- **Globe**: CesiumJS + Resium (React wrapper) + Google 3D Tiles
- **Backend**: Express 5 proxy server (ESM), node-cache TTL caching
- **Orbit Math**: satellite.js for SGP4/SDP4 propagation
- **Geospatial**: @turf/turf for geospatial calculations

## Quick Start

```bash
# Full setup and start (recommended)
./init.sh

# Or manual setup:
npm install
node server/index.js    # Start Express proxy (port 3001)
npx vite dev            # Start Vite dev server (port 5173)
```

Open http://localhost:5173 in your browser.

## Data Layers

| Layer | Source | Refresh |
|-------|--------|---------|
| ✈️ Flights | adsb.fi + FlightRadar24 | 5-20s |
| 🛰️ Satellites | CelesTrak TLE + satellite.js | Real-time propagation |
| 🌍 Earthquakes | USGS GeoJSON | 60s |
| 🚗 Traffic | OpenStreetMap Overpass | On demand |
| 🚢 Ships | AISStream.io AIS | 30s |
| 📷 CCTV | TfL + Austin TX + NSW | 5min |

## Environment Variables

### Root `.env` (client-side)
```
VITE_GOOGLE_API_KEY=       # Google 3D Tiles (optional, falls back to OSM)
VITE_CESIUM_ION_TOKEN=     # Cesium Ion (optional)
```

### `server/.env` (server-side only)
```
PORT=3001
OPENSKY_CLIENT_ID=         # OpenSky Network (optional)
OPENSKY_CLIENT_SECRET=     # OpenSky Network (optional)
NSW_TRANSPORT_API_KEY=     # Transport NSW (optional)
AISSTREAM_API_KEY=         # AISStream.io (optional)
```

**Note:** All API keys are optional. Core free APIs (USGS, CelesTrak, adsb.fi, OSM, TfL, Austin TX) require no authentication.

## Architecture

### Express Proxy Backend (port 3001)

All external API calls go through the Express proxy to:
- Keep API keys server-side (never exposed to browser)
- Add in-memory TTL caching (10s - 24hr per route)
- Normalize response formats
- Handle fallbacks when primary APIs fail

### Frontend (port 5173)

React SPA with CesiumJS globe. All state managed in App.tsx via React hooks. No router needed (single-page app). Data hooks poll Express proxy endpoints and render via imperative Cesium primitive collections for 60fps performance with 27K+ entities.

### Post-Processing Shaders

Three military-style visual modes applied via Cesium PostProcessStage:
- **CRT**: Barrel distortion, chromatic aberration, scanlines, vignette
- **NVG**: Green phosphor tint, film grain, tube vignette, bloom
- **FLIR**: Contrast enhancement, Sobel edge detection, white-hot palette

## API Endpoints

| Endpoint | Description | Cache TTL |
|----------|-------------|-----------|
| GET /api/health | Uptime + cache stats | - |
| GET /api/geolocation | IP-based location | - |
| GET /api/earthquakes | USGS seismic data | 60s |
| GET /api/satellites | TLE orbital elements | 2hr |
| GET /api/traffic/roads | OSM road network | 24hr |
| GET /api/cctv | Multi-source cameras | 300s |
| GET /api/cctv/image | CORS image proxy | - |
| GET /api/ships | AIS vessel data | 60s |
| GET /api/flights | Global flight tracking | 30s |
| GET /api/flights/live | Regional live flights | 4s |
| WS /ws | Flight subscriptions | - |

## License

Private project.
