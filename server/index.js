import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

// Load server-side env
dotenv.config({ path: './server/.env' });

// ============================================================================
// Environment Variable Validation
// ============================================================================
function validateEnvVars() {
  const warnings = [];

  // AISSTREAM_API_KEY — optional, enables AISStream.io WebSocket fallback for ship data
  if (!process.env.AISSTREAM_API_KEY) {
    warnings.push('[ENV] WARNING: AISSTREAM_API_KEY not set — AISStream.io ship fallback unavailable, /api/ships will return empty if Digitraffic fails');
  }

  // NSW_TRANSPORT_API_KEY — optional, enables NSW Australia CCTV cameras
  if (!process.env.NSW_TRANSPORT_API_KEY) {
    warnings.push('[ENV] WARNING: NSW_TRANSPORT_API_KEY not set — NSW Transport cameras will be excluded from /api/cctv');
  }

  // OPENSKY credentials — optional, enhances flight route lookups and live data
  if (!process.env.OPENSKY_CLIENT_ID || !process.env.OPENSKY_CLIENT_SECRET) {
    warnings.push('[ENV] WARNING: OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET not set — OpenSky API will use anonymous access with lower rate limits');
  }

  // Log all warnings
  for (const warning of warnings) {
    console.warn(warning);
  }

  return warnings;
}

const envWarnings = validateEnvVars();

// Global handlers for unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled promise rejection:', reason?.message || reason);
});

process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught exception:', error.message);
  // Don't exit — keep server running for other requests
});

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
  try {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      cache: {
        keys: cache.keys().length,
        stats: cache.getStats(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[HEALTH] Error:', error.message);
    res.status(500).json({ error: 'Health check failed' });
  }
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

    // Validate GeoJSON format
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
      console.error('[SEIS] Validation failed: upstream response is not valid GeoJSON FeatureCollection');
      return res.status(502).json({ error: 'Upstream earthquake data is not valid GeoJSON' });
    }

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

// Validate a single TLE entry has proper 3-line format
function isValidTLE(sat) {
  if (!sat || !sat.tle1 || !sat.tle2) return false;
  if (!sat.tle1.startsWith('1 ') || !sat.tle2.startsWith('2 ')) return false;
  // TLE lines should be ~69 characters
  if (sat.tle1.length < 60 || sat.tle2.length < 60) return false;
  return true;
}

// Parse CelesTrak 3-line TLE text into SatelliteData objects
function parseCelesTrakTLE(text, category) {
  if (!text || typeof text !== 'string') {
    console.error(`[SAT] Validation failed: CelesTrak response for ${category} is not a string`);
    return [];
  }
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 3) {
    console.error(`[SAT] Validation failed: CelesTrak response for ${category} has fewer than 3 lines`);
    return [];
  }
  const satellites = [];
  let skipped = 0;
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const tle1 = lines[i + 1];
    const tle2 = lines[i + 2];
    // Validate TLE format: line 1 starts with "1 ", line 2 starts with "2 "
    if (!tle1.startsWith('1 ') || !tle2.startsWith('2 ')) {
      skipped++;
      continue;
    }
    // Extract NORAD ID from line 1 (columns 3-7)
    const noradId = parseInt(tle1.substring(2, 7).trim(), 10) || 0;
    satellites.push({ name: name.trim(), noradId, tle1, tle2, category });
  }
  if (skipped > 0) {
    console.warn(`[SAT] Validation: skipped ${skipped} malformed TLE entries in ${category}`);
  }
  return satellites;
}

