
import { Investigation, ForensicEvidence } from '../types';

const PENDING_SYNC_KEY = 'orbitwatch_pending_sync';

export interface CreateResult {
    investigation: Investigation;
    relayOk: boolean;
    error?: string;
}

class InvestigationService {
    private cache: Investigation[] = [];

    async init(): Promise<void> {
        try {
            const resp = await fetch('/v1/investigations');
            if (resp.ok) {
                this.cache = await resp.json();
                await this.flushPendingSync();
                return;
            }
        } catch { /* relay down */ }

        // Fallback: load legacy localStorage data and attempt migration
        const legacy = localStorage.getItem('orbitwatch_investigations_v2');
        if (legacy) {
            try {
                this.cache = JSON.parse(legacy);
                this.cache.forEach(inv => this.postToRelay(inv).catch(() => {}));
            } catch {
                this.cache = [];
            }
        }
    }

    getAll(): Investigation[] {
        return this.cache;
    }

    getById(id: string): Investigation | undefined {
        return this.cache.find(i => i.id === id);
    }

    getPendingSyncCount(): number {
        try {
            const raw = localStorage.getItem(PENDING_SYNC_KEY);
            if (!raw) return 0;
            return (JSON.parse(raw) as Investigation[]).length;
        } catch {
            return 0;
        }
    }

    async create(
        title: string,
        description: string,
        satelliteId: number,
        targetName: string,
        evidence?: ForensicEvidence
    ): Promise<CreateResult> {
        const initialReport = evidence
            ? `=== AUTOMATED SDA FORENSIC REPORT ===
OPERATIONAL TIMESTAMP: ${new Date().toISOString()}
ASSET IDENTIFIER: ${targetName} (NORAD:${satelliteId})

[ THREAT CONSENSUS ]
AGGREGATE RISK: ${evidence.ensemble.riskScore}%
CLASSIFICATION: ${evidence.ensemble.riskScore > 70 ? 'CRITICAL THREAT' : 'MODERATE ANOMALY'}

[ TACTICAL FRAMEWORKS ]
MITRE ATT&CK: ${evidence.frameworks.mitreTechnique}
SPARTA CLASS: ${evidence.frameworks.spartaClassification}

[ PHYSICAL STATE VECTOR ]
ALTITUDE (WGS84): ${evidence.telemetry.alt.toFixed(2)} KM
VELOCITY MAGNITUDE: ${evidence.telemetry.velocity.toFixed(4)} KM/S
INCLINATION: ${evidence.telemetry.inclination.toFixed(5)}°

[ RF PROFILE ANALYSIS ]
DOWNLINK STATUS: ${evidence.sigint.isJamming ? 'HOSTILE INTERFERENCE DETECTED' : 'NOMINAL CARRIER'}
CARRIER CENTER: ${evidence.sigint.centerFreq.toFixed(6)} GHz

[ FORENSIC REASONING ]
1. Behavioral Fingerprint (${evidence.ensemble.aeScore}%): This asset is moving in a way that breaks its historical flight pattern.
2. Population Check (${evidence.ensemble.ifScore}%): The asset has migrated into a statistically unusual sector of the GEO belt.
3. Proximity Monitor (${evidence.ensemble.knnScore}%): Geometric separation from neighboring assets has reached a critical risk threshold.

CONCLUSION: Systematic confirmation of an unauthorized orbital maneuver. This ledger entry is a permanent capture of physics reality at T-0.`
            : `Initial Forensic Capture: ${description}. Physics State Vector locked for attribution.`;

        const newInv: Investigation = {
            id: crypto.randomUUID(),
            satelliteId,
            targetName,
            title,
            description,
            status: 'Preliminary Review',
            dateOpened: Date.now(),
            notes: [
                {
                    timestamp: Date.now(),
                    author: 'SDA-AI // FORENSIC CORE',
                    content: initialReport
                }
            ],
            evidence
        };

        this.cache.unshift(newInv);

        const relayResult = await this.postToRelay(newInv);

        if (relayResult.ok && relayResult.data?.kibanaCaseId) {
            // Replace cache entry with updated Kibana refs (new object for React re-render)
            const idx = this.cache.findIndex(i => i.id === newInv.id);
            if (idx >= 0) {
                this.cache[idx] = {
                    ...this.cache[idx],
                    kibanaCaseId: relayResult.data.kibanaCaseId as string,
                    kibanaCaseUrl: (relayResult.data.kibanaCaseUrl as string) ?? undefined
                };
                newInv.kibanaCaseId = this.cache[idx].kibanaCaseId;
                newInv.kibanaCaseUrl = this.cache[idx].kibanaCaseUrl;
            }
        }

        if (!relayResult.ok) {
            this.addToPendingSync(newInv);
        }

        return {
            investigation: newInv,
            relayOk: relayResult.ok,
            error: relayResult.error
        };
    }

