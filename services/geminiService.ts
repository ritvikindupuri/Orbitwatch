
// This service has been deprecated and replaced by the local Mahalanobis Distance model.
// No external API calls are made.

import { RealSatellite } from "../types";

export interface GeminiAnalysisResult {
    analysis: string;
    sources: { title: string; uri: string }[];
}

export async function generateAnomalyAnalysis(
    satellite: RealSatellite, 
    riskDescription: string
): Promise<GeminiAnalysisResult> {
    return {
        analysis: "Gemini integration disabled. Use local ensemble models.",
        sources: []
    };
}