// Parse ivanstanojevic.me API response into SatelliteData objects
function parseIvanTLE(apiResponse, category) {
  if (!apiResponse || typeof apiResponse !== 'object') {
    console.error(`[SAT] Validation failed: ivanstanojevic response for ${category} is not a valid object`);
    return [];
  }
  const members = apiResponse.member || [];
  if (!Array.isArray(members)) {
    console.error(`[SAT] Validation failed: ivanstanojevic response for ${category} has no member array`);
    return [];
  }
  const parsed = members.map(m => ({
    name: (m.name || '').trim(),
    noradId: m.satelliteId || 0,
    tle1: m.line1 || '',
    tle2: m.line2 || '',
    category,
  }));
  const valid = parsed.filter(s => isValidTLE(s));
  const invalid = parsed.length - valid.length;
  if (invalid > 0) {
    console.warn(`[SAT] Validation: filtered out ${invalid} invalid TLE entries from ${category}`);
  }
  return valid;
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

    // Primary: tle.ivanstanojevic.me (as per app spec)
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
      console.log(`[SAT] ivanstanojevic: ${allSatellites.length} satellites from groups: ${groups}`);
    } catch (primaryError) {
      console.error('[SAT] ivanstanojevic failed, trying CelesTrak:', primaryError.message);
      // Fallback: CelesTrak
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
        console.log(`[SAT] CelesTrak fallback: ${allSatellites.length} satellites`);
      } catch (fallbackError) {
        console.error('[SAT] Both sources failed:', fallbackError.message);
        return res.status(500).json({ error: 'Satellite data fetch failed' });
      }
    }

    // Validate all satellites have proper TLE format before deduplication
    const validSatellites = allSatellites.filter(s => {
      if (!isValidTLE(s)) {
        console.warn(`[SAT] Validation: dropping satellite "${s.name}" (NORAD ${s.noradId}) — invalid TLE format`);
        return false;
      }
      return true;
    });

    if (validSatellites.length === 0 && allSatellites.length > 0) {
      console.error(`[SAT] Validation failed: all ${allSatellites.length} satellites had invalid TLE format`);
      return res.status(502).json({ error: 'Upstream satellite data failed TLE validation' });
    }

    // Deduplicate by NORAD ID (keep first occurrence)
    const seen = new Set();
    const deduplicated = validSatellites.filter(s => {
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

    // --- BBOX PARAMETER VALIDATION ---

    // If any bbox params missing, return Sydney CBD fallback
    if (!south || !west || !north || !east) {
      const fallbackKey = 'traffic_fallback_sydney';
      const cached = cache.get(fallbackKey);
      if (cached) return res.json(cached);
      const { sydneyRoads } = await import('./data/sydneyRoads.js');
      cache.set(fallbackKey, sydneyRoads, 86400);
      return res.json(sydneyRoads);
    }

    // Parse to numbers and validate
    let s = parseFloat(south);
    let w = parseFloat(west);
    let n = parseFloat(north);
    let e = parseFloat(east);

    // Check for NaN (non-numeric input)
    if (isNaN(s) || isNaN(w) || isNaN(n) || isNaN(e)) {
      return res.status(400).json({
        error: 'Invalid bounding box coordinates. All values must be numeric.',
        params: { south, west, north, east },
      });
    }

    // Clamp to valid geographic ranges
    s = Math.max(-90, Math.min(90, s));
    n = Math.max(-90, Math.min(90, n));
    w = Math.max(-180, Math.min(180, w));
    e = Math.max(-180, Math.min(180, e));

    // Ensure south < north (swap if inverted)
    if (s > n) {
      [s, n] = [n, s];
    }

    // Ensure west < east (swap if inverted, unless it's a wrap-around)
    if (w > e) {
      [w, e] = [e, w];
    }

    // Clamp extremely large bounding boxes to max ~2 degrees span
    // to prevent overloading Overpass API
    const MAX_BBOX_SPAN = 2.0; // degrees
    const latSpan = n - s;
    const lonSpan = e - w;

    if (latSpan > MAX_BBOX_SPAN) {
      const mid = (s + n) / 2;
      s = mid - MAX_BBOX_SPAN / 2;
      n = mid + MAX_BBOX_SPAN / 2;
    }
    if (lonSpan > MAX_BBOX_SPAN) {
      const mid = (w + e) / 2;
      w = mid - MAX_BBOX_SPAN / 2;
      e = mid + MAX_BBOX_SPAN / 2;
    }

    const cacheKey = `traffic_${s}_${w}_${n}_${e}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const query = `[out:json][timeout:15];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential)$"](${s},${w},${n},${e});out geom;`;
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
// CCTV Helper - Extract compass direction from TfL view/name fields
// ============================================================================
function extractCompassDirection(view, name) {
  // Check view field first (e.g. "ZOOM WEST-The Grove", "EAST ON A40")
  const combined = `${view} ${name}`.toUpperCase();
  // Match multi-word directions first, then single
  const patterns = [
    { re: /\bNORTH\s*EAST\b|\bNE\b/, dir: 'NE' },
    { re: /\bNORTH\s*WEST\b|\bNW\b/, dir: 'NW' },
    { re: /\bSOUTH\s*EAST\b|\bSE\b/, dir: 'SE' },
    { re: /\bSOUTH\s*WEST\b|\bSW\b/, dir: 'SW' },
    { re: /\bNORTH\b|\bN\b(?![\w])/, dir: 'N' },
    { re: /\bSOUTH\b|\bS\b(?![\w])/, dir: 'S' },
    { re: /\bEAST\b|\bE\b(?![\w])/, dir: 'E' },
    { re: /\bWEST\b|\bW\b(?![\w])/, dir: 'W' },
  ];
  for (const { re, dir } of patterns) {
    if (re.test(combined)) return dir;
  }
  return '';
}

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
          direction: extractCompassDirection(cam.additionalProperties?.find(p => p.key === 'view')?.value || '', cam.commonName || ''),
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
    const providerNames = ['TfL London', 'Austin TX', ...(process.env.NSW_TRANSPORT_API_KEY ? ['NSW Transport'] : [])];
    for (let i = 0; i < sources.length; i++) {
      const result = sources[i];
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        cameras = cameras.concat(result.value);
      } else if (result.status === 'rejected') {
        console.error(`[CCTV] Provider ${providerNames[i] || i} failed:`, result.reason?.message || result.reason);
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

    // Reject very long URLs (max 2048 characters)
    if (String(imageUrl).length > 2048) {
      return res.status(400).json({ error: 'URL too long' });
    }

    // Validate URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(String(imageUrl));
    } catch (_urlError) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const response = await fetch(String(imageUrl), {
      signal: AbortSignal.timeout(15000), // 15s timeout for slow image fetches
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Image fetch failed' });
    }

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('[CCTV] Image proxy error:', error.message);
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).json({ error: 'Image fetch timed out' });
    }
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

      // Validate Digitraffic response format
      if (!posData || !Array.isArray(posData.features)) {
        console.error('[SHIPS] Validation failed: Digitraffic positions response missing features array');
        throw new Error('Digitraffic positions response is not valid GeoJSON');
      }

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

