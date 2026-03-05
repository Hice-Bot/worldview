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

      // Parse OSM elements into road segments
      const roads = (data.elements || []).map((el) => ({
        id: String(el.id),
        classification: el.tags?.highway || 'residential',
        geometry: (el.geometry || []).map((p) => [p.lon, p.lat]),
        length: 0, // TODO: Calculate via Haversine
        name: el.tags?.name || '',
      }));

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
      // Austin TX
      fetch('https://data.austintexas.gov/resource/b4k4-adkb.json')
        .then(r => r.json())
        .then(data => (data || []).map(cam => ({
          id: cam.camera_id || cam.location_name,
          name: cam.location_name || 'Unknown',
          lat: parseFloat(cam.location_latitude) || 0,
          lon: parseFloat(cam.location_longitude) || 0,
          imageUrl: cam.camera_mfg_url || '',
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
// Ships Endpoint - AIS burst collection
// ============================================================================
app.get('/api/ships', async (_req, res) => {
  try {
    const cached = cache.get('ships');
    if (cached) return res.json(cached);

    if (!process.env.AISSTREAM_API_KEY) {
      console.warn('[SHIPS] No AISSTREAM_API_KEY configured');
      return res.json([]);
    }

    // TODO: Implement AIS burst collection pattern
    // Open temporary 20s WebSocket, aggregate messages, deduplicate by MMSI
    const ships = [];
    cache.set('ships', ships, 60); // 60s TTL
    res.json(ships);
  } catch (error) {
    console.error('[SHIPS] Error:', error.message);
    res.status(500).json({ error: 'Ship data fetch failed' });
  }
});

// ============================================================================
// Flights Endpoint - FR24 + adsb.fi fallback
// ============================================================================
app.get('/api/flights', async (_req, res) => {
  try {
    const cached = cache.get('flights');
    if (cached) return res.json(cached);

    // Primary: OpenSky Network (free, no auth required for anonymous access)
    try {
      const response = await fetch('https://opensky-network.org/api/states/all', {
        signal: AbortSignal.timeout(15000),
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
      cache.set('flights', aircraft, 30); // 30s TTL
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
        const fallbackAirborne = aircraft.filter(a => !a.onGround).length;
        console.log(`[FLIGHTS] adsb.fi fallback: ${fallbackAirborne} airborne + ${aircraft.length - fallbackAirborne} ground`);
        cache.set('flights', aircraft, 30);
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
      const response = await fetch(
        `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`,
        { signal: AbortSignal.timeout(10000) }
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
