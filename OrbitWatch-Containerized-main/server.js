/**
 * ORBITWATCH MISSION INTELLIGENCE MIDDLEWARE
 *
 * This server acts as the bridge between the OrbitWatch frontend and Elasticsearch:
 * - READS satellite TLE data from the space-track-satellites index
 * - WRITES forensic analysis results to the sda-intelligence-ledger index
 *
 * SECURITY: Credentials are loaded from Docker Secrets or environment variables.
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// =========================================================================
// SECURE CREDENTIAL LOADING
// =========================================================================

/**
 * Reads a secret from Docker Secrets path or falls back to environment variable.
 */
function loadSecret(secretName, envFallback) {
    const secretPath = path.join('/run/secrets', secretName);

    try {
        if (fs.existsSync(secretPath)) {
            const value = fs.readFileSync(secretPath, 'utf8').trim();
            console.log(`[Security] Loaded ${secretName} from Docker Secrets`);
            return value;
        }
    } catch (err) {
        // Fall through to environment variable
    }

    const envValue = process.env[envFallback];
    if (envValue) {
        console.log(`[Security] Loaded ${secretName} from environment variable`);
        return envValue.trim();
    }

    return undefined;
}

// Load credentials
const ELASTIC_URL = loadSecret('elastic_url', 'ELASTIC_URL');
const ELASTIC_API_KEY = loadSecret('elastic_api_key', 'ELASTIC_API_KEY');
const KIBANA_URL = loadSecret('kibana_url', 'KIBANA_URL');

// Index names
const SATELLITE_INDEX = process.env.SATELLITE_INDEX || 'space-track-satellites';
const FORENSIC_INDEX = process.env.FORENSIC_INDEX || 'sda-intelligence-ledger';
const INVESTIGATION_INDEX = process.env.INVESTIGATION_INDEX || 'orbitwatch-investigations';

// Validate required credentials
if (!ELASTIC_URL || !ELASTIC_API_KEY) {
    console.error(`
    ================================================
    CRITICAL: MISSING ELASTICSEARCH CREDENTIALS
    ================================================
    Please provide credentials via Docker Secrets or environment variables:

    Docker Secrets (production):
      - /run/secrets/elastic_url
      - /run/secrets/elastic_api_key

    Environment Variables (development):
      - ELASTIC_URL
      - ELASTIC_API_KEY

    See README.md for setup instructions.
    ================================================
    `);
    process.exit(1);
}

const AUTH_HEADER = "ApiKey " + ELASTIC_API_KEY;

// =========================================================================
// KIBANA CASES HELPERS
// =========================================================================

function mapStatusToKibana(status) {
    switch (status) {
        case 'Active Forensics':
        case 'Hostile Attribution': return 'in-progress';
        case 'Closed/Reported':    return 'closed';
        default:                   return 'open';
    }
}

async function createKibanaCase(title, description, tags) {
    const resp = await fetch(`${KIBANA_URL}/api/cases`, {
        method: 'POST',
        headers: {
            'Authorization': AUTH_HEADER,
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

async function addKibanaComment(caseId, comment) {
    const resp = await fetch(`${KIBANA_URL}/api/cases/${caseId}/comments`, {
        method: 'POST',
        headers: {
            'Authorization': AUTH_HEADER,
            'Content-Type': 'application/json',
            'kbn-xsrf': 'true'
        },
        body: JSON.stringify({ type: 'user', comment, owner: 'securitySolution' })
    });
    return resp.json();
}

async function updateKibanaCaseStatus(caseId, ourStatus) {
    const getResp = await fetch(`${KIBANA_URL}/api/cases/${caseId}`, {
        headers: { 'Authorization': AUTH_HEADER }
    });
    const caseData = await getResp.json();
    const patchResp = await fetch(`${KIBANA_URL}/api/cases`, {
        method: 'PATCH',
        headers: {
            'Authorization': AUTH_HEADER,
            'Content-Type': 'application/json',
            'kbn-xsrf': 'true'
        },
        body: JSON.stringify({
            cases: [{ id: caseId, status: mapStatusToKibana(ourStatus), version: caseData.version }]
        })
    });
    return patchResp.json();
}

// =========================================================================
// API ENDPOINTS
// =========================================================================

/**
 * Health Check
 */
app.get('/v1/health', async (req, res) => {
    console.log("[Relay] Performing health check...");
    try {
        // Probe a specific index (requires only `read` privilege) rather than
        // the root URL (requires cluster `monitor`). This works with restricted
        // API keys that have index-level permissions only.
        const response = await fetch(`${ELASTIC_URL}/${SATELLITE_INDEX}/_count`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: { match_all: {} } })
        });

        if (response.ok) {
            console.log("[Relay] Elasticsearch connection verified.");
            res.status(200).json({
                status: 'HEALTHY',
                provider: 'Elastic Cloud',
                satelliteIndex: SATELLITE_INDEX,
                forensicIndex: FORENSIC_INDEX
            });
        } else {
            console.error("[Relay] Elasticsearch auth failed.");
            res.status(502).json({ status: 'UNAUTHORIZED', detail: 'Check API key' });
        }
    } catch (e) {
        console.error("[Relay] Elasticsearch unreachable:", e.message);
        res.status(500).json({ status: 'DOWN', message: e.message });
    }
});

/**
 * GET Satellite Catalog from Elasticsearch
 * Reads TLE data from the space-track-satellites index
 *
 * Query params:
 *   - limit: Max results (default 300)
 *   - geoOnly: If true, filter for GEO belt satellites (mean motion ~1.0)
 */
app.get('/v1/satellites', async (req, res) => {
    const limit = parseInt(req.query.limit) || 300;
    const geoOnly = req.query.geoOnly === 'true';

    console.log(`[Relay] Fetching satellite catalog (limit=${limit}, geoOnly=${geoOnly})`);

    try {
        // Build Elasticsearch query
        const query = {
            size: limit,
            sort: [{ "@timestamp": "desc" }],
            _source: [
                "satcat.NORAD_CAT_ID",
                "satcat.SATNAME",
                "satcat.COUNTRY",
                "satcat.OBJECT_TYPE",
                "satcat.PERIOD",
                "satcat.INCLINATION",
                "satcat.APOGEE",
                "satcat.PERIGEE",
                "tle.TLE_LINE1",
                "tle.TLE_LINE2",
                "tle.EPOCH",
                "tle.MEAN_MOTION",
                "tle.ECCENTRICITY",
                "tle.INCLINATION",
                "tle.RA_OF_ASC_NODE",
                "tle.ARG_OF_PERICENTER",
                "tle.MEAN_ANOMALY",
                "orbital.current_position",
                "orbital.altitude_km",
                "orbital.velocity_kms"
            ],
            query: {
                bool: {
                    must: [
                        { exists: { field: "tle.TLE_LINE1" } },
                        { exists: { field: "tle.TLE_LINE2" } }
                    ]
                }
            }
        };

        // Filter for GEO belt if requested (mean motion 0.95-1.05 rev/day)
        if (geoOnly) {
            query.query.bool.must.push({
                range: {
                    "tle.MEAN_MOTION": { gte: 0.95, lte: 1.05 }
                }
            });
            query.query.bool.must.push({
                range: {
                    "tle.ECCENTRICITY": { lte: 0.02 }
                }
            });
        }

        // Collapse to get latest record per satellite
        query.collapse = {
            field: "satcat.NORAD_CAT_ID"
        };

        const esTarget = `${ELASTIC_URL}/${SATELLITE_INDEX}/_search`;
        const response = await fetch(esTarget, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(query)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("[Relay] Elasticsearch query failed:", result);
            return res.status(response.status).json(result);
        }

        // Transform to OrbitWatch format
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
                // Pre-calculated orbital data if available
                current_position: src.orbital?.current_position,
                altitude_km: src.orbital?.altitude_km,
                velocity_kms: src.orbital?.velocity_kms
            };
        });

        console.log(`[Relay] Returning ${satellites.length} satellites`);
        res.status(200).json({
            count: satellites.length,
            satellites: satellites
        });

    } catch (error) {
        console.error("[Relay] Satellite fetch error:", error.message);
        res.status(500).json({ error: "SATELLITE_FETCH_FAILED", message: error.message });
    }
});

/**
 * POST Forensic Evidence to Elasticsearch
 * Writes analysis results to the sda-intelligence-ledger index
 */
app.post('/v1/mission-relay', async (req, res) => {
    console.log(`[Relay] Inbound Package: ${req.body.type} from ${req.body.missionId}`);

    try {
        const esTarget = `${ELASTIC_URL}/${FORENSIC_INDEX}/_doc`;

        const response = await fetch(esTarget, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...req.body,
                processedAt: new Date().toISOString()
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log(`[Relay] COMMITTED TO LEDGER: Doc ID ${result._id}`);
            res.status(200).json({ status: 'COMMITTED', id: result._id });
        } else {
            console.error(`[Relay] Rejection by Elastic:`, result);
            res.status(response.status).json(result);
        }
    } catch (error) {
        console.error(`[Relay] Critical Pipe Failure:`, error.message);
        res.status(500).json({ error: "INTELLIGENCE_RELAY_INTERRUPTED", message: error.message });
    }
});

/**
 * GET Investigations from Elasticsearch
 */
app.get('/v1/investigations', async (req, res) => {
    console.log('[Relay] Fetching investigations...');
    try {
        const esTarget = `${ELASTIC_URL}/${INVESTIGATION_INDEX}/_search`;
        const response = await fetch(esTarget, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                size: 200,
                sort: [{ dateOpened: 'desc' }],
                query: { match_all: {} }
            })
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('[Relay] Investigation fetch failed:', result);
            return res.status(response.status).json(result);
        }
        const investigations = result.hits.hits.map(h => h._source);
        console.log(`[Relay] Returning ${investigations.length} investigations`);
        res.status(200).json(investigations);
    } catch (error) {
        console.error('[Relay] Investigation fetch error:', error.message);
        res.status(500).json({ error: 'INVESTIGATION_FETCH_FAILED', message: error.message });
    }
});

