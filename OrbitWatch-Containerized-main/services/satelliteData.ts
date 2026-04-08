import { RealSatellite } from '../types';

/**
 * Satellite Data Service
 *
 * Fetches satellite TLE data from Elasticsearch via the relay server.
 * Data is sourced from the space-track-satellites index populated by
 * the space-track-poller service.
 */

// Relay API endpoint (proxied by nginx in Docker, or vite proxy in dev)
const RELAY_URL = '/v1/satellites';

// Fallback TLE data for offline/demo mode
const FALLBACK_TLE_SNAPSHOT = `
0 INTELSAT 901
1 26824U 01024A   25023.48672104  .00000147  00000-0  00000-0 0  9995
2 26824   0.0269 272.6897 0003016 287.1600 228.4805  1.00270590 84964
0 GOES 13
1 29155U 06018A   25023.55612311 -.00000206  00000-0  00000-0 0  9996
2 29155   3.8820  68.8264 0004654 207.3972 198.2602  1.00278635 68377
0 GALAXY 15
1 28884U 05041A   25023.45678912  .00000088  00000-0  00000-0 0  9992
2 28884   0.0450 250.1234 0002345 120.5678 200.1234  1.00271234 76543
0 EUTELSAT 10A
1 34710U 09016A   25023.12345678  .00000123  00000-0  00000-0 0  9991
2 34710   0.0345 123.4567 0001234  45.6789 300.1234  1.00272233 54321
0 SES-1
1 36516U 10016A   25023.56789123  .00000111  00000-0  00000-0 0  9994
2 36516   0.0123 234.5678 0002345  90.1234 250.6789  1.00273344 12345
0 TDRS 10
1 27566U 02055A   25023.87654321  .00000100  00000-0  00000-0 0  9995
2 27566   3.4567 300.1234 0003456 180.1234 100.2345  1.00274455 67890
0 INMARSAT 4-F3
1 33278U 08039A   25023.23456789  .00000099  00000-0  00000-0 0  9993
2 33278   2.3456 150.1234 0004567  60.1234 200.5678  1.00275566 43210
0 SKYNET 5C
1 33055U 08030A   25023.34567890  .00000088  00000-0  00000-0 0  9992
2 33055   1.2345 200.2345 0005678 120.3456 240.6789  1.00276677 98765
0 SHIJIAN 21
1 49330U 21094A   25023.67890123  .00000188  00000-0  00000-0 0  9999
2 49330   8.2345 190.5678 0009012 220.6789  40.9012  0.98391122 23456
0 COSMOS 2542
1 44797U 19079A   25023.78901234  .00000222  00000-0  00000-0 0  9997
2 44797   3.3456  60.6789 0001234 320.7890 140.0123  1.00292233 34567
0 ANGOSAT 2
1 54033U 22132A   25023.89012345  .00000166  00000-0  00000-0 0  9996
2 54033   0.0123 130.7890 0002345  60.8901 240.1234  1.00293344 45678
0 OLYMP-K (LUCH)
1 40258U 14058A   25023.56789012  .00000199  00000-0  00000-0 0  9990
2 40258   4.1234  10.4567 0008901 120.5678 300.8901  0.99289911 12345
`;

/**
 * Infers the Space-Track country code from a satellite name.
 * Matches the country codes used in the SATCAT (same values the relay returns).
 */
function inferOwner(name: string): string {
    const n = name.toUpperCase();
    if (n.includes('INTELSAT'))                     return 'ITSO';
    if (n.includes('INMARSAT'))                     return 'IMRL';
    if (n.includes('SES'))                          return 'LUX';
    if (n.includes('EUTELSAT'))                     return 'FR';
    if (n.includes('SKYNET'))                       return 'UK';
    if (n.includes('SHIJIAN') || n.includes('CZ-')) return 'PRC';
    if (n.includes('COSMOS') || n.includes('LUCH') || n.includes('OLYMP')) return 'CIS';
    if (n.includes('ANGOSAT'))                      return 'ANGOLA';
    // Default US government / commercial (GOES, TDRS, GALAXY, etc.)
    return 'US';
}

