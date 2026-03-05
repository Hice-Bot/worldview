// ============================================================================
// WorldView Type Definitions
// ============================================================================

// --- Layer State ---
export interface LayerState {
  flights: boolean;
  satellites: boolean;
  earthquakes: boolean;
  traffic: boolean;
  cctv: boolean;
  ships: boolean;
}

// --- Shader Modes ---
export type ShaderMode = 'STANDARD' | 'CRT' | 'NVG' | 'FLIR';

// --- Map Tile Modes ---
export type MapTileMode = 'GOOGLE_3D' | 'OSM';

// --- Camera State ---
export interface CameraState {
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  pitch: number;
}

// --- Entity Types ---
export type EntityType = 'aircraft' | 'satellite' | 'ship' | 'earthquake' | 'cctv';

// --- Tracked Entity Info ---
export interface TrackedEntityInfo {
  type: EntityType;
  id: string;
  name: string;
  data: Record<string, unknown>;
}

// --- Altitude Filters ---
export interface AltitudeFilters {
  cruise: boolean; // >= 35,000 ft
  high: boolean;   // >= 20,000 ft
  mid: boolean;    // >= 10,000 ft
  low: boolean;    // >= 3,000 ft
  ground: boolean; // < 3,000 ft
}

// --- Satellite Filters ---
export interface SatelliteFilters {
  iss: boolean;
  other: boolean;
  showPaths: boolean;
}

// --- Flight Data ---
export interface FlightData {
  icao24: string;
  callsign: string;
  registration: string;
  lat: number;
  lon: number;
  altitudeMeters: number;
  altitudeFeet: number;
  velocityMs: number;
  velocityKnots: number;
  heading: number;
  verticalRate: number;
  origin: string;
  destination: string;
  onGround: boolean;
}

// --- Satellite Data ---
export interface SatelliteData {
  name: string;
  noradId: number;
  tle1: string;
  tle2: string;
  category: 'stations' | 'active' | 'starlink' | 'gps-ops' | 'weather';
}

// --- Earthquake Data ---
export interface EarthquakeData {
  id: string;
  magnitude: number;
  depth: number;
  lat: number;
  lon: number;
  place: string;
  time: number;
  url: string;
}

// --- Ship Data ---
export interface ShipData {
  mmsi: string;
  name: string;
  imo: string;
  callSign: string;
  lat: number;
  lon: number;
  sog: number;       // Speed over ground (knots)
  cog: number;       // Course over ground (degrees)
  heading: number;
  destination: string;
  shipType: number;
  draught: number;
  eta: string;
}

// --- CCTV Camera Data ---
export interface CameraData {
  id: string;
  name: string;
  lat: number;
  lon: number;
  imageUrl: string;
  available: boolean;
  region: string;
  country: string;
  direction: string;
}

// --- Traffic Road Data ---
export interface TrafficRoad {
  id: string;
  classification: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'residential';
  geometry: [number, number][];   // [lon, lat] coordinate pairs
  length: number;                  // meters
  name: string;
}

// --- Intel Feed Event ---
export interface IntelEvent {
  id: string;
  type: 'ACFT' | 'SEIS' | 'SATS' | 'SYS' | 'CCTV' | 'AIS';
  message: string;
  timestamp: Date;
}
