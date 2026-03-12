import { RealSatellite, ForensicEvidence } from '../types.ts';

/**
 * Tactical Intelligence Relay Service
 * Acts as the bridge between the "Stealth-Local" frontend and the 
 * "Centralized Intelligence" Elasticsearch backend (via Middleware).
 */
class RelayService {
    private relayEndpoint: string = 'http://localhost:3000/v1/mission-relay';
    private healthEndpoint: string = 'http://localhost:3000/v1/health';
    private isLinkActive: boolean = false;
    private linkStatus: 'CONNECTED' | 'OFFLINE' | 'UNAUTHORIZED' = 'OFFLINE';

    constructor() {
        this.performHandshake();
    }

    /**
     * Initial connection check to the middleware.
     */
    async performHandshake(): Promise<void> {
        try {
            const response = await fetch(this.healthEndpoint);
            if (response.ok) {
                this.isLinkActive = true;
                this.linkStatus = 'CONNECTED';
                console.log("[Relay] Handshake successful. Intelligence link established.");
            } else if (response.status === 401 || response.status === 403 || response.status === 502) {
                this.isLinkActive = false;
                this.linkStatus = 'UNAUTHORIZED';
                console.warn("[Relay] Handshake refused. Check Elasticsearch credentials.");
            } else {
                this.isLinkActive = false;
                this.linkStatus = 'OFFLINE';
            }
        } catch (e) {
            this.isLinkActive = false;
            this.linkStatus = 'OFFLINE';
            console.debug("[Relay] Handshake deferred. Waiting for middleware wake-up.");
        }
    }

    /**
     * Dispatches a telemetry snapshot to the relay.
     */
    async dispatchTelemetry(catalog: RealSatellite[]): Promise<boolean> {
        const payload = {
            type: 'TELEMETRY_SNAPSHOT',
            missionId: sessionStorage.getItem('ORBITWATCH_MISSION_ID') || 'OW-LOCAL-UNIDENTIFIED',
            timestamp: Date.now(),
            assetCount: catalog.length,
            data: catalog.map(s => ({
                id: s.NORAD_CAT_ID,
                name: s.OBJECT_NAME,
                owner: s.OWNER,
                org: s.ORGANIZATION
            }))
        };

        return this.transmit(payload);
    }

    /**
     * Dispatches a high-fidelity forensic evidence package.
     */
    async dispatchForensics(targetId: number, targetName: string, evidence: ForensicEvidence): Promise<boolean> {
        const payload = {
            type: 'FORENSIC_COMMITMENT',
            missionId: sessionStorage.getItem('ORBITWATCH_MISSION_ID') || 'OW-LOCAL-UNIDENTIFIED',
            timestamp: Date.now(),
            targetId,
            targetName,
            evidence
        };

        return this.transmit(payload);
    }

    private async transmit(payload: any): Promise<boolean> {
        try {
            const response = await fetch(this.relayEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.status === 401) {
                this.linkStatus = 'UNAUTHORIZED';
            } else if (response.ok) {
                this.linkStatus = 'CONNECTED';
            }

            this.isLinkActive = response.ok;
            return response.ok;
        } catch (e) {
            this.isLinkActive = false;
            console.warn("[Relay] Transmission failed. Falling back to local stealth mode.");
            return false;
        }
    }

    /**
     * Handles global response status checking for the relay.
     */
    handleResponseStatus(status: number) {
        if (status === 401) {
            if (this.linkStatus !== 'UNAUTHORIZED') {
                console.warn("[Relay] Intelligence Link: Access Denied. Credentials required.");
            }
            this.linkStatus = 'UNAUTHORIZED';
        } else if (status === 200) {
            this.linkStatus = 'CONNECTED';
        }
    }

    /**
     * Retrieves the current Elasticsearch configuration from the relay.
     */
    async getConfig(): Promise<any> {
        try {
            const response = await fetch('http://localhost:3000/v1/configure');
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Updates the Elasticsearch configuration on the relay.
     */
    async configure(config: any): Promise<boolean> {
        try {
            const response = await fetch('http://localhost:3000/v1/configure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            this.isLinkActive = response.ok;
            return response.ok;
        } catch (e) {
            this.isLinkActive = false;
            return false;
        }
    }

    getElasticStatus(): 'CONNECTED' | 'OFFLINE' | 'UNAUTHORIZED' {
        return this.linkStatus;
    }
}

export const relayService = new RelayService();