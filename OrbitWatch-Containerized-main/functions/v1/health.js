/**
 * GET /v1/health
 * Cloudflare Pages Function — replaces Express relay health endpoint
 */
export async function onRequestGet(context) {
    const { env } = context;

    const ELASTIC_URL = env.ELASTIC_URL?.trim();
    const ELASTIC_API_KEY = env.ELASTIC_API_KEY?.trim();
    const SATELLITE_INDEX = env.SATELLITE_INDEX || 'space-track-satellites';
    const FORENSIC_INDEX = env.FORENSIC_INDEX || 'sda-intelligence-ledger';
    const INVESTIGATION_INDEX = env.INVESTIGATION_INDEX || 'orbitwatch-investigations';

    if (!ELASTIC_URL || !ELASTIC_API_KEY) {
        return Response.json(
            { status: 'MISCONFIGURED', detail: 'Missing ELASTIC_URL or ELASTIC_API_KEY environment variables' },
            { status: 500 }
        );
    }

    try {
        // Probe a specific index (requires only `read` privilege) rather than
        // the root URL (requires cluster `monitor`). This works with restricted
        // API keys that have index-level permissions only.
        const response = await fetch(`${ELASTIC_URL}/${SATELLITE_INDEX}/_count`, {
            method: 'POST',
            headers: {
                Authorization: `ApiKey ${ELASTIC_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: { match_all: {} } })
        });

        if (response.ok) {
            return Response.json({
                status: 'HEALTHY',
                provider: 'Elastic Cloud',
                satelliteIndex: SATELLITE_INDEX,
                forensicIndex: FORENSIC_INDEX,
                investigationIndex: INVESTIGATION_INDEX
            });
        } else {
            return Response.json(
                { status: 'UNAUTHORIZED', detail: 'Check ELASTIC_API_KEY' },
                { status: 502 }
            );
        }
    } catch (e) {
        return Response.json({ status: 'DOWN', message: e.message }, { status: 500 });
    }
}
