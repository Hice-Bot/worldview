import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

// Load server-side env
dotenv.config({ path: './server/.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Cache instances with per-route TTL
const cache = new NodeCache({ checkperiod: 30 });

// ============================================================================
// Health Endpoint
// ============================================================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats(),
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Geolocation Endpoint
// ============================================================================
app.get('/api/geolocation', async (_req, res) => {
  try {
    const response = await fetch('http://ip-api.com/json/');
    const data = await response.json();
    res.json({
      lat: data.lat,
      lon: data.lon,
      city: data.city,
      country: data.country,
    });
  } catch (error) {
    console.error('[GEO] Error:', error.message);
    res.status(500).json({ error: 'Geolocation failed' });
  }
});

// ============================================================================
// Earthquake Endpoint - USGS GeoJSON
// ============================================================================
app.get('/api/earthquakes', async (_req, res) => {
  try {
    const cached = cache.get('earthquakes');
    if (cached) return res.json(cached);

    const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
    const data = await response.json();
    cache.set('earthquakes', data, 60); // 60s TTL
    res.json(data);
  } catch (error) {
    console.error('[SEIS] Error:', error.message);
    res.status(500).json({ error: 'Earthquake data fetch failed' });
  }
});

// ============================================================================
// Satellites Endpoint - TLE data
// ============================================================================

// Parse CelesTrak 3-line TLE text into SatelliteData objects
function parseCelesTrakTLE(text, category) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const satellites = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const tle1 = lines[i + 1];
    const tle2 = lines[i + 2];
    // Validate TLE format: line 1 starts with "1 ", line 2 starts with "2 "
    if (!tle1.startsWith('1 ') || !tle2.startsWith('2 ')) continue;
    // Extract NORAD ID from line 1 (columns 3-7)
    const noradId = parseInt(tle1.substring(2, 7).trim(), 10) || 0;
    satellites.push({ name: name.trim(), noradId, tle1, tle2, category });
  }
  return satellites;
}

// Parse ivanstanojevic.me API response into SatelliteData objects
function parseIvanTLE(apiResponse, category) {
  const members = apiResponse.member || [];
  return members.map(m => ({
    name: (m.name || '').trim(),
    noradId: m.satelliteId || 0,
    tle1: m.line1 || '',
    tle2: m.line2 || '',
    category,
  })).filter(s => s.tle1 && s.tle2);
}

// Map group names to CelesTrak GROUP parameter values
const CELESTRAK_GROUP_MAP = {
  stations: 'stations',
  active: 'active',
  starlink: 'starlink',
  'gps-ops': 'gps-ops',
  weather: 'weather',
};

// Map group names to ivanstanojevic search terms
const IVAN_SEARCH_MAP = {
  stations: 'ISS',
  active: 'NOAA',
  starlink: 'STARLINK',
  'gps-ops': 'GPS',
  weather: 'GOES',
};