/**
 * POST (upsert) Investigation to Elasticsearch using UUID as doc ID.
 * Also mirrors to Kibana Security Cases if KIBANA_URL is configured.
 */
app.post('/v1/investigations', async (req, res) => {
    const investigation = req.body;
    const { id } = investigation;
    console.log(`[Relay] Upserting investigation ${id}`);

    let kibanaCaseId = null;
    let kibanaCaseUrl = null;

    // Mirror to Kibana Cases (fire-and-forget — don't let Kibana failure block ES write)
    if (KIBANA_URL) {
        try {
            const kibanaCase = await createKibanaCase(
                investigation.title,
                `NORAD: ${investigation.satelliteId} | ${investigation.description}`,
                ['orbitwatch', investigation.targetName, `NORAD-${investigation.satelliteId}`]
            );
            kibanaCaseId = kibanaCase.id;
            kibanaCaseUrl = `${KIBANA_URL}/app/security/cases/${kibanaCaseId}`;
            console.log(`[Relay] Kibana Case created: ${kibanaCaseId}`);

            // Post the forensic report as the first comment
            if (investigation.notes?.[0]) {
                await addKibanaComment(kibanaCaseId, investigation.notes[0].content);
            }
        } catch (e) {
            console.error('[Relay] Kibana Case creation failed (non-fatal):', e.message);
        }
    }

    try {
        const docToSave = { ...investigation, kibanaCaseId, kibanaCaseUrl };
        const esTarget = `${ELASTIC_URL}/${INVESTIGATION_INDEX}/_doc/${id}`;
        const response = await fetch(esTarget, {
            method: 'PUT',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(docToSave)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('[Relay] Investigation upsert failed:', result);
            return res.status(response.status).json(result);
        }
        console.log(`[Relay] COMMITTED investigation: ${id}`);
        res.status(200).json({ status: 'COMMITTED', id, kibanaCaseId, kibanaCaseUrl });
    } catch (error) {
        console.error('[Relay] Investigation upsert error:', error.message);
        res.status(500).json({ error: 'INVESTIGATION_UPSERT_FAILED', message: error.message });
    }
});

/**
 * PUT (partial update) Investigation in Elasticsearch.
 * Strips relay-only fields before writing to ES, then mirrors to Kibana Cases.
 */
app.put('/v1/investigations/:id', async (req, res) => {
    const { id } = req.params;
    const { kibanaCaseId, newComment, ...esFields } = req.body;
    console.log(`[Relay] Updating investigation ${id}`);
    try {
        const esTarget = `${ELASTIC_URL}/${INVESTIGATION_INDEX}/_update/${id}`;
        const response = await fetch(esTarget, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ doc: esFields })
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('[Relay] Investigation update failed:', result);
            return res.status(response.status).json(result);
        }

        // Mirror to Kibana Cases (non-fatal)
        if (kibanaCaseId && KIBANA_URL) {
            if (newComment) {
                addKibanaComment(kibanaCaseId, newComment)
                    .catch(e => console.error('[Relay] Kibana comment failed (non-fatal):', e.message));
            }
            if (esFields.status) {
                updateKibanaCaseStatus(kibanaCaseId, esFields.status)
                    .catch(e => console.error('[Relay] Kibana status update failed (non-fatal):', e.message));
            }
        }

        res.status(200).json({ status: 'UPDATED' });
    } catch (error) {
        console.error('[Relay] Investigation update error:', error.message);
        res.status(500).json({ error: 'INVESTIGATION_UPDATE_FAILED', message: error.message });
    }
});

// =========================================================================
// SERVER STARTUP
// =========================================================================

const PORT = process.env.RELAY_PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ================================================
    ORBITWATCH TACTICAL RELAY ACTIVE
    ================================================
    Relay Port:       ${PORT}

    Endpoints:
      GET  /v1/health               - Health check
      GET  /v1/satellites           - Fetch satellite catalog
      POST /v1/mission-relay        - Submit forensic data
      GET  /v1/investigations       - List investigations
      POST /v1/investigations       - Create/upsert investigation
      PUT  /v1/investigations/:id   - Update investigation

    Elasticsearch:
      URL:                 ${ELASTIC_URL ? 'CONFIGURED' : 'MISSING'}
      API Key:             ${ELASTIC_API_KEY ? 'CONFIGURED' : 'MISSING'}
      Satellite Index:     ${SATELLITE_INDEX}
      Forensic Index:      ${FORENSIC_INDEX}
      Investigation Index: ${INVESTIGATION_INDEX}

    Kibana Cases Mirror:
      URL:                 ${KIBANA_URL ? 'CONFIGURED' : 'NOT SET (mirror disabled)'}
      Cases Owner:         securitySolution

    Security Mode:    ${fs.existsSync('/run/secrets') ? 'Docker Secrets' : 'Environment Variables'}
    ================================================
    `);
});
