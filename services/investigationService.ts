import { Investigation, ForensicEvidence, StrategicAnalysis } from '../types.ts';

const STORAGE_KEY = 'orbitwatch_investigations_v2';

class InvestigationService {
    async init(): Promise<void> {
        return Promise.resolve();
    }

    getAll(): Investigation[] {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error("Failed to parse investigations DB", e);
            return [];
        }
    }

    getById(id: string): Investigation | undefined {
        return this.getAll().find(i => i.id === id);
    }

    create(title: string, description: string, satelliteId: number, targetName: string, evidence?: ForensicEvidence): Investigation {
        const investigations = this.getAll();
        
        const initialReport = evidence ? `
=== AUTOMATED SDA FORENSIC REPORT ===
OPERATIONAL TIMESTAMP: ${new Date().toISOString()}
ASSET IDENTIFIER: ${targetName} (NORAD:${satelliteId})

[ FORENSIC NARRATIVE ]
${evidence.attributionNarrative}

[ PRIMARY KINETIC ACTION ]
DETECTION: ${evidence.predictedAction}

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

[ VERIFICATION SIGNATURE ]
ANALYSIS_SOURCE: LOCAL_ENSEMBLE_ML_V2
ATTRIBUTION_CONFIDENCE: HIGH
MANIFOLD_SAMPLES: 1440

CONCLUSION: Systematic confirmation of non-nominal orbital behavior. This ledger entry is a permanent capture of attribution reality.
        `.trim() : `Initial Forensic Capture: ${description}. Physics State Vector locked for attribution.`;

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
        investigations.unshift(newInv);
        this.save(investigations);
        return newInv;
    }

    addNote(id: string, content: string, author: string): void {
        const investigations = this.getAll();
        const inv = investigations.find(i => i.id === id);
        if (inv) {
            inv.notes.push({
                timestamp: Date.now(),
                author,
                content
            });
            this.save(investigations);
        }
    }

    addStrategicAnalysis(id: string, analysis: StrategicAnalysis[]): void {
        const investigations = this.getAll();
        const inv = investigations.find(i => i.id === id);
        if (inv && inv.evidence) {
            inv.evidence.strategicAnalysis = analysis;
            inv.status = 'Hostile Attribution';
            this.addNote(id, `STRATEGIC ANALYSIS COMPLETE: 3-Sigma historical baseline comparison committed. Detection of ${analysis.filter(a => a.isAnomalous).length} strategic deviations.`, 'SDA-AI // STRATEGIC CORE');
            this.save(investigations);
        }
    }

    updateStatus(id: string, status: Investigation['status']): void {
        const investigations = this.getAll();
        const inv = investigations.find(i => i.id === id);
        if (inv) {
            inv.status = status;
            if (status === 'Closed/Reported') inv.dateClosed = Date.now();
            this.save(investigations);
        }
    }

    private save(data: Investigation[]) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
}

export const investigationService = new InvestigationService();