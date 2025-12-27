
export interface RealSatellite {
    OBJECT_NAME: string;
    NORAD_CAT_ID: number;
    TLE_LINE1: string;
    TLE_LINE2: string;
    OWNER: string;
    OBJECT_TYPE: string;
    LAUNCH_DATE: string;
}

export interface AnomalyDetails {
    description: string;
    assessment: string;
    riskLevel: 'Informational' | 'Low' | 'Moderate' | 'High' | 'Critical';
    riskScore: number;
    // New: Individual scores for the Ensemble
    componentScores: {
        aeScore: number; // Autoencoder (0-100 normalized)
        ifScore: number; // Isolation Forest (0-100 normalized)
        knnScore: number; // k-Nearest Neighbors (0-100 normalized)
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

export interface Investigation {
    id: string;
    satelliteId: number;
    title: string;
    description: string;
    status: 'Open' | 'Closed';
    dateOpened: number;
    dateClosed?: number;
    notes: InvestigationNote[];
}
