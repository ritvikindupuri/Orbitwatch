/**
 * ORBITWATCH MISSION INTELLIGENCE MIDDLEWARE
 * This server relays telemetry and forensics from the OrbitWatch frontend 
 * to your centralized Elasticsearch cluster.
 */

import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors()); 
    app.use(express.json({ limit: '10mb' }));

    // =========================================================================
    // MUTABLE CREDENTIALS (Initially pulled from .env)
    // =========================================================================
    let config = {
        url: process.env.ELASTIC_URL || '',
        password: process.env.ELASTIC_PASSWORD || '',
        username: process.env.ELASTIC_USERNAME || 'elastic'
    };

    function getAuthHeader() {
        if (!config.username || !config.password) return null;
        return "Basic " + Buffer.from(`${config.username}:${config.password}`).toString("base64");
    }

    function sanitizeUrl(url: string) {
        if (!url) return '';
        return url.endsWith('/') ? url.slice(0, -1) : url;
    }
    // =========================================================================

    const FALLBACK_SOPS = [
        {
            id: "SOP-RPO-01",
            title: "Rendezvous and Proximity Operations (RPO) Safety Distances",
            category: "RPO",
            content: "Standard safety ellipsoid for non-cooperative assets is 5km x 2km x 2km. Any breach of this volume without prior coordination constitutes a 'Keep-Out Zone' violation and requires immediate escalation to Hostile Attribution status.",
            source: "USSF-SDA-MANUAL-2024",
            lastUpdated: "2024-01-15"
        },
        {
            id: "SOP-EW-04",
            title: "Electronic Warfare (EW) Response Protocol",
            category: "EW",
            content: "Upon detection of a localized noise floor rise exceeding 15dB above baseline, operators must initiate frequency hopping and notify the Signal Intelligence (SIGINT) desk. If interference persists for >300 seconds, classify as 'Intentional Jamming'.",
            source: "USSF-EW-GUIDE-V3",
            lastUpdated: "2023-11-20"
        },
        {
            id: "SOP-GEN-01",
            title: "General Anomaly Reporting Thresholds",
            category: "GENERAL",
            content: "Any asset exhibiting a physics-based departure from its Pattern of Life (AE-POL score > 65) must be flagged for manual forensic review within 15 minutes of detection.",
            source: "ORBITWATCH-OPS-PROCEDURES",
            lastUpdated: "2024-02-01"
        }
    ];

    /**
     * Configuration Endpoint
     * Allows the frontend to update or retrieve credentials.
     */
    app.get('/v1/configure', (req, res) => {
        res.status(200).json({
            url: config.url || '',
            username: config.username || 'elastic',
            hasPassword: !!config.password
        });
    });

    app.post('/v1/configure', async (req, res) => {
        const { url, username, password } = req.body;
        
        if (!url || !username || !password) {
            return res.status(400).json({ error: "MISSING_FIELDS", message: "URL, Username, and Password are required." });
        }

        const cleanUrl = sanitizeUrl(url);
        console.log("[Relay] Updating Intelligence Configuration...");
        
        // Test the new credentials before committing
        try {
            const testAuth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
            const response = await fetch(cleanUrl, {
                headers: { 'Authorization': testAuth }
            });
            
            if (response.ok) {
                config = { url: cleanUrl, username, password };
                console.log("[Relay] Configuration Updated & Verified.");
                res.status(200).json({ status: 'SUCCESS', message: 'Credentials verified and updated.' });
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error("[Relay] Configuration Verification Failed:", errorData);
                res.status(401).json({ 
                    status: 'FAILED', 
                    message: errorData.error?.type === 'security_exception' 
                        ? 'Invalid Intelligence Link credentials (Security Exception).' 
                        : 'Failed to verify credentials.' 
                });
            }
        } catch (e: any) {
            res.status(500).json({ status: 'ERROR', message: e.message });
        }
    });

    /**
     * Health Check Handshake
     * Used by the frontend to verify the link to Elastic Cloud is active.
     */
    app.get('/v1/health', async (req, res) => {
        console.log("[Relay] Performing link health check...");
        if (!config.url || !config.password) {
            return res.status(404).json({ status: 'UNCONFIGURED' });
        }

        try {
            const response = await fetch(config.url, {
                headers: { 'Authorization': getAuthHeader() }
            });
            
            if (response.ok) {
                console.log("[Relay] Link Verified: Elastic Cloud is REACHABLE.");
                res.status(200).json({ status: 'HEALTHY', provider: 'Elastic Cloud' });
            } else {
                console.error("[Relay] Link Refused: Check your credentials.");
                res.status(502).json({ status: 'UNAUTHORIZED', detail: 'Check credentials' });
            }
        } catch (e) {
            console.error("[Relay] Link Failed: Check your URL.");
            res.status(500).json({ status: 'DOWN', message: e.message });
        }
    });

    /**
     * Tactical Ingest Endpoint
     */
    app.post('/v1/mission-relay', async (req, res) => {
        console.log(`[Relay] Inbound Package: ${req.body.type} from ${req.body.missionId}`);
        const authHeader = getAuthHeader();
        if (!config.url || !authHeader) {
            return res.status(401).json({ error: "UNCONFIGURED", message: "Intelligence Link not established or credentials missing." });
        }

        try {
            const indexName = 'sda-intelligence-ledger';
            const esTarget = `${config.url}/${indexName}/_doc`;

            let response = await fetch(esTarget, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...req.body,
                    processedAt: new Date().toISOString()
                })
            });

            let result = await response.json();
            
            // Handle missing index by creating it and retrying
            if (!response.ok && result.error?.type === 'index_not_found_exception') {
                console.log(`[Relay] Index '${indexName}' missing. Attempting auto-provisioning...`);
                const createResponse = await fetch(`${config.url}/${indexName}`, {
                    method: 'PUT',
                    headers: { 'Authorization': authHeader }
                });

                if (createResponse.ok) {
                    console.log(`[Relay] Index '${indexName}' provisioned successfully. Retrying relay...`);
                    // Retry the original request
                    response = await fetch(esTarget, {
                        method: 'POST',
                        headers: {
                            'Authorization': authHeader,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            ...req.body,
                            processedAt: new Date().toISOString()
                        })
                    });
                    result = await response.json();
                }
            }

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
     * Satellite Catalog Fetch Endpoint
     * Directly queries Elasticsearch for the latest Space-Track data 
     * synchronized by the backend.
     */
    app.get('/v1/satellites', async (req, res) => {
        console.log("[Relay] Fetching satellite catalog from Intelligence Link...");
        const authHeader = getAuthHeader();
        if (!config.url || !authHeader) {
            return res.status(401).json({ error: "UNCONFIGURED", message: "Intelligence Link not established or credentials missing." });
        }

        try {
            // Query the satellite-catalog index
            const esTarget = `${config.url}/satellite-catalog/_search?size=1000`;

            const response = await fetch(esTarget, {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            if (response.ok) {
                // Map Elasticsearch hits to the RealSatellite format
                const satellites = result.hits.hits.map(hit => {
                    const source = hit._source;
                    return {
                        OBJECT_NAME: source.OBJECT_NAME || source.object_name || source.NAME || "UNKNOWN",
                        NORAD_CAT_ID: parseInt(source.NORAD_CAT_ID || source.norad_id || source.CATID || 0, 10),
                        TLE_LINE1: source.TLE_LINE1 || source.tle_line1 || source.LINE1 || "",
                        TLE_LINE2: source.TLE_LINE2 || source.tle_line2 || source.LINE2 || "",
                        OWNER: source.OWNER || source.owner || source.COUNTRY_CODE || source.COUNTRY || "Unknown",
                        ORGANIZATION: source.ORGANIZATION || source.organization || source.OPERATOR || source.ORG || "Unknown Agency",
                        OBJECT_TYPE: source.OBJECT_TYPE || source.object_type || "PAYLOAD",
                        LAUNCH_DATE: source.LAUNCH_DATE || source.launch_date || "2020-01-01"
                    };
                });
                console.log(`[Relay] Retrieved ${satellites.length} assets from Intelligence Link.`);
                res.status(200).json(satellites);
            } else {
                const errorType = result.error?.type;
                
                if (errorType === 'security_exception') {
                    // Silent fallback for catalog if it's a security exception
                    // The frontend will handle the 401 by using its own fallback
                    res.status(401).json({ 
                        error: "UNAUTHORIZED", 
                        message: "Invalid Intelligence Link credentials. Please update them in the Settings menu."
                    });
                } else if (errorType === 'index_not_found_exception') {
                    console.warn("[Relay] Satellite catalog index not found. Returning empty catalog.");
                    res.status(200).json([]);
                } else {
                    console.error(`[Relay] Intelligence Link Query Failed:`, result);
                    res.status(response.status).json(result);
                }
            }
        } catch (error) {
            console.error(`[Relay] Satellite Fetch Failure:`, error.message);
            res.status(500).json({ error: "CATALOG_FETCH_INTERRUPTED", message: error.message });
        }
    });

    /**
     * MCP Intelligence Search
     * Allows the Gemini chatbot to perform semantic or structured queries 
     * against the Elasticsearch indices.
     */
    app.post('/v1/search', async (req, res) => {
        const { index, query } = req.body;
        console.log(`[Relay] Intelligence Search: Index=${index}, Query=${JSON.stringify(query)}`);
        const authHeader = getAuthHeader();

        if (!config.url || !authHeader) {
            // Fallback for SOPs if not established
            if (index === 'tactical-sops') {
                console.log("[Relay] Intelligence Link not established. Serving fallback SOPs.");
                return res.status(200).json({
                    hits: {
                        total: { value: FALLBACK_SOPS.length },
                        hits: FALLBACK_SOPS.map(sop => ({ _source: sop }))
                    }
                });
            }
            return res.status(401).json({ error: "UNCONFIGURED", message: "Intelligence Link not established or credentials missing." });
        }

        try {
            const esTarget = `${config.url}/${index}/_search`;
            const response = await fetch(esTarget, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(query)
            });

            const result = await response.json();
            if (response.ok) {
                res.status(200).json(result);
            } else {
                const errorType = result.error?.type;
                const errorReason = result.error?.reason;
                
                if (errorType === 'security_exception') {
                    // Fallback for SOPs on security exception too
                    if (index === 'tactical-sops') {
                        return res.status(200).json({
                            hits: {
                                total: { value: FALLBACK_SOPS.length },
                                hits: FALLBACK_SOPS.map(sop => ({ _source: sop }))
                            }
                        });
                    }
                    res.status(401).json({ 
                        error: "UNAUTHORIZED", 
                        message: "Invalid Intelligence Link credentials. Please update them in the Settings menu.",
                        details: errorReason
                    });
                } else if (errorType === 'index_not_found_exception') {
                    console.warn(`[Relay] Search index '${index}' not found. Returning empty results.`);
                    
                    // Fallback for SOPs if index missing
                    if (index === 'tactical-sops') {
                        return res.status(200).json({
                            hits: {
                                total: { value: FALLBACK_SOPS.length },
                                hits: FALLBACK_SOPS.map(sop => ({ _source: sop }))
                            }
                        });
                    }

                    res.status(200).json({
                        hits: {
                            total: { value: 0 },
                            hits: []
                        }
                    });
                } else {
                    console.error(`[Relay] Search Rejection:`, result);
                    res.status(response.status).json(result);
                }
            }
        } catch (error) {
            console.error(`[Relay] Search Pipe Failure:`, error.message);
            // Final fallback for SOPs
            if (index === 'tactical-sops') {
                return res.status(200).json({
                    hits: {
                        total: { value: FALLBACK_SOPS.length },
                        hits: FALLBACK_SOPS.map(sop => ({ _source: sop }))
                    }
                });
            }
            res.status(500).json({ error: "SEARCH_FAILED", message: error.message });
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`
        ================================================
        ORBITWATCH TACTICAL RELAY ACTIVE (SECURE MODE)
        Endpoint: http://localhost:${PORT}/v1/mission-relay
        Status Check: http://localhost:${PORT}/v1/health
        ================================================
        `);
    });
}

startServer();