// Validate and sanitize flight data fields
// Ensures every aircraft has valid icao24, lat/lon in range, numeric altitude/velocity/heading
// Filters out aircraft with invalid critical fields, sanitizes non-critical fields
function validateFlightData(aircraft) {
  return aircraft
    .filter(ac => {
      // icao24 must be a non-empty string (ideally 6-char hex, but some sources vary)
      if (!ac.icao24 || typeof ac.icao24 !== 'string' || ac.icao24.trim().length === 0) return false;
      // lat/lon must be numeric and within valid ranges
      if (typeof ac.lat !== 'number' || isNaN(ac.lat) || ac.lat < -90 || ac.lat > 90) return false;
      if (typeof ac.lon !== 'number' || isNaN(ac.lon) || ac.lon < -180 || ac.lon > 180) return false;
      return true;
    })
    .map(ac => {
      // Sanitize numeric fields: replace NaN/undefined with 0
      ac.altitudeMeters = (typeof ac.altitudeMeters === 'number' && !isNaN(ac.altitudeMeters)) ? ac.altitudeMeters : 0;
      ac.altitudeFeet = (typeof ac.altitudeFeet === 'number' && !isNaN(ac.altitudeFeet)) ? ac.altitudeFeet : 0;
      ac.velocityMs = (typeof ac.velocityMs === 'number' && !isNaN(ac.velocityMs)) ? ac.velocityMs : 0;
      ac.velocityKnots = (typeof ac.velocityKnots === 'number' && !isNaN(ac.velocityKnots)) ? ac.velocityKnots : 0;
      ac.heading = (typeof ac.heading === 'number' && !isNaN(ac.heading)) ? (ac.heading % 360 + 360) % 360 : 0;
      ac.verticalRate = (typeof ac.verticalRate === 'number' && !isNaN(ac.verticalRate)) ? ac.verticalRate : 0;
      // Ensure string fields are strings
      ac.callsign = (ac.callsign || '').toString().trim();
      ac.registration = (ac.registration || '').toString().trim();
      ac.origin = (ac.origin || '').toString().trim();
      ac.destination = (ac.destination || '').toString().trim();
      ac.onGround = !!ac.onGround;
      return ac;
    });
}