app.get('/api/satellites', async (req, res) => {
  try {
    const groups = req.query.groups || 'stations,active';
    const cacheKey = `satellites_${groups}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const groupList = String(groups).split(',').map(g => g.trim());
    let allSatellites = [];

    // Primary: CelesTrak (more reliable for group-based queries)
    try {
      const results = await Promise.all(
        groupList.map(async (group) => {
          const celestrakGroup = CELESTRAK_GROUP_MAP[group] || group;
          const response = await fetch(
            `https://celestrak.org/NORAD/elements/gp.php?GROUP=${celestrakGroup}&FORMAT=tle`,
            { signal: AbortSignal.timeout(10000) }
          );
          if (!response.ok) throw new Error(`CelesTrak ${response.status}`);
          const text = await response.text();
          return parseCelesTrakTLE(text, group);
        })
      );
      allSatellites = results.flat();
      console.log(`[SAT] CelesTrak: ${allSatellites.length} satellites from groups: ${groups}`);
    } catch (primaryError) {
      console.error('[SAT] CelesTrak failed, trying ivanstanojevic:', primaryError.message);
      // Fallback: tle.ivanstanojevic.me
      try {
        const results = await Promise.all(
          groupList.map(async (group) => {
            const searchTerm = IVAN_SEARCH_MAP[group] || group;
            const response = await fetch(
              `https://tle.ivanstanojevic.me/api/tle/?search=${searchTerm}&page_size=50`,
              { signal: AbortSignal.timeout(10000) }
            );
            if (!response.ok) throw new Error(`TLE API ${response.status}`);
            const data = await response.json();
            return parseIvanTLE(data, group);
          })
        );
        allSatellites = results.flat();
        console.log(`[SAT] ivanstanojevic fallback: ${allSatellites.length} satellites`);
      } catch (fallbackError) {
        console.error('[SAT] Both sources failed:', fallbackError.message);
        return res.status(500).json({ error: 'Satellite data fetch failed' });
      }
    }

    // Deduplicate by NORAD ID (keep first occurrence)
    const seen = new Set();
    const deduplicated = allSatellites.filter(s => {
      if (seen.has(s.noradId)) return false;
      seen.add(s.noradId);
      return true;
    });

    cache.set(cacheKey, deduplicated, 7200); // 2hr TTL
    res.json(deduplicated);
  } catch (error) {
    console.error('[SAT] Error:', error.message);
    res.status(500).json({ error: 'Satellite data fetch failed' });
  }
});

// ============================================================================
// Traffic Roads Endpoint - OSM Overpass API
// ============================================================================
app.get('/api/traffic/roads', async (req, res) => {
  try {
    const { south, west, north, east } = req.query;
    const cacheKey = `traffic_${south}_${west}_${north}_${east}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    if (!south || !west || !north || !east) {
      // Return Sydney CBD fallback data
      const { sydneyRoads } = await import('./data/sydneyRoads.js');
      cache.set(cacheKey, sydneyRoads, 86400);
      return res.json(sydneyRoads);
    }

    const query = `[out:json][timeout:15];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential)$"](${south},${west},${north},${east});out geom;`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json();

      // Haversine distance between two [lon, lat] points in meters
      function haversineDistance(p1, p2) {
        const R = 6371000; // Earth radius in meters
        const toRad = (deg) => deg * Math.PI / 180;
        const dLat = toRad(p2[1] - p1[1]);
        const dLon = toRad(p2[0] - p1[0]);
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(p1[1])) * Math.cos(toRad(p2[1])) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      // Calculate total road segment length via Haversine
      function calcRoadLength(geometry) {
        let total = 0;
        for (let i = 1; i < geometry.length; i++) {
          total += haversineDistance(geometry[i - 1], geometry[i]);
        }
        return total;
      }

      // Parse OSM elements into road segments
      const roads = (data.elements || []).map((el) => {
        const geometry = (el.geometry || []).map((p) => [p.lon, p.lat]);
        return {
          id: String(el.id),
          classification: el.tags?.highway || 'residential',
          geometry,
          length: calcRoadLength(geometry),
          name: el.tags?.name || '',
        };
      });

      cache.set(cacheKey, roads, 86400); // 24hr TTL
      res.json(roads);
    } catch (fetchError) {
      clearTimeout(timeout);
      console.error('[TRAFFIC] Overpass failed, using fallback:', fetchError.message);
      const { sydneyRoads } = await import('./data/sydneyRoads.js');
      cache.set(cacheKey, sydneyRoads, 86400);
      res.json(sydneyRoads);
    }
  } catch (error) {
    console.error('[TRAFFIC] Error:', error.message);
    res.status(500).json({ error: 'Traffic data fetch failed' });
  }
});

