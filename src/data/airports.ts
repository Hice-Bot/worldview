/**
 * Airport data for flight route resolution.
 * Maps ICAO airport codes to coordinates and names.
 * Used for rendering origin/destination route arcs.
 */

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  lat: number;
  lon: number;
}

// TODO: Populate with major world airports
// This will be populated by coding agents with real airport data
export const airports: Record<string, Airport> = {};

/**
 * Look up airport by ICAO or IATA code
 */
export function findAirport(code: string): Airport | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase().trim();
  return airports[upper];
}
