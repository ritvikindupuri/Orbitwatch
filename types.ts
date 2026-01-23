
export interface RealSatellite {
    OBJECT_NAME: string;
    NORAD_CAT_ID: number;
    TLE_LINE1: string;
    TLE_LINE2: string;
    OWNER: string; // Nation state / Country
    ORGANIZATION: string; // Specific agency or company (e.g. SpaceX, Roscosmos)
    OBJECT_TYPE: string;
    LAUNCH_DATE: string;
}

export interface AnomalyDetails {
    description: string;
    assessment: string;
    riskLevel: 'Informational' | 'Low' | 'Moderate' | 'High' | 'Critical';
    riskScore: number;
    componentScores: {
        aeScore: number;
        ifScore: number;
        knnScore: number;
    };
    mitreTechnique: string;
    spartaClassification: string;
    operatorNotes?: string;
}

export interface AnomalyAlert {
    satellite: RealSatellite;
    details?: AnomalyDetails;
    analysisState?: 'pending' | 'complete' | 'failed';
    timestamp: number;
}

export interface InvestigationNote {
    timestamp: number;
    author: string;
    content: string;
}

export interface ForensicEvidence {
    telemetry: {
        apogee: number;
        perigee: number;
        inclination: number;
        velocity: number;
        alt: number;
    };
    ensemble: {
        aeScore: number;
        ifScore: number;
        knnScore: number;
        riskScore: number;
    };
    sigint: {
        centerFreq: number;
        rssi: number;
        isJamming: boolean;
        spectrumData: {freq: string, power: number}[];
    };
    frameworks: {
        mitreTechnique: string;
        spartaClassification: string;
    };
}

export interface Investigation {
    id: string;
    satelliteId: number;
    title: string;
    description: string;
    status: 'Preliminary Review' | 'Active Forensics' | 'Hostile Attribution' | 'Closed/Reported';
    dateOpened: number;
    dateClosed?: number;
    notes: InvestigationNote[];
    evidence?: ForensicEvidence;
    targetName: string;
}