// ============================================================================
// CCTV Endpoint - Multi-source (TfL + Austin + NSW)
// ============================================================================
app.get('/api/cctv', async (req, res) => {
  try {
    const country = req.query.country;
    const cacheKey = `cctv_${country || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const sources = await Promise.allSettled([
      // TfL London
      fetch('https://api.tfl.gov.uk/Place/Type/JamCam')
        .then(r => r.json())
        .then(data => (data || []).map(cam => ({
          id: cam.id || cam.commonName,
          name: cam.commonName || 'Unknown',
          lat: cam.lat,
          lon: cam.lon,
          imageUrl: cam.additionalProperties?.find(p => p.key === 'imageUrl')?.value || '',
          available: true,
          region: 'London',
          country: 'GB',
          direction: cam.additionalProperties?.find(p => p.key === 'direction')?.value || '',
        }))),
      // Austin TX — location is GeoJSON Point: {type:"Point", coordinates:[lon, lat]}
      fetch('https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=2000')
        .then(r => r.json())
        .then(data => (data || []).filter(cam => cam.location && cam.location.coordinates).map(cam => ({
          id: cam.camera_id || cam.location_name,
          name: (cam.location_name || 'Unknown').trim(),
          lat: cam.location.coordinates[1],
          lon: cam.location.coordinates[0],
          imageUrl: cam.screenshot_address || cam.camera_mfg_url || '',
          available: cam.camera_status === 'TURNED_ON',
          region: 'Austin, TX',
          country: 'US',
          direction: '',
        }))),
      // NSW Transport (requires API key)
      ...(process.env.NSW_TRANSPORT_API_KEY ? [
        fetch('https://api.transport.nsw.gov.au/v1/live/cameras', {
          headers: { Authorization: `apikey ${process.env.NSW_TRANSPORT_API_KEY}` },
        })
          .then(r => r.json())
          .then(data => (data?.features || []).map(cam => ({
            id: cam.id || 'nsw_cam',
            name: cam.properties?.title || 'Unknown',
            lat: cam.geometry?.coordinates?.[1] || 0,
            lon: cam.geometry?.coordinates?.[0] || 0,
            imageUrl: cam.properties?.href || '',
            available: true,
            region: 'NSW',
            country: 'AU',
            direction: cam.properties?.direction || '',
          })))
      ] : []),
    ]);

    let cameras = [];
    for (const result of sources) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        cameras = cameras.concat(result.value);
      }
    }

    // Apply country filter
    if (country) {
      cameras = cameras.filter(c => c.country === country);
    }

    cache.set(cacheKey, cameras, 300); // 5min TTL
    res.json(cameras);
  } catch (error) {
    console.error('[CCTV] Error:', error.message);
    res.status(500).json({ error: 'CCTV data fetch failed' });
  }
});

// ============================================================================
// CCTV Image Proxy - CORS bypass
// ============================================================================
app.get('/api/cctv/image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    const response = await fetch(String(imageUrl));
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image fetch failed' });
    }

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('[CCTV] Image proxy error:', error.message);
    res.status(500).json({ error: 'Image proxy failed' });
  }
});

// ============================================================================
// Ships Endpoint - AIS vessel data
// Primary: Finnish Digitraffic (free, no auth, ~18K vessels in Baltic/Nordic)
// Fallback: AISStream.io WebSocket burst (if API key configured)
// ============================================================================

// AIS Navigation Status codes
const NAV_STATUS_ANCHORED = 1;
const NAV_STATUS_NOT_UNDER_COMMAND = 2;
const NAV_STATUS_MOORED = 5;
const NAV_STATUS_AGROUND = 6;

app.get('/api/ships', async (_req, res) => {
  try {
    const cached = cache.get('ships');
    if (cached) return res.json(cached);

    let ships = [];

    // Primary: Finnish Digitraffic AIS API (free, no auth, gzip required)
    try {
      // Fetch vessel positions and metadata concurrently
      const [posResponse, metaResponse] = await Promise.all([
        fetch('https://meri.digitraffic.fi/api/ais/v1/locations', {
          headers: { 'Accept-Encoding': 'gzip' },
          signal: AbortSignal.timeout(20000),
        }),
        fetch('https://meri.digitraffic.fi/api/ais/v1/vessels', {
          headers: { 'Accept-Encoding': 'gzip' },
          signal: AbortSignal.timeout(20000),
        }),
      ]);

      if (!posResponse.ok) throw new Error(`Digitraffic positions HTTP ${posResponse.status}`);
      if (!metaResponse.ok) throw new Error(`Digitraffic vessels HTTP ${metaResponse.status}`);

      const posData = await posResponse.json();
      const metaData = await metaResponse.json();

      // Build MMSI -> metadata lookup
      const metaMap = new Map();
      if (Array.isArray(metaData)) {
        metaData.forEach(v => {
          if (v.mmsi) metaMap.set(v.mmsi, v);
        });
      }

      const features = posData?.features || [];

      ships = features
        .filter(f => {
          const props = f.properties || {};
          const [lon, lat] = f.geometry?.coordinates || [0, 0];
          // Exclude (0,0) coordinates
          if (lat === 0 && lon === 0) return false;
          // Exclude anchored/moored/aground vessels
          if (props.navStat === NAV_STATUS_ANCHORED ||
              props.navStat === NAV_STATUS_MOORED ||
              props.navStat === NAV_STATUS_AGROUND) return false;
          // Only moving vessels (SOG > 0.5 knots)
          if ((props.sog || 0) <= 0.5) return false;
          return true;
        })
        .map(f => {
          const props = f.properties || {};
          const [lon, lat] = f.geometry.coordinates;
          const mmsi = String(props.mmsi || f.mmsi || '');
          const meta = metaMap.get(parseInt(mmsi, 10)) || {};

          return {
            mmsi,
            name: (meta.name || '').trim(),
            imo: meta.imo ? String(meta.imo) : '',
            callSign: (meta.callSign || '').trim(),
            lat,
            lon,
            sog: props.sog || 0,
            cog: props.cog || 0,
            heading: props.heading === 511 ? props.cog || 0 : props.heading || 0,
            destination: (meta.destination || '').trim(),
            shipType: meta.shipType || 0,
            draught: (meta.draught || 0) / 10, // Digitraffic sends decimeters
            eta: meta.eta ? String(meta.eta) : '',
          };
        });

      console.log(`[SHIPS] Digitraffic: ${ships.length} moving vessels (filtered from ${features.length} total, ${metaMap.size} metadata records)`);
    } catch (primaryError) {
      console.error('[SHIPS] Digitraffic failed:', primaryError.message);

      // Fallback: AISStream.io WebSocket burst (requires API key)
      if (process.env.AISSTREAM_API_KEY) {
        try {
          ships = await collectAISStreamBurst(process.env.AISSTREAM_API_KEY, 15000);
          console.log(`[SHIPS] AISStream fallback: ${ships.length} vessels`);
        } catch (fallbackError) {
          console.error('[SHIPS] AISStream fallback failed:', fallbackError.message);
        }
      } else {
        console.warn('[SHIPS] No fallback available (AISSTREAM_API_KEY not set)');
      }
    }

    cache.set('ships', ships, 120); // 2min TTL
    res.json(ships);
  } catch (error) {
    console.error('[SHIPS] Error:', error.message);
    res.status(500).json({ error: 'Ship data fetch failed' });
  }
});

// AISStream.io WebSocket burst collector (fallback when Digitraffic is unavailable)
async function collectAISStreamBurst(apiKey, durationMs = 15000) {
  const wsModule = await import('ws');
  const WsClient = wsModule.default || wsModule.WebSocket;

  return new Promise((resolve, reject) => {
    const shipMap = new Map();
    const ws = new WsClient('wss://stream.aisstream.io/v0/stream');

    const timeout = setTimeout(() => {
      ws.close();
      resolve(Array.from(shipMap.values()));
    }, durationMs);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const meta = msg.MetaData || {};
        const mmsi = String(meta.MMSI || '');
        if (!mmsi) return;
        const existing = shipMap.get(mmsi) || {};

        if (msg.MessageType === 'PositionReport') {
          const pos = msg.Message?.PositionReport || {};
          shipMap.set(mmsi, {
            ...existing,
            mmsi,
            name: (meta.ShipName || existing.name || '').trim(),
            lat: meta.latitude || pos.Latitude || existing.lat || 0,
            lon: meta.longitude || pos.Longitude || existing.lon || 0,
            sog: pos.Sog ?? existing.sog ?? 0,
            cog: pos.Cog ?? existing.cog ?? 0,
            heading: pos.TrueHeading === 511 ? (pos.Cog || 0) : (pos.TrueHeading ?? existing.heading ?? 0),
            shipType: existing.shipType || 0,
            imo: existing.imo || '',
            callSign: existing.callSign || '',
            destination: existing.destination || '',
            draught: existing.draught || 0,
            eta: existing.eta || '',
          });
        } else if (msg.MessageType === 'ShipStaticData') {
          const sd = msg.Message?.ShipStaticData || {};
          shipMap.set(mmsi, {
            ...existing,
            mmsi,
            name: (sd.Name || meta.ShipName || existing.name || '').trim(),
            imo: sd.ImoNumber ? String(sd.ImoNumber) : (existing.imo || ''),
            callSign: (sd.CallSign || existing.callSign || '').trim(),
            shipType: sd.Type ?? existing.shipType ?? 0,
            destination: (sd.Destination || existing.destination || '').trim(),
            draught: sd.MaximumStaticDraught ?? existing.draught ?? 0,
            eta: sd.Eta ? `${sd.Eta.Month}/${sd.Eta.Day} ${sd.Eta.Hour}:${sd.Eta.Minute}` : (existing.eta || ''),
            lat: existing.lat || 0,
            lon: existing.lon || 0,
            sog: existing.sog || 0,
            cog: existing.cog || 0,
            heading: existing.heading || 0,
          });
        }
      } catch (_) { /* skip malformed messages */ }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      resolve(Array.from(shipMap.values()));
    });
  });
}

// ============================================================================
// Route Registry - Background callsign-to-route mapping
// ============================================================================

// In-memory route registry: maps callsign -> { origin, destination, updatedAt }
const routeRegistry = new Map();
let routeRegistryLastRefresh = 0;
const ROUTE_REGISTRY_INTERVAL = 60000; // 60s refresh interval
const ROUTE_BATCH_SIZE = 50; // Max concurrent route lookups per refresh
const ROUTE_STALE_MS = 3600000; // Routes older than 1hr are considered stale

// Fetch route for a single callsign from OpenSky routes API
async function lookupRoute(callsign) {
  try {
    const routeHeaders = {};
    if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
      const credentials = Buffer.from(`${process.env.OPENSKY_CLIENT_ID}:${process.env.OPENSKY_CLIENT_SECRET}`).toString('base64');
      routeHeaders['Authorization'] = `Basic ${credentials}`;
    }
    const response = await fetch(
      `https://opensky-network.org/api/routes?callsign=${encodeURIComponent(callsign)}`,
      { signal: AbortSignal.timeout(5000), headers: routeHeaders }
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (data.route && data.route.length >= 2) {
      console.log(`[FLIGHTS] Route found: ${callsign} -> ${data.route.join(' > ')}`);
      return {
        origin: data.route[0] || '',
        destination: data.route[data.route.length - 1] || '',
        operatorIata: data.operatorIata || '',
        flightNumber: data.flightNumber || 0,
        updatedAt: Date.now(),
      };
    }
    return null;
  } catch (err) {
    console.error(`[FLIGHTS] Route lookup error for ${callsign}: ${err.message}`);
    return null;
  }
}

// Refresh route registry: fetch routes for callsigns not yet in registry
async function refreshRouteRegistry() {
  const now = Date.now();
  if (now - routeRegistryLastRefresh < ROUTE_REGISTRY_INTERVAL) return;
  routeRegistryLastRefresh = now;

  // Get active callsigns from cached flights
  const flights = cache.get('flights') || [];
  const callsigns = flights
    .filter(f => f.callsign && f.callsign.length >= 3 && !f.onGround)
    .map(f => f.callsign)
    .filter(cs => {
      const existing = routeRegistry.get(cs);
      // Skip if already in registry and not stale
      return !existing || (now - existing.updatedAt > ROUTE_STALE_MS);
    });

  if (callsigns.length === 0) return;

  // Pick a random batch of callsigns to look up (spread load over time)
  const shuffled = callsigns.sort(() => Math.random() - 0.5);
  const batch = shuffled.slice(0, ROUTE_BATCH_SIZE);

  const results = await Promise.allSettled(
    batch.map(cs => lookupRoute(cs).then(route => ({ callsign: cs, route })))
  );

  let added = 0;
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.route) {
      routeRegistry.set(result.value.callsign, result.value.route);
      added++;
    }
  }

  // Prune very old entries (>6 hours)
  for (const [key, val] of routeRegistry) {
    if (now - val.updatedAt > 6 * 3600000) {
      routeRegistry.delete(key);
    }
  }

  if (added > 0) {
    console.log(`[FLIGHTS] Route registry: +${added} routes (${routeRegistry.size} total cached)`);
  }
}

