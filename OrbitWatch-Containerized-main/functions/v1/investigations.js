/**
 * GET /v1/investigations  — list all investigations
 * POST /v1/investigations — create/upsert by UUID + mirror to Kibana Cases
 * Cloudflare Pages Function
 */

// ── Kibana Cases helpers ─────────────────────────────────────────────────────

function mapStatusToKibana(status) {
    switch (status) {
        case 'Active Forensics':
        case 'Hostile Attribution': return 'in-progress';
        case 'Closed/Reported':    return 'closed';
        default:                   return 'open';
    }
}

async function createKibanaCase(kibanaUrl, authHeader, title, description, tags) {
    const resp = await fetch(`${kibanaUrl}/api/cases`, {
        method: 'POST',
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            'kbn-xsrf': 'true'
        },
        body: JSON.stringify({
            title,
            description,
            tags,
            owner: 'securitySolution',
            settings: { syncAlerts: false },
            connector: { id: 'none', name: 'none', type: '.none', fields: null }
        })
    });
    return resp.json();
}

async function addKibanaComment(kibanaUrl, authHeader, caseId, comment) {
    const resp = await fetch(`${kibanaUrl}/api/cases/${caseId}/comments`, {
        method: 'POST',
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            'kbn-xsrf': 'true'
        },
        body: JSON.stringify({ type: 'user', comment, owner: 'securitySolution' })
    });
    return resp.json();
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function onRequestGet(context) {
    const { env } = context;
    const ELASTIC_URL = env.ELASTIC_URL?.trim();
    const ELASTIC_API_KEY = env.ELASTIC_API_KEY?.trim();
    const INVESTIGATION_INDEX = env.INVESTIGATION_INDEX || 'orbitwatch-investigations';

    if (!ELASTIC_URL || !ELASTIC_API_KEY) {
        return Response.json(
            { error: 'MISCONFIGURED', detail: 'Missing ELASTIC_URL or ELASTIC_API_KEY' },
            { status: 500 }
        );
    }

    try {
        const esResponse = await fetch(`${ELASTIC_URL}/${INVESTIGATION_INDEX}/_search`, {
            method: 'POST',
            headers: {
                Authorization: `ApiKey ${ELASTIC_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                size: 200,
                sort: [{ dateOpened: 'desc' }],
                query: { match_all: {} }
            })
        });

        const result = await esResponse.json();

        if (!esResponse.ok) {
            return Response.json(result, { status: esResponse.status });
        }

        return Response.json(result.hits.hits.map(h => h._source));
    } catch (e) {
        return Response.json(
            { error: 'INVESTIGATION_FETCH_FAILED', message: e.message },
            { status: 500 }
        );
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const ELASTIC_URL = env.ELASTIC_URL?.trim();
    const ELASTIC_API_KEY = env.ELASTIC_API_KEY?.trim();
    const KIBANA_URL = env.KIBANA_URL;
    const INVESTIGATION_INDEX = env.INVESTIGATION_INDEX || 'orbitwatch-investigations';
    const AUTH_HEADER = `ApiKey ${ELASTIC_API_KEY}`;

    if (!ELASTIC_URL || !ELASTIC_API_KEY) {
        return Response.json(
            { error: 'MISCONFIGURED', detail: 'Missing ELASTIC_URL or ELASTIC_API_KEY' },
            { status: 500 }
        );
    }

    let investigation;
    try {
        investigation = await request.json();
    } catch {
        return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    const { id } = investigation;
    let kibanaCaseId = null;
    let kibanaCaseUrl = null;

    // Mirror to Kibana Cases (fire-and-forget)
    if (KIBANA_URL) {
        try {
            const kibanaCase = await createKibanaCase(
                KIBANA_URL,
                AUTH_HEADER,
                investigation.title,
                `NORAD: ${investigation.satelliteId} | ${investigation.description}`,
                ['orbitwatch', investigation.targetName, `NORAD-${investigation.satelliteId}`]
            );
            kibanaCaseId = kibanaCase.id;
            kibanaCaseUrl = `${KIBANA_URL}/app/security/cases/${kibanaCaseId}`;

            if (investigation.notes?.[0]) {
                await addKibanaComment(KIBANA_URL, AUTH_HEADER, kibanaCaseId, investigation.notes[0].content);
            }
        } catch (e) {
            console.error('Kibana Case creation failed (non-fatal):', e.message);
        }
    }

    try {
        const docToSave = { ...investigation, kibanaCaseId, kibanaCaseUrl };
        const esResponse = await fetch(`${ELASTIC_URL}/${INVESTIGATION_INDEX}/_doc/${id}`, {
            method: 'PUT',
            headers: {
                Authorization: AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(docToSave)
        });

        const result = await esResponse.json();

        if (esResponse.ok) {
            return Response.json({ status: 'COMMITTED', id, kibanaCaseId, kibanaCaseUrl });
        } else {
            return Response.json(result, { status: esResponse.status });
        }
    } catch (e) {
        return Response.json(
            { error: 'INVESTIGATION_UPSERT_FAILED', message: e.message },
            { status: 500 }
        );
    }
}
