/**
 * ORBITWATCH MISSION INTELLIGENCE MIDDLEWARE
 * This server relays telemetry and forensics from the OrbitWatch frontend 
 * to your centralized Elasticsearch cluster.
 */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();

app.use(cors()); 
app.use(express.json({ limit: '10mb' }));

// =========================================================================
// !!! PASTE YOUR ELASTICSEARCH DEPLOYMENT DETAILS BELOW !!!
// =========================================================================

// 1. YOUR ENDPOINT URL (FORMAT: https://[id].[region].[provider].cloud.es.io:443)
const ELASTIC_URL = "https://orbitwatch-intelligence-hub-58f319.es.us-central1.gcp.cloud.es.io"; 

// 2. YOUR CLOUD PASSWORD (The one you saved during deployment creation)
const ELASTIC_PASSWORD = "2a4QfLv3Ok6PIh1hQBGSUMmn";

// =========================================================================

const ELASTIC_USERNAME = "elastic";
const AUTH_HEADER = "Basic " + Buffer.from(`${ELASTIC_USERNAME}:${ELASTIC_PASSWORD}`).toString("base64");

/**
 * Health Check Handshake
 * Used by the frontend to verify the link to Elastic Cloud is active.
 */
app.get('/v1/health', async (req, res) => {
    console.log("[Relay] Performing link health check...");
    try {
        const response = await fetch(ELASTIC_URL, {
            headers: { 'Authorization': AUTH_HEADER }
        });
        
        if (response.ok) {
            console.log("[Relay] Link Verified: Elastic Cloud is REACHABLE.");
            res.status(200).json({ status: 'HEALTHY', provider: 'Elastic Cloud' });
        } else {
            console.error("[Relay] Link Refused: Check your ELASTIC_PASSWORD.");
            res.status(502).json({ status: 'UNAUTHORIZED', detail: 'Check credentials' });
        }
    } catch (e) {
        console.error("[Relay] Link Failed: Check your ELASTIC_URL.");
        res.status(500).json({ status: 'DOWN', message: e.message });
    }
});

/**
 * Tactical Ingest Endpoint
 */
app.post('/v1/mission-relay', async (req, res) => {
    console.log(`[Relay] Inbound Package: ${req.body.type} from ${req.body.missionId}`);

    try {
        const esTarget = `${ELASTIC_URL}/sda-intelligence-ledger/_doc`;

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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
    ================================================
    ORBITWATCH TACTICAL RELAY ACTIVE
    Endpoint: http://localhost:${PORT}/v1/mission-relay
    Status Check: http://localhost:${PORT}/v1/health
    ================================================
    `);
});