// ============================================================================
// Flights Endpoint - FR24 + adsb.fi fallback
// ============================================================================

// FR24 regional zones covering the globe (7 zones)
const FR24_ZONES = [
  { name: 'north_america', bounds: '70,-140,10,-50' },
  { name: 'europe', bounds: '72,-15,35,45' },
  { name: 'asia', bounds: '60,45,5,145' },
  { name: 'south_america', bounds: '15,-90,-60,-30' },
  { name: 'oceania', bounds: '5,95,-50,180' },
  { name: 'middle_east', bounds: '42,25,10,65' },
  { name: 'africa', bounds: '40,-20,-40,55' },
];

let fr24LastFetch = 0;
const FR24_MIN_INTERVAL = 15000; // 15s minimum between upstream FR24 calls
let fr24BackoffMs = 0; // Exponential backoff for FR24 failures

// Parse FR24 response into aircraft array
function parseFR24Data(data) {
  const aircraft = [];
  if (!data || typeof data !== 'object') return aircraft;
  for (const [key, val] of Object.entries(data)) {
    // FR24 keys are hex IDs; skip metadata fields (full_count, version, stats, etc.)
    if (!Array.isArray(val) || val.length < 14) continue;
    // FR24 array format: [icao24, lat, lon, heading, altitude_ft, speed_kts, squawk,
    //   radar, aircraft_type, registration, timestamp, origin, destination, callsign, ...]
    const icao24 = (val[0] || '').toLowerCase().trim();
    const lat = val[1] || 0;
    const lon = val[2] || 0;
    const heading = val[3] || 0;
    const altitudeFeet = val[4] || 0;
    const speedKnots = val[5] || 0;
    const registration = val[9] || '';
    const origin = val[11] || '';
    const destination = val[12] || '';
    const callsign = (val[13] || '').trim();
    const onGround = altitudeFeet <= 0;

    if (!lat && !lon) continue; // skip entries without position

    aircraft.push({
      icao24,
      callsign,
      registration,
      lat,
      lon,
      altitudeMeters: Math.round(altitudeFeet * 0.3048),
      altitudeFeet,
      velocityMs: Math.round(speedKnots * 0.514444 * 100) / 100,
      velocityKnots: speedKnots,
      heading,
      verticalRate: 0, // FR24 doesn't provide vertical rate in basic feed
      origin,
      destination,
      onGround,
    });

    // Also populate route registry from FR24 data
    if (callsign && origin && destination) {
      routeRegistry.set(callsign, {
        origin,
        destination,
        operatorIata: '',
        flightNumber: 0,
        updatedAt: Date.now(),
      });
    }
  }
  return aircraft;
}

