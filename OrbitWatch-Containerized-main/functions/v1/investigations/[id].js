/**
 * PUT /v1/investigations/:id — partial update via ES _update API
 * Also mirrors note/status changes to Kibana Cases if kibanaCaseId is present.
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

async function updateKibanaCaseStatus(kibanaUrl, authHeader, caseId, ourStatus) {
    const getResp = await fetch(`${kibanaUrl}/api/cases/${caseId}`, {
        headers: { Authorization: authHeader }
    });
    const caseData = await getResp.json();
    const patchResp = await fetch(`${kibanaUrl}/api/cases`, {
        method: 'PATCH',
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            'kbn-xsrf': 'true'
        },
        body: JSON.stringify({
            cases: [{ id: caseId, status: mapStatusToKibana(ourStatus), version: caseData.version }]
        })
    });
    return patchResp.json();
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function onRequestPut(context) {
    const { request, env, params } = context;
    const id = params.id;
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

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'INVALID_JSON' }, { status: 400 });
    }

    // Strip relay-only fields before writing to ES
    const { kibanaCaseId, newComment, ...esFields } = body;

    try {
        const esResponse = await fetch(`${ELASTIC_URL}/${INVESTIGATION_INDEX}/_update/${id}`, {
            method: 'POST',
            headers: {
                Authorization: AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ doc: esFields })
        });

        const result = await esResponse.json();

        if (!esResponse.ok) {
            return Response.json(result, { status: esResponse.status });
        }

        // Mirror to Kibana Cases (non-fatal)
        if (kibanaCaseId && KIBANA_URL) {
            if (newComment) {
                addKibanaComment(KIBANA_URL, AUTH_HEADER, kibanaCaseId, newComment)
                    .catch(e => console.error('Kibana comment failed (non-fatal):', e.message));
            }
            if (esFields.status) {
                updateKibanaCaseStatus(KIBANA_URL, AUTH_HEADER, kibanaCaseId, esFields.status)
                    .catch(e => console.error('Kibana status update failed (non-fatal):', e.message));
            }
        }

        return Response.json({ status: 'UPDATED' });
    } catch (e) {
        return Response.json(
            { error: 'INVESTIGATION_UPDATE_FAILED', message: e.message },
            { status: 500 }
        );
    }
}