// Start background route registry refresh
setInterval(refreshRouteRegistry, ROUTE_REGISTRY_INTERVAL);

// Enrich aircraft array with route data from registry
function enrichWithRoutes(aircraft) {
  for (const ac of aircraft) {
    if (ac.callsign && routeRegistry.has(ac.callsign)) {
      const route = routeRegistry.get(ac.callsign);
      ac.origin = route.origin;
      ac.destination = route.destination;
    }
  }
  return aircraft;
}

// ============================================================================
// Flights Endpoint - FR24 + adsb.fi fallback
// ============================================================================
app.get('/api/flights', async (_req, res) => {
  try {
    const cached = cache.get('flights');
    if (cached) return res.json(cached);

    // Primary: OpenSky Network (anonymous or authenticated with OPENSKY credentials)
    try {
      const openskyHeaders = {};
      if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
        const credentials = Buffer.from(`${process.env.OPENSKY_CLIENT_ID}:${process.env.OPENSKY_CLIENT_SECRET}`).toString('base64');
        openskyHeaders['Authorization'] = `Basic ${credentials}`;
      }
      const response = await fetch('https://opensky-network.org/api/states/all', {
        signal: AbortSignal.timeout(15000),
        headers: openskyHeaders,
      });
      if (!response.ok) throw new Error(`OpenSky HTTP ${response.status}`);
      const data = await response.json();
      const states = data?.states || [];
      // OpenSky state vector format: [icao24, callsign, origin_country, time_position, last_contact,
      //   lon, lat, baro_altitude, on_ground, velocity, true_track, vertical_rate, sensors,
      //   geo_altitude, squawk, spi, position_source]
      const aircraft = states
        .filter(s => s[5] !== null && s[6] !== null) // has position (include ground for departure detection)
        .map(s => ({
          icao24: (s[0] || '').trim(),
          callsign: (s[1] || '').trim(),
          registration: '',
          lat: s[6] || 0,
          lon: s[5] || 0,
          altitudeMeters: s[7] || 0,
          altitudeFeet: Math.round((s[7] || 0) * 3.28084),
          velocityMs: s[9] || 0,
          velocityKnots: Math.round((s[9] || 0) * 1.94384),
          heading: s[10] || 0,
          verticalRate: s[11] || 0,
          origin: '',
          destination: '',
          onGround: !!s[8],
        }));
      const airborneCount = aircraft.filter(a => !a.onGround).length;
      console.log(`[FLIGHTS] OpenSky: ${airborneCount} airborne + ${aircraft.length - airborneCount} ground from ${states.length} total states`);
      enrichWithRoutes(aircraft);
      cache.set('flights', aircraft, 30); // 30s TTL
      // Trigger background route registry refresh (non-blocking)
      refreshRouteRegistry().catch(() => {});
      res.json(aircraft);
    } catch (primaryError) {
      console.error('[FLIGHTS] OpenSky failed:', primaryError.message);
      // Fallback to adsb.fi
      try {
        const response = await fetch('https://api.adsb.fi/v2/all', {
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`adsb.fi HTTP ${response.status}`);
        const data = await response.json();
        const aircraft = (data?.ac || [])
          .filter(ac => ac.lat && ac.lon) // include ground aircraft for departure detection
          .map(ac => ({
            icao24: ac.hex || '',
            callsign: (ac.flight || '').trim(),
            registration: ac.r || '',
            lat: ac.lat || 0,
            lon: ac.lon || 0,
            altitudeMeters: ac.alt_baro === 'ground' ? 0 : ((ac.alt_baro || 0) * 0.3048),
            altitudeFeet: ac.alt_baro === 'ground' ? 0 : (ac.alt_baro || 0),
            velocityMs: (ac.gs || 0) * 0.514444,
            velocityKnots: ac.gs || 0,
            heading: ac.track || 0,
            verticalRate: ac.baro_rate || 0,
            origin: '',
            destination: '',
            onGround: ac.alt_baro === 'ground' || !!ac.ground,
          }));
        enrichWithRoutes(aircraft);
        const fallbackAirborne = aircraft.filter(a => !a.onGround).length;
        console.log(`[FLIGHTS] adsb.fi fallback: ${fallbackAirborne} airborne + ${aircraft.length - fallbackAirborne} ground`);
        cache.set('flights', aircraft, 30);
        refreshRouteRegistry().catch(() => {});
        res.json(aircraft);
      } catch (fallbackError) {
        console.error('[FLIGHTS] Both sources failed:', fallbackError.message);
        res.json([]);
      }
    }
  } catch (error) {
    console.error('[FLIGHTS] Error:', error.message);
    res.status(500).json({ error: 'Flight data fetch failed' });
  }
});