    async addNote(
        id: string,
        content: string,
        author: string
    ): Promise<{ ok: boolean; error?: string }> {
        const idx = this.cache.findIndex(i => i.id === id);
        if (idx < 0) return { ok: false, error: 'Case not found' };

        // Replace with new object so React detects the change
        this.cache[idx] = {
            ...this.cache[idx],
            notes: [
                ...this.cache[idx].notes,
                { timestamp: Date.now(), author, content }
            ]
        };

        try {
            const resp = await fetch(`/v1/investigations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notes: this.cache[idx].notes,
                    kibanaCaseId: this.cache[idx].kibanaCaseId,
                    newComment: `[${author}] ${content}`
                })
            });
            if (resp.ok) return { ok: true };
            const err = await resp.json().catch(() => ({})) as Record<string, unknown>;
            return { ok: false, error: (err?.error as string) || `Server error ${resp.status}` };
        } catch {
            return { ok: false, error: 'Relay unreachable' };
        }
    }

    async updateStatus(
        id: string,
        status: Investigation['status']
    ): Promise<{ ok: boolean; error?: string }> {
        const idx = this.cache.findIndex(i => i.id === id);
        if (idx < 0) return { ok: false, error: 'Case not found' };

        const dateClosed = status === 'Closed/Reported' ? Date.now() : this.cache[idx].dateClosed;

        // Replace with new object so React detects the change
        this.cache[idx] = { ...this.cache[idx], status, dateClosed };

        try {
            const resp = await fetch(`/v1/investigations/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status,
                    dateClosed,
                    kibanaCaseId: this.cache[idx].kibanaCaseId
                })
            });
            if (resp.ok) return { ok: true };
            const err = await resp.json().catch(() => ({})) as Record<string, unknown>;
            return { ok: false, error: (err?.error as string) || `Server error ${resp.status}` };
        } catch {
            return { ok: false, error: 'Relay unreachable' };
        }
    }

    private async postToRelay(
        inv: Investigation
    ): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
        try {
            const resp = await fetch('/v1/investigations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inv)
            });
            if (resp.ok) {
                const data = await resp.json() as Record<string, unknown>;
                return { ok: true, data };
            }
            const errBody = await resp.json().catch(() => ({})) as Record<string, unknown>;
            return {
                ok: false,
                error: (errBody?.error as string) || (errBody?.detail as string) || `HTTP ${resp.status}`
            };
        } catch {
            return { ok: false, error: 'Relay unreachable' };
        }
    }

    private addToPendingSync(inv: Investigation): void {
        try {
            const raw = localStorage.getItem(PENDING_SYNC_KEY);
            const queue: Investigation[] = raw ? JSON.parse(raw) : [];
            const existing = queue.findIndex(i => i.id === inv.id);
            if (existing >= 0) queue[existing] = inv;
            else queue.push(inv);
            localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
        } catch { /* storage full */ }
    }

    private async flushPendingSync(): Promise<void> {
        try {
            const raw = localStorage.getItem(PENDING_SYNC_KEY);
            if (!raw) return;
            const queue: Investigation[] = JSON.parse(raw);
            if (queue.length === 0) return;

            const remaining: Investigation[] = [];
            for (const inv of queue) {
                const result = await this.postToRelay(inv);
                if (!result.ok) remaining.push(inv);
            }

            if (remaining.length === 0) {
                localStorage.removeItem(PENDING_SYNC_KEY);
            } else {
                localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
            }
        } catch { /* ignore */ }
    }
}

export const investigationService = new InvestigationService();
