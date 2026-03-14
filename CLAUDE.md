# WorldView

Real-time geospatial intelligence dashboard — a tactical operations interface rendering 6 live data layers on a CesiumJS 3D globe.

## Stack
- **Frontend**: React 19, TypeScript 5.9, Vite 7, Resium (CesiumJS React wrapper)
- **Backend**: Express 5 proxy server (ESM), node-cache TTL caching
- **Globe**: CesiumJS with Google Photorealistic 3D Tiles
- **Orbit Math**: satellite.js for SGP4/SDP4 propagation
- **No Database**: All data from external APIs cached in-memory

## Key Commands
```bash
npm install          # Install all dependencies
node server/index.js # Start Express proxy (port 3001)
npx vite dev         # Start Vite dev server (port 5173)
./init.sh            # Full setup and start (both servers)
```

## Environment Variables

### Root .env (client-side)
```
VITE_GOOGLE_API_KEY=       # Google Maps Platform / 3D Tiles
VITE_CESIUM_ION_TOKEN=     # Cesium Ion access token
```

### server/.env (server-side only)
```
PORT=3001
OPENSKY_CLIENT_ID=         # OpenSky Network (optional)
OPENSKY_CLIENT_SECRET=     # OpenSky Network (optional)
NSW_TRANSPORT_API_KEY=     # NSW Transport Open Data
AISSTREAM_API_KEY=         # AISStream.io WebSocket
```

## Architecture

### Express Proxy (port 3001)
All external API calls go through the Express proxy to:
- Keep API keys server-side
- Add node-cache TTL caching (30s-300s per route)
- Normalize response formats
- Handle fallbacks on upstream failures

### Data Layers (6 independent layers)
| Layer | Upstream Source | Cache TTL |
|-------|---------------|-----------|
| Flights | adsb.fi + FlightRadar24 | 10s |
| Satellites | CelesTrak TLE + satellite.js | 300s |
| Earthquakes | USGS GeoJSON | 300s |
| Traffic | OSM Overpass API | 60s |
| Ships | AISStream.io WebSocket burst | 120s |
| CCTV | TfL JamCams + NYC TMC + Caltrans + NCDOT + Austin + NSW | 120s |

### Rendering
- FlightLayer & ShipLayer use imperative BillboardCollection/LabelCollection (NOT Entity components) for 27K+ entity performance
- Dead reckoning interpolation for smooth movement between data refreshes
- 3 post-processing shaders: Standard, CRT scanline, Night vision

### UI Components
- OperationsPanel: Layer toggles + camera presets + shader selector
- StatusBar: Live entity counts + UTC clock + FPS counter
- IntelFeed: Real-time event stream
- TrackedEntityPanel: Detail panel for clicked entities
- CCTVPanel: Camera grid with live feeds
- Crosshair: Center-screen targeting reticle

## Design Principles
- All data from real upstream APIs — no mock/fake/hardcoded data ever
- API keys never exposed to client — always proxied through Express
- Performance-first rendering with imperative Cesium primitives
- Wide dependency graph — layers are independent and build in parallel