app.get('/api/flights', async (_req, res) => {
  try {
    const cached = cache.get('flights');
    if (cached) return res.json(cached);

    // Primary: FlightRadar24 cloud API (7 regional zones in parallel)
    const now = Date.now();
    const timeSinceLastFR24 = now - fr24LastFetch;
    const fr24CooldownOk = timeSinceLastFR24 >= FR24_MIN_INTERVAL + fr24BackoffMs;

    if (fr24CooldownOk) {
      try {
        fr24LastFetch = now;
        const zoneResults = await Promise.allSettled(
          FR24_ZONES.map(async (zone) => {
            const url = `https://data-cloud.flightradar24.com/zones/fcgi/feed.js?faa=1&satellite=1&mlat=1&flarm=1&adsb=1&gnd=1&air=1&vehicles=0&estimated=1&gliders=0&stats=0&bounds=${zone.bounds}`;
            const response = await fetch(url, {
              signal: AbortSignal.timeout(15000),
              headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json',
              },
            });
            if (!response.ok) throw new Error(`FR24 ${zone.name} HTTP ${response.status}`);
            const data = await response.json();
            return parseFR24Data(data);
          })
        );

        // Collect successful zone results
        const allAircraft = [];
        const icaoSeen = new Set();
        let failedZones = 0;
        for (const result of zoneResults) {
          if (result.status === 'fulfilled') {
            for (const ac of result.value) {
              if (!icaoSeen.has(ac.icao24)) {
                icaoSeen.add(ac.icao24);
                allAircraft.push(ac);
              }
            }
          } else {
            failedZones++;
          }
        }

        if (allAircraft.length === 0) {
          throw new Error(`FR24: all ${failedZones} zones failed, 0 aircraft`);
        }

        // Reset backoff on success
        fr24BackoffMs = 0;
        const airborneCount = allAircraft.filter(a => !a.onGround).length;
        console.log(`[FLIGHTS] FR24: ${airborneCount} airborne + ${allAircraft.length - airborneCount} ground from ${7 - failedZones}/7 zones`);
        enrichWithRoutes(allAircraft);
        const validatedAircraft = validateFlightData(allAircraft);
        cache.set('flights', validatedAircraft, 30); // 30s TTL
        refreshRouteRegistry().catch(() => {});
        res.json(validatedAircraft);
        return;
      } catch (primaryError) {
        // Apply exponential backoff for FR24 failures
        fr24BackoffMs = Math.min((fr24BackoffMs || 15000) * 2, 120000); // start 30s, cap 2min
        console.error(`[FLIGHTS] FR24 failed (backoff ${Math.round(fr24BackoffMs / 1000)}s):`, primaryError.message);
      }
    } else {
      console.log(`[FLIGHTS] FR24 cooldown: ${Math.round((FR24_MIN_INTERVAL + fr24BackoffMs - timeSinceLastFR24) / 1000)}s remaining`);
    }

    // Fallback: adsb.fi global endpoint
    try {
      const response = await fetch('https://api.adsb.fi/v2/all', {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`adsb.fi HTTP ${response.status}`);
      const data = await response.json();
      const aircraft = (data?.ac || [])
        .filter(ac => ac.lat && ac.lon)
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
      const validatedFallback = validateFlightData(aircraft);
      const fallbackAirborne = validatedFallback.filter(a => !a.onGround).length;
      console.log(`[FLIGHTS] adsb.fi fallback: ${fallbackAirborne} airborne + ${validatedFallback.length - fallbackAirborne} ground`);
      cache.set('flights', validatedFallback, 30);
      refreshRouteRegistry().catch(() => {});
      res.json(validatedFallback);
    } catch (fallbackError) {
      console.error('[FLIGHTS] Both sources failed:', fallbackError.message);
      res.json([]);
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
      const validatedLive = validateFlightData(aircraft);
      const enrichedCount = validatedLive.filter(a => a.origin && a.origin.length > 0).length;
      console.log(`[FLIGHTS] Live: enriched ${enrichedCount} aircraft with routes`);

      cache.set(cacheKey, validatedLive, 4); // 4s TTL
      res.json(validatedLive);
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
        const validatedLiveFb = validateFlightData(aircraft);
        cache.set(cacheKey, validatedLiveFb, 4);
        res.json(validatedLiveFb);
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

// Track active WebSocket connections for monitoring
let wsConnectionCount = 0;

wss.on('connection', (ws, req) => {
  wsConnectionCount++;
  const clientId = wsConnectionCount;
  const clientIp = req.socket.remoteAddress || 'unknown';
  console.log(`[WS] Client #${clientId} connected from ${clientIp} (${wss.clients.size} total)`);

  let flightPollInterval = null;
  let currentSubscription = null;
  let isAlive = true;

  // Heartbeat: detect broken connections
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    // Guard against empty messages
    const raw = data.toString();
    if (!raw || raw.length === 0) {
      console.warn(`[WS] Client #${clientId}: empty message ignored`);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.error(`[WS] Client #${clientId}: invalid JSON: ${err.message} (data: "${raw.substring(0, 100)}")`);
      // Send error back to client but don't crash
      try {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
      } catch (_) { /* client may have disconnected */ }
      return;
    }

    // Handle message types
    if (msg.type === 'subscribe-flights' && msg.bbox) {
      // Clear previous subscription if exists
      if (flightPollInterval) {
        clearInterval(flightPollInterval);
        flightPollInterval = null;
      }

      const { south, north, west, east } = msg.bbox;
      currentSubscription = { south, north, west, east };
      console.log(`[WS] Client #${clientId}: subscribing to flights bbox [${south},${west} -> ${north},${east}]`);

      // Send initial acknowledgment
      try {
        ws.send(JSON.stringify({ type: 'subscription-ack', bbox: msg.bbox }));
      } catch (_) { /* client may have disconnected */ }

      // Poll flight data at 10s intervals
      const pollFlights = async () => {
        // Don't poll if connection is closed
        if (ws.readyState !== ws.OPEN) {
          if (flightPollInterval) {
            clearInterval(flightPollInterval);
            flightPollInterval = null;
          }
          return;
        }

        try {
          // Use cached flights data from the /api/flights endpoint
          let flights = cache.get('flights') || [];

          // Filter to bounding box
          const filtered = flights.filter(f =>
            f.lat >= south && f.lat <= north &&
            f.lon >= west && f.lon <= east &&
            !f.onGround
          );

          ws.send(JSON.stringify({
            type: 'flights-update',
            count: filtered.length,
            aircraft: filtered,
            timestamp: Date.now(),
          }));
        } catch (upstreamError) {
          // Catch upstream / data processing failures
          console.error(`[WS] Client #${clientId}: flight poll error: ${upstreamError.message}`);
          try {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Upstream flight data temporarily unavailable',
              retrying: true,
            }));
          } catch (_) { /* client may have disconnected */ }
        }
      };

      // Initial poll immediately
      pollFlights();
      // Then every 10 seconds
      flightPollInterval = setInterval(pollFlights, 10000);

    } else if (msg.type === 'unsubscribe-flights') {
      // Allow clients to unsubscribe
      if (flightPollInterval) {
        clearInterval(flightPollInterval);
        flightPollInterval = null;
        currentSubscription = null;
        console.log(`[WS] Client #${clientId}: unsubscribed from flights`);
      }

    } else if (msg.type === 'ping') {
      // Application-level ping/pong
      try {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      } catch (_) { /* client may have disconnected */ }

    } else {
      console.warn(`[WS] Client #${clientId}: unknown message type "${msg.type || 'undefined'}"`);
      try {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
      } catch (_) { /* client may have disconnected */ }
    }
  });

  ws.on('close', (code, reason) => {
    const reasonStr = reason ? reason.toString() : 'none';
    console.log(`[WS] Client #${clientId} disconnected (code: ${code}, reason: ${reasonStr}, ${wss.clients.size} remaining)`);
    // Clean up all resources
    if (flightPollInterval) {
      clearInterval(flightPollInterval);
      flightPollInterval = null;
    }
    currentSubscription = null;
    isAlive = false;
  });

  ws.on('error', (err) => {
    console.error(`[WS] Client #${clientId} error: ${err.message}`);
    // Clean up on error
    if (flightPollInterval) {
      clearInterval(flightPollInterval);
      flightPollInterval = null;
    }
    currentSubscription = null;
    isAlive = false;
  });
});

// WebSocket heartbeat interval: detect and close broken connections
const wsHeartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[WS] Terminating unresponsive client');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Check every 30 seconds

wss.on('close', () => {
  clearInterval(wsHeartbeat);
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