function parseThreeLineElements(rawData: string): RealSatellite[] {
    const lines = rawData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const satellites: RealSatellite[] = [];

    for (let i = 0; i < lines.length; i += 3) {
        if (i + 2 < lines.length) {
            const nameLine = lines[i].substring(2).trim();
            const line1 = lines[i + 1];
            const line2 = lines[i + 2];

            if (line1.startsWith('1') && line2.startsWith('2')) {
                const noradId = parseInt(line1.substring(2, 7), 10);
                satellites.push({
                    OBJECT_NAME: nameLine,
                    NORAD_CAT_ID: noradId,
                    TLE_LINE1: line1,
                    TLE_LINE2: line2,
                    OWNER: inferOwner(nameLine),
                    ORGANIZATION: inferOwner(nameLine),
                    OBJECT_TYPE: nameLine.includes('DEB') ? 'DEBRIS' : 'PAYLOAD',
                    LAUNCH_DATE: ''
                });
            }
        }
    }
    return satellites;
}

/**
 * Fetch satellite catalog from Elasticsearch via relay server
 *
 * @param geoOnly - If true, filter for GEO belt satellites only
 * @param limit - Maximum number of satellites to fetch
 */
export async function fetchSatelliteCatalog(geoOnly: boolean = true, limit: number = 300): Promise<RealSatellite[]> {
    try {
        const params = new URLSearchParams({
            limit: limit.toString(),
            geoOnly: geoOnly.toString()
        });

        const response = await fetch(`${RELAY_URL}?${params}`);

        if (!response.ok) {
            throw new Error(`Relay returned ${response.status}`);
        }

        const data = await response.json();

        if (!data.satellites || data.satellites.length === 0) {
            throw new Error("EMPTY_CATALOG");
        }

        // Transform Elasticsearch data to RealSatellite format
        return data.satellites.map((sat: any) => ({
            OBJECT_NAME: sat.OBJECT_NAME || 'Unknown',
            NORAD_CAT_ID: parseInt(sat.NORAD_CAT_ID) || 0,
            TLE_LINE1: sat.TLE_LINE1 || '',
            TLE_LINE2: sat.TLE_LINE2 || '',
            OWNER: sat.OWNER || 'Unknown',
            ORGANIZATION: sat.ORGANIZATION || 'Unknown',
            OBJECT_TYPE: sat.OBJECT_TYPE || 'PAYLOAD',
            LAUNCH_DATE: sat.LAUNCH_DATE || '',
            // Additional orbital data from Elasticsearch
            MEAN_MOTION: sat.MEAN_MOTION,
            ECCENTRICITY: sat.ECCENTRICITY,
            INCLINATION: sat.INCLINATION,
            PERIOD: sat.PERIOD,
            APOGEE: sat.APOGEE,
            PERIGEE: sat.PERIGEE
        }));

    } catch (error) {
        console.warn("[SatelliteData] Relay unavailable, using fallback data:", error);
        // Return fallback data for demo/offline mode
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(parseThreeLineElements(FALLBACK_TLE_SNAPSHOT));
            }, 500);
        });
    }
}

export type RelayHealthStatus = 'healthy' | 'degraded' | 'offline';

/**
 * Check relay + Elasticsearch health.
 * Returns 'healthy' (ES reachable + auth ok), 'degraded' (auth issue), or 'offline' (unreachable).
 */
export async function checkRelayHealth(): Promise<RelayHealthStatus> {
    try {
        const response = await fetch('/v1/health');
        if (response.ok) return 'healthy';
        if (response.status === 502) return 'degraded'; // UNAUTHORIZED from ES
        return 'offline';
    } catch {
        return 'offline';
    }
}

// Legacy export for backward compatibility
export const fetchSpaceTrackCatalog = fetchSatelliteCatalog;
