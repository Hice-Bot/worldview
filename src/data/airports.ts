/**
 * Airport data for flight route resolution.
 * Maps ICAO airport codes to coordinates and names.
 * Used for rendering origin/destination route arcs.
 * Source: OurAirports (public domain) - top 100 busiest airports worldwide.
 */

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * Major world airports indexed by both ICAO and IATA codes.
 */
export const airports: Record<string, Airport> = {};

const airportList: Airport[] = [
  // North America
  { icao: 'KATL', iata: 'ATL', name: 'Hartsfield-Jackson Atlanta Intl', lat: 33.6367, lon: -84.4281 },
  { icao: 'KDFW', iata: 'DFW', name: 'Dallas/Fort Worth Intl', lat: 32.8968, lon: -97.0380 },
  { icao: 'KDEN', iata: 'DEN', name: 'Denver Intl', lat: 39.8561, lon: -104.6737 },
  { icao: 'KORD', iata: 'ORD', name: "Chicago O'Hare Intl", lat: 41.9742, lon: -87.9073 },
  { icao: 'KLAX', iata: 'LAX', name: 'Los Angeles Intl', lat: 33.9425, lon: -118.4081 },
  { icao: 'KJFK', iata: 'JFK', name: 'John F Kennedy Intl', lat: 40.6399, lon: -73.7787 },
  { icao: 'KSFO', iata: 'SFO', name: 'San Francisco Intl', lat: 37.6213, lon: -122.3790 },
  { icao: 'KLAS', iata: 'LAS', name: 'Harry Reid Intl', lat: 36.0840, lon: -115.1537 },
  { icao: 'KMIA', iata: 'MIA', name: 'Miami Intl', lat: 25.7959, lon: -80.2870 },
  { icao: 'KSEA', iata: 'SEA', name: 'Seattle-Tacoma Intl', lat: 47.4502, lon: -122.3088 },
  { icao: 'KEWR', iata: 'EWR', name: 'Newark Liberty Intl', lat: 40.6895, lon: -74.1745 },
  { icao: 'KMCO', iata: 'MCO', name: 'Orlando Intl', lat: 28.4312, lon: -81.3081 },
  { icao: 'KPHX', iata: 'PHX', name: 'Phoenix Sky Harbor Intl', lat: 33.4373, lon: -112.0078 },
  { icao: 'KIAH', iata: 'IAH', name: 'George Bush Intercontinental', lat: 29.9844, lon: -95.3414 },
  { icao: 'KBOS', iata: 'BOS', name: 'Boston Logan Intl', lat: 42.3656, lon: -71.0096 },
  { icao: 'KMSP', iata: 'MSP', name: 'Minneapolis-Saint Paul Intl', lat: 44.8820, lon: -93.2218 },
  { icao: 'KDTW', iata: 'DTW', name: 'Detroit Metropolitan Wayne County', lat: 42.2124, lon: -83.3534 },
  { icao: 'KFLL', iata: 'FLL', name: 'Fort Lauderdale-Hollywood Intl', lat: 26.0726, lon: -80.1527 },
  { icao: 'KPHL', iata: 'PHL', name: 'Philadelphia Intl', lat: 39.8721, lon: -75.2411 },
  { icao: 'KLGA', iata: 'LGA', name: 'LaGuardia', lat: 40.7772, lon: -73.8726 },
  { icao: 'KBWI', iata: 'BWI', name: 'Baltimore/Washington Intl', lat: 39.1754, lon: -76.6683 },
  { icao: 'KSLC', iata: 'SLC', name: 'Salt Lake City Intl', lat: 40.7884, lon: -111.9778 },
  { icao: 'KIAD', iata: 'IAD', name: 'Washington Dulles Intl', lat: 38.9445, lon: -77.4558 },
  { icao: 'KDCA', iata: 'DCA', name: 'Ronald Reagan Washington Natl', lat: 38.8512, lon: -77.0402 },
  { icao: 'KSNA', iata: 'SNA', name: 'John Wayne Airport', lat: 33.6757, lon: -117.8682 },
  { icao: 'CYYZ', iata: 'YYZ', name: 'Toronto Pearson Intl', lat: 43.6772, lon: -79.6306 },
  { icao: 'CYVR', iata: 'YVR', name: 'Vancouver Intl', lat: 49.1947, lon: -123.1839 },
  { icao: 'CYUL', iata: 'YUL', name: 'Montreal-Trudeau Intl', lat: 45.4706, lon: -73.7408 },
  { icao: 'MMMX', iata: 'MEX', name: 'Mexico City Intl', lat: 19.4363, lon: -99.0721 },
  { icao: 'MMUN', iata: 'CUN', name: 'Cancún Intl', lat: 21.0365, lon: -86.8771 },

  // Europe
  { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow', lat: 51.4700, lon: -0.4543 },
  { icao: 'LFPG', iata: 'CDG', name: 'Paris Charles de Gaulle', lat: 49.0097, lon: 2.5479 },
  { icao: 'EHAM', iata: 'AMS', name: 'Amsterdam Schiphol', lat: 52.3086, lon: 4.7639 },
  { icao: 'EDDF', iata: 'FRA', name: 'Frankfurt am Main', lat: 50.0333, lon: 8.5706 },
  { icao: 'LEMD', iata: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', lat: 40.4719, lon: -3.5626 },
  { icao: 'LEBL', iata: 'BCN', name: 'Barcelona-El Prat', lat: 41.2971, lon: 2.0785 },
  { icao: 'EDDM', iata: 'MUC', name: 'Munich', lat: 48.3538, lon: 11.7861 },
  { icao: 'EGKK', iata: 'LGW', name: 'London Gatwick', lat: 51.1481, lon: -0.1903 },
  { icao: 'LIRF', iata: 'FCO', name: 'Rome Fiumicino', lat: 41.8003, lon: 12.2389 },
  { icao: 'EIDW', iata: 'DUB', name: 'Dublin', lat: 53.4213, lon: -6.2701 },
  { icao: 'LSZH', iata: 'ZRH', name: 'Zürich', lat: 47.4647, lon: 8.5492 },
  { icao: 'EKCH', iata: 'CPH', name: 'Copenhagen Kastrup', lat: 55.6181, lon: 12.6560 },
  { icao: 'ENGM', iata: 'OSL', name: 'Oslo Gardermoen', lat: 60.1939, lon: 11.1004 },
  { icao: 'ESSA', iata: 'ARN', name: 'Stockholm Arlanda', lat: 59.6519, lon: 17.9186 },
  { icao: 'LOWW', iata: 'VIE', name: 'Vienna Intl', lat: 48.1103, lon: 16.5697 },
  { icao: 'EBBR', iata: 'BRU', name: 'Brussels', lat: 50.9014, lon: 4.4844 },
  { icao: 'LPPT', iata: 'LIS', name: 'Lisbon Humberto Delgado', lat: 38.7756, lon: -9.1354 },
  { icao: 'EPWA', iata: 'WAW', name: 'Warsaw Chopin', lat: 52.1657, lon: 20.9671 },
  { icao: 'LGAV', iata: 'ATH', name: 'Athens Eleftherios Venizelos', lat: 37.9364, lon: 23.9445 },
  { icao: 'LTFM', iata: 'IST', name: 'Istanbul', lat: 41.2753, lon: 28.7519 },
  { icao: 'UUEE', iata: 'SVO', name: 'Moscow Sheremetyevo', lat: 55.9726, lon: 37.4146 },
  { icao: 'EGSS', iata: 'STN', name: 'London Stansted', lat: 51.8850, lon: 0.2350 },

  // Asia-Pacific
  { icao: 'OMDB', iata: 'DXB', name: 'Dubai Intl', lat: 25.2528, lon: 55.3644 },
  { icao: 'VHHH', iata: 'HKG', name: 'Hong Kong Intl', lat: 22.3080, lon: 113.9185 },
  { icao: 'WSSS', iata: 'SIN', name: 'Singapore Changi', lat: 1.3502, lon: 103.9944 },
  { icao: 'RJTT', iata: 'HND', name: 'Tokyo Haneda', lat: 35.5494, lon: 139.7798 },
  { icao: 'RJAA', iata: 'NRT', name: 'Tokyo Narita', lat: 35.7647, lon: 140.3864 },
  { icao: 'RKSI', iata: 'ICN', name: 'Incheon Intl', lat: 37.4602, lon: 126.4407 },
  { icao: 'ZBAD', iata: 'PKX', name: 'Beijing Daxing Intl', lat: 39.5098, lon: 116.4105 },
  { icao: 'ZSPD', iata: 'PVG', name: 'Shanghai Pudong Intl', lat: 31.1434, lon: 121.8052 },
  { icao: 'ZGGG', iata: 'CAN', name: 'Guangzhou Baiyun Intl', lat: 23.3924, lon: 113.2988 },
  { icao: 'VTBS', iata: 'BKK', name: 'Suvarnabhumi', lat: 13.6900, lon: 100.7501 },
  { icao: 'WMKK', iata: 'KUL', name: 'Kuala Lumpur Intl', lat: 2.7456, lon: 101.7099 },
  { icao: 'VIDP', iata: 'DEL', name: 'Indira Gandhi Intl', lat: 28.5562, lon: 77.1000 },
  { icao: 'VABB', iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj Intl', lat: 19.0887, lon: 72.8679 },
  { icao: 'VOBL', iata: 'BLR', name: 'Kempegowda Intl', lat: 13.1979, lon: 77.7063 },
  { icao: 'RPLL', iata: 'MNL', name: 'Ninoy Aquino Intl', lat: 14.5086, lon: 121.0198 },
  { icao: 'WIII', iata: 'CGK', name: 'Soekarno-Hatta Intl', lat: -6.1256, lon: 106.6559 },
  { icao: 'VDPP', iata: 'PNH', name: 'Phnom Penh Intl', lat: 11.5466, lon: 104.8441 },
  { icao: 'RCTP', iata: 'TPE', name: 'Taiwan Taoyuan Intl', lat: 25.0777, lon: 121.2325 },
  { icao: 'OEJN', iata: 'JED', name: 'King Abdulaziz Intl', lat: 21.6796, lon: 39.1565 },
  { icao: 'OTHH', iata: 'DOH', name: 'Hamad Intl', lat: 25.2731, lon: 51.6081 },

  // Oceania
  { icao: 'YSSY', iata: 'SYD', name: 'Sydney Kingsford Smith', lat: -33.9461, lon: 151.1772 },
  { icao: 'YMML', iata: 'MEL', name: 'Melbourne Tullamarine', lat: -37.6733, lon: 144.8433 },
  { icao: 'YBBN', iata: 'BNE', name: 'Brisbane', lat: -27.3842, lon: 153.1175 },
  { icao: 'YPPH', iata: 'PER', name: 'Perth', lat: -31.9403, lon: 115.9672 },
  { icao: 'NZAA', iata: 'AKL', name: 'Auckland', lat: -37.0082, lon: 174.7850 },

  // South America
  { icao: 'SBGR', iata: 'GRU', name: 'São Paulo-Guarulhos Intl', lat: -23.4356, lon: -46.4731 },
  { icao: 'SCEL', iata: 'SCL', name: 'Santiago Intl', lat: -33.3930, lon: -70.7858 },
  { icao: 'SKBO', iata: 'BOG', name: 'El Dorado Intl', lat: 4.7016, lon: -74.1469 },
  { icao: 'SAEZ', iata: 'EZE', name: 'Ministro Pistarini Intl', lat: -34.8222, lon: -58.5358 },
  { icao: 'SPJC', iata: 'LIM', name: 'Jorge Chávez Intl', lat: -12.0219, lon: -77.1143 },

  // Africa
  { icao: 'FAOR', iata: 'JNB', name: 'O.R. Tambo Intl', lat: -26.1392, lon: 28.2460 },
  { icao: 'HECA', iata: 'CAI', name: 'Cairo Intl', lat: 30.1219, lon: 31.4056 },
  { icao: 'GMMN', iata: 'CMN', name: 'Mohammed V Intl', lat: 33.3675, lon: -7.5900 },
  { icao: 'DNMM', iata: 'LOS', name: 'Murtala Muhammed Intl', lat: 6.5774, lon: 3.3212 },
  { icao: 'HKJK', iata: 'NBO', name: 'Jomo Kenyatta Intl', lat: -1.3192, lon: 36.9278 },
  { icao: 'FACT', iata: 'CPT', name: 'Cape Town Intl', lat: -33.9648, lon: 18.6017 },
  { icao: 'HAAB', iata: 'ADD', name: 'Addis Ababa Bole Intl', lat: 8.9779, lon: 38.7993 },
];

// Index airports by both ICAO and IATA codes for fast lookup
for (const airport of airportList) {
  airports[airport.icao] = airport;
  airports[airport.iata] = airport;
}

/**
 * Look up airport by ICAO or IATA code
 */
export function findAirport(code: string): Airport | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase().trim();
  return airports[upper];
}
