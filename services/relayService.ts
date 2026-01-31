import { RealSatellite, ForensicEvidence } from '../types';

/**
 * Tactical Intelligence Relay Service
 * Acts as the bridge between the "Stealth-Local" frontend and the 
 * "Centralized Intelligence" Elasticsearch backend (via Middleware).
 */
class RelayService {
    private relayEndpoint: string = 'http://localhost:3000/v1/mission-relay';
    private healthEndpoint: string = 'http://localhost:3000/v1/health';
    private isLinkActive: boolean = false;

    constructor() {
        this.performHandshake();
    }

    /**
     * Initial connection check to the middleware.
     */
    async performHandshake(): Promise<void> {
        try {
            const response = await fetch(this.healthEndpoint);
            this.isLinkActive = response.ok;
            if (this.isLinkActive) {
                console.log("[Relay] Handshake successful. Intelligence link established.");
            }
        } catch (e) {
            this.isLinkActive = false;
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
            
            this.isLinkActive = response.ok;
            return response.ok;
        } catch (e) {
            this.isLinkActive = false;
            console.warn("[Relay] Transmission failed. Falling back to local stealth mode.");
            return false;
        }
    }

    getLinkStatus(): 'LINKED' | 'STEALTH' {
        return this.isLinkActive ? 'LINKED' : 'STEALTH';
    }
}

export const relayService = new RelayService();