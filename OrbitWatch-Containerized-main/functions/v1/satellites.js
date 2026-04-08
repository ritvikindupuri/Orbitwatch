/**
 * GET /v1/satellites
 * Cloudflare Pages Function — replaces Express relay satellite endpoint
 *
 * Query params:
 *   - limit: Max results (default 300)
 *   - geoOnly: If true, filter for GEO belt satellites (mean motion ~1.0)
 */
export async function onRequestGet(context) {
    const { request, env } = context;

    const ELASTIC_URL = env.ELASTIC_URL?.trim();
    const ELASTIC_API_KEY = env.ELASTIC_API_KEY?.trim();
    const SATELLITE_INDEX = env.SATELLITE_INDEX || 'space-track-satellites';

    if (!ELASTIC_URL || !ELASTIC_API_KEY) {
        return Response.json(
            { error: 'MISCONFIGURED', detail: 'Missing ELASTIC_URL or ELASTIC_API_KEY' },
            { status: 500 }
        );
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '300', 10);
    const geoOnly = url.searchParams.get('geoOnly') === 'true';

    const query = {
        size: limit,
        sort: [{ '@timestamp': 'desc' }],
        _source: [
            'satcat.NORAD_CAT_ID',
            'satcat.SATNAME',
            'satcat.COUNTRY',
            'satcat.OBJECT_TYPE',
            'satcat.PERIOD',
            'satcat.INCLINATION',
            'satcat.APOGEE',
            'satcat.PERIGEE',
            'tle.TLE_LINE1',
            'tle.TLE_LINE2',
            'tle.EPOCH',
            'tle.MEAN_MOTION',
            'tle.ECCENTRICITY',
            'tle.INCLINATION',
            'tle.RA_OF_ASC_NODE',
            'tle.ARG_OF_PERICENTER',
            'tle.MEAN_ANOMALY',
            'orbital.current_position',
            'orbital.altitude_km',
            'orbital.velocity_kms'
        ],
        query: {
            bool: {
                must: [
                    { exists: { field: 'tle.TLE_LINE1' } },
                    { exists: { field: 'tle.TLE_LINE2' } }
                ]
            }
        },
        collapse: { field: 'satcat.NORAD_CAT_ID' }
    };

    if (geoOnly) {
        query.query.bool.must.push(
            { range: { 'tle.MEAN_MOTION': { gte: 0.95, lte: 1.05 } } },
            { range: { 'tle.ECCENTRICITY': { lte: 0.02 } } }
        );
    }

    try {
        const esResponse = await fetch(`${ELASTIC_URL}/${SATELLITE_INDEX}/_search`, {
            method: 'POST',
            headers: {
                Authorization: `ApiKey ${ELASTIC_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        const result = await esResponse.json();

        if (!esResponse.ok) {
            return Response.json(result, { status: esResponse.status });
        }

        const satellites = result.hits.hits.map(hit => {
            const src = hit._source;
            return {
                NORAD_CAT_ID: src.satcat?.NORAD_CAT_ID,
                OBJECT_NAME: src.satcat?.SATNAME,
                OWNER: src.satcat?.COUNTRY,
                OBJECT_TYPE: src.satcat?.OBJECT_TYPE,
                TLE_LINE1: src.tle?.TLE_LINE1,
                TLE_LINE2: src.tle?.TLE_LINE2,
                EPOCH: src.tle?.EPOCH,
                MEAN_MOTION: src.tle?.MEAN_MOTION,
                ECCENTRICITY: src.tle?.ECCENTRICITY,
                INCLINATION: src.tle?.INCLINATION,
                RA_OF_ASC_NODE: src.tle?.RA_OF_ASC_NODE,
                ARG_OF_PERICENTER: src.tle?.ARG_OF_PERICENTER,
                MEAN_ANOMALY: src.tle?.MEAN_ANOMALY,
                PERIOD: src.satcat?.PERIOD,
                APOGEE: src.satcat?.APOGEE,
                PERIGEE: src.satcat?.PERIGEE,
                current_position: src.orbital?.current_position,
                altitude_km: src.orbital?.altitude_km,
                velocity_kms: src.orbital?.velocity_kms
            };
        });

        return Response.json({ count: satellites.length, satellites });
    } catch (e) {
        return Response.json(
            { error: 'SATELLITE_FETCH_FAILED', message: e.message },
            { status: 500 }
        );
    }
}