// ============================================================================
// Flights Live Endpoint - adsb.fi regional
// ============================================================================
app.get('/api/flights/live', async (req, res) => {
  try {
    const { lat, lon, dist } = req.query;
    const cacheKey = `flights_live_${lat}_${lon}_${dist}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing lat/lon parameters' });
    }

    // OpenSky Network bounding box query for regional data
    // Convert lat/lon/dist to bounding box (dist in nautical miles, convert to degrees approx)
    const distance = parseFloat(dist) || 100;
    const latDeg = distance / 60; // rough nautical miles to degrees
    const lonDeg = distance / (60 * Math.cos((parseFloat(lat) * Math.PI) / 180));
    const lamin = parseFloat(lat) - latDeg;
    const lamax = parseFloat(lat) + latDeg;
    const lomin = parseFloat(lon) - lonDeg;
    const lomax = parseFloat(lon) + lonDeg;

    try {
      const openskyLiveHeaders = {};
      if (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET) {
        const credentials = Buffer.from(`${process.env.OPENSKY_CLIENT_ID}:${process.env.OPENSKY_CLIENT_SECRET}`).toString('base64');
        openskyLiveHeaders['Authorization'] = `Basic ${credentials}`;
      }
      const response = await fetch(
        `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`,
        { signal: AbortSignal.timeout(10000), headers: openskyLiveHeaders }
      );
      if (!response.ok) throw new Error(`OpenSky HTTP ${response.status}`);
      const data = await response.json();
      const states = data?.states || [];
      const aircraft = states
        .filter(s => s[5] !== null && s[6] !== null)
        .map(s => ({
          icao24: (s[0] || '').trim(),
          callsign: (s[1] || '').trim(),
          registration: '',
          lat: s[6] || 0,
          lon: s[5] || 0,
          altitudeMeters: s[7] || 0,
          altitudeFeet: Math.round((s[7] || 0) * 3.28084),
          velocityMs: s[9] || 0,
          velocityKnots: Math.round((s[9] || 0) * 1.94384),
          heading: s[10] || 0,
          verticalRate: s[11] || 0,
          origin: '',
          destination: '',
          onGround: !!s[8],
        }));

      // Look up routes for callsigns not yet in registry (wait briefly for results)
      const unknownCallsigns = aircraft
        .filter(a => a.callsign && a.callsign.length >= 3 && !a.onGround && !routeRegistry.has(a.callsign))
        .map(a => a.callsign)
        .slice(0, 15); // Limit concurrent lookups
      if (unknownCallsigns.length > 0) {
        console.log(`[FLIGHTS] Live: looking up ${unknownCallsigns.length} unknown callsigns: ${unknownCallsigns.slice(0, 5).join(', ')}...`);
        try {
          const results = await Promise.allSettled(
            unknownCallsigns.map(cs => lookupRoute(cs).then(route => {
              if (route) {
                routeRegistry.set(cs, route);
                return cs;
              }
              return null;
            }))
          );
          const found = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
          if (found.length > 0) {
            console.log(`[FLIGHTS] Live: found routes for: ${found.join(', ')}`);
          }
        } catch (err) {
          console.error(`[FLIGHTS] Live route lookup error: ${err.message}`);
        }
      }
      console.log(`[FLIGHTS] Live: registry size=${routeRegistry.size}, enriching ${aircraft.length} aircraft`);

      // Enrich with route data from registry (including freshly looked-up routes)
      enrichWithRoutes(aircraft);
      const enrichedCount = aircraft.filter(a => a.origin && a.origin.length > 0).length;
      console.log(`[FLIGHTS] Live: enriched ${enrichedCount} aircraft with routes`);

      cache.set(cacheKey, aircraft, 4); // 4s TTL
      res.json(aircraft);
    } catch (primaryError) {
      console.error('[FLIGHTS] OpenSky live failed:', primaryError.message);
      // Fallback to adsb.fi
      try {
        const response = await fetch(`https://api.adsb.fi/v2/lat/${lat}/lon/${lon}/dist/${distance}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`adsb.fi HTTP ${response.status}`);
        const data = await response.json();
        const aircraft = (data?.ac || []).map(ac => ({
          icao24: ac.hex || '',
          callsign: (ac.flight || '').trim(),
          registration: ac.r || '',
          lat: ac.lat || 0,
          lon: ac.lon || 0,
          altitudeMeters: (ac.alt_baro || 0) * 0.3048,
          altitudeFeet: ac.alt_baro || 0,
          velocityMs: (ac.gs || 0) * 0.514444,
          velocityKnots: ac.gs || 0,
          heading: ac.track || 0,
          verticalRate: ac.baro_rate || 0,
          origin: '',
          destination: '',
          onGround: ac.alt_baro === 'ground',
        }));
        // Look up routes for unknown callsigns
        const fallbackUnknown = aircraft
          .filter(a => a.callsign && a.callsign.length >= 3 && !a.onGround && !routeRegistry.has(a.callsign))
          .map(a => a.callsign)
          .slice(0, 15);
        if (fallbackUnknown.length > 0) {
          try {
            await Promise.allSettled(
              fallbackUnknown.map(cs => lookupRoute(cs).then(route => {
                if (route) routeRegistry.set(cs, route);
              }))
            );
          } catch (_) { /* non-critical */ }
        }
        enrichWithRoutes(aircraft);
        cache.set(cacheKey, aircraft, 4);
        res.json(aircraft);
      } catch (fallbackError) {
        console.error('[FLIGHTS] Both live sources failed:', fallbackError.message);
        res.json([]);
      }
    }
  } catch (error) {
    console.error('[FLIGHTS] Live error:', error.message);
    res.status(500).json({ error: 'Live flight data fetch failed' });
  }
});

// ============================================================================
// HTTP Server + WebSocket
// ============================================================================
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  let flightPollInterval = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'subscribe-flights' && msg.bbox) {
        // TODO: Implement OpenSky Network polling at 10s intervals
        console.log('[WS] Flight subscription for bbox:', msg.bbox);
      }
    } catch (err) {
      console.error('[WS] Invalid message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    if (flightPollInterval) clearInterval(flightPollInterval);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });
});

// ============================================================================
// Start Server
// ============================================================================
server.listen(PORT, () => {
  console.log(`\n🌍 WorldView Express proxy running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`   Env keys loaded: ${[
    process.env.AISSTREAM_API_KEY ? 'AISSTREAM' : null,
    process.env.NSW_TRANSPORT_API_KEY ? 'NSW' : null,
    process.env.OPENSKY_CLIENT_ID ? 'OPENSKY' : null,
  ].filter(Boolean).join(', ') || 'none (free APIs only)'}\n`);
});
