/**
 * POST /v1/mission-relay
 * Cloudflare Pages Function — replaces Express relay forensic write endpoint
 * Writes forensic analysis results to the sda-intelligence-ledger index
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    const ELASTIC_URL = env.ELASTIC_URL?.trim();
    const ELASTIC_API_KEY = env.ELASTIC_API_KEY?.trim();
    const FORENSIC_INDEX = env.FORENSIC_INDEX || 'sda-intelligence-ledger';

    if (!ELASTIC_URL || !ELASTIC_API_KEY) {
        return Response.json(
            { error: 'MISCONFIGURED', detail: 'Missing ELASTIC_URL or ELASTIC_API_KEY' },
            { status: 500 }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    try {
        const esResponse = await fetch(`${ELASTIC_URL}/${FORENSIC_INDEX}/_doc`, {
            method: 'POST',
            headers: {
                Authorization: `ApiKey ${ELASTIC_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...body,
                processedAt: new Date().toISOString()
            })
        });

        const result = await esResponse.json();

        if (esResponse.ok) {
            return Response.json({ status: 'COMMITTED', id: result._id });
        } else {
            return Response.json(result, { status: esResponse.status });
        }
    } catch (e) {
        return Response.json(
            { error: 'INTELLIGENCE_RELAY_INTERRUPTED', message: e.message },
            { status: 500 }
        );
    }
}
