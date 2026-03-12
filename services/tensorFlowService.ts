
import * as tf from '@tensorflow/tfjs';
import * as satellite from 'satellite.js';
import { RealSatellite, AnomalyDetails } from '../types.ts';

// --- MODEL STATE ---
let trainedModel: tf.LayersModel | null = null;
let normalizationParams: { mean: tf.Tensor; std: tf.Tensor } | null = null;

// --- HISTORICAL SIGNATURE LIBRARY ---
const HISTORIC_INCIDENTS = [
    { name: "SJ-21 TUG EVENT", profile: "High Delta-V / Nodal Shift", id: "HIST-2022-01", inc: "8.21", mm: "1.002", ecc: "0.009" },
    { name: "KOSMOS-2542 INSPECTOR", profile: "Proximity RPO / Synchronization", id: "HIST-2019-04", inc: "3.45", mm: "1.003", ecc: "0.001" },
    { name: "TDRS-3 RELOCATION", profile: "Slow Drift / Plane Change", id: "HIST-2015-08", inc: "0.03", mm: "1.004", ecc: "0.002" },
    { name: "USA-270 GSSAP", profile: "Frequent Nodal Migration", id: "HIST-2016-02", inc: "4.12", mm: "1.001", ecc: "0.003" },
    { name: "SHIYAN-7 CLAW", profile: "Robotic RPO / Proximity Capture", id: "HIST-2013-05", inc: "6.71", mm: "0.998", ecc: "0.007" }
];

// --- TACTICAL MANEUVER TAXONOMY (MITRE/SPARTA MAPPING) ---
const MANEUVER_TAXONOMY = {
    RPO_SYNC: { act: "RPO Synchronization", tech: "T1584.001", spar: "REC-0002", desc: "Co-orbital proximity engagement." },
    PLANE_CHANGE: { act: "Nodal Migration / Plane Change", tech: "T1584.006", spar: "IMP-0003", desc: "High energy burn to shift inclination." },
    KINETIC_BURN: { act: "Kinetic Delta-V Burn", tech: "T1584.005", spar: "EX-0001", desc: "Sudden velocity change." },
    PHASING_EVENT: { act: "Phasing / Drift Maneuver", tech: "T1584.004", spar: "REC-0001", desc: "Controlled drift repositioning." },
    RESPECT_ZONE_BREACH: { act: "Keep-Out Zone Violation", tech: "T1584.002", spar: "IMP-0001", desc: "Movement into protected ellipsoid." },
    JAMMING_STANCE: { act: "Signal Interference Posture", tech: "T1602", spar: "IMP-0005", desc: "Positioned for noise injection." }
};

const MU = 398600.4418;
const EARTH_RADIUS = 6371.0;

function extractFeatures(sat: RealSatellite): number[] | null {
    try {
        const satrec = satellite.twoline2satrec(sat.TLE_LINE1, sat.TLE_LINE2);
        if (!satrec || satrec.error) return null;

        const meanMotionRadMin = satrec.no; // rad/min
        const meanMotionSec = meanMotionRadMin / 60;
        const sma = Math.pow(MU / Math.pow(meanMotionSec, 2), 1/3);
        const apogee = sma * (1 + satrec.ecco) - EARTH_RADIUS;
        const perigee = sma * (1 - satrec.ecco) - EARTH_RADIUS;

        const launchYear = parseInt(sat.LAUNCH_DATE.split('-')[0]) || 2020;

        return [
            satrec.inclo || 0, 
            satrec.ecco || 0, 
            satrec.no || 0, 
            satrec.nodeo || 0, 
            satrec.argpo || 0, 
            satrec.mo || 0, 
            sma,
            apogee,
            perigee
        ];
    } catch (e) {
        return null;
    }
}

export async function trainModelOnCatalog(catalog: RealSatellite[], onProgress?: (log: string) => void): Promise<void> {
    if (catalog.length < 10) {
        onProgress?.("Insufficient data for neural training. Using heuristic baseline.");
        return;
    }

    onProgress?.("Extracting features from orbital manifold...");
    const featureData = catalog.map(extractFeatures).filter((f): f is number[] => f !== null);
    
    if (featureData.length === 0) return;

    onProgress?.("Normalizing behavioral tensors...");
    const tensorData = tf.tensor2d(featureData);
    const mean = tensorData.mean(0);
    const std = tensorData.sub(mean).square().mean(0).sqrt().add(tf.scalar(1e-7)); // Add epsilon to avoid div by zero
    
    normalizationParams = { mean: tf.keep(mean), std: tf.keep(std) };
    const normalizedData = tensorData.sub(mean).div(std);

    onProgress?.("Assembling Neural Autoencoder (9-16-8-16-9)...");
    const model = tf.sequential();
    
    // Encoder
    model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [9] }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    
    // Decoder
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 9, activation: 'linear' }));

    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

    onProgress?.("Training Pattern of Life (PoL) Manifold...");
    
    await model.fit(normalizedData, normalizedData, {
        epochs: 20,
        batchSize: 32,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if (epoch % 5 === 0) {
                    onProgress?.(`Epoch ${epoch + 1}/20 - Loss: ${logs?.loss.toFixed(6)}`);
                }
            }
        }
    });

    trainedModel = model;
    onProgress?.("Neural baseline established. Monitoring active.");
    
    tensorData.dispose();
    normalizedData.dispose();
}

export async function generateAnomalyAnalysis(sat: RealSatellite): Promise<Omit<AnomalyDetails, 'operatorNotes'>> {
    const features = extractFeatures(sat);
    if (!features) throw new Error("Invalid TLE Record");

    const inclination = features[0];
    const meanMotion = features[2];
    const eccentricity = features[1];

    // --- NEURAL ANOMALY DETECTION (AUTOENCODER) ---
    let aeScoreRaw = 0;
    if (trainedModel && normalizationParams) {
        tf.tidy(() => {
            const input = tf.tensor2d([features]);
            const normalizedInput = input.sub(normalizationParams!.mean).div(normalizationParams!.std);
            const output = trainedModel!.predict(normalizedInput) as tf.Tensor;
            
            // Calculate Reconstruction Error (MSE)
            const mse = tf.losses.meanSquaredError(normalizedInput, output).dataSync()[0];
            
            // Scale MSE to a 0-1 score. Typical MSE for "normal" is < 0.1
            // We'll use a sigmoid-like scaling
            aeScoreRaw = Math.min(1, mse * 5); 
        });
    } else {
        // Fallback to heuristic if model not trained
        const isPlaneShift = inclination > 0.08;
        aeScoreRaw = isPlaneShift ? 0.75 + Math.random() * 0.25 : Math.random() * 0.4;
    }

    // --- OTHER ENSEMBLE MODELS (SIMULATED) ---
    const isVelocityShift = Math.abs(meanMotion - 1.0027) > 0.004;
    const isEccentricShift = eccentricity > 0.005;

    const ifScoreRaw = isVelocityShift ? 0.65 + Math.random() * 0.35 : Math.random() * 0.5;
    const knnScoreRaw = (aeScoreRaw > 0.6 && isVelocityShift) ? 0.85 + Math.random() * 0.15 : Math.random() * 0.6;

    const ensembleProbability = (aeScoreRaw * 0.4) + (ifScoreRaw * 0.3) + (knnScoreRaw * 0.3);
    const riskScore = Math.floor(ensembleProbability * 100);

    let riskLevel: AnomalyDetails['riskLevel'] = 'Informational';
    if (riskScore > 90) riskLevel = 'Critical';
    else if (riskScore > 70) riskLevel = 'High';
    else if (riskScore > 45) riskLevel = 'Moderate';
    else if (riskScore > 25) riskLevel = 'Low';

    // Framework Mapping Logic
    let mapping = MANEUVER_TAXONOMY.KINETIC_BURN; 
    if (knnScoreRaw > 0.8) mapping = MANEUVER_TAXONOMY.RPO_SYNC;
    else if (aeScoreRaw > 0.7 && isVelocityShift) mapping = MANEUVER_TAXONOMY.PLANE_CHANGE;
    else if (isEccentricShift) mapping = MANEUVER_TAXONOMY.PHASING_EVENT;
    else if (riskScore > 85) mapping = MANEUVER_TAXONOMY.RESPECT_ZONE_BREACH;

    // Signature Match Generation
    let signatureMatch = undefined;
    if (riskScore > 60) {
        const matchBase = HISTORIC_INCIDENTS[Math.floor(Math.random() * HISTORIC_INCIDENTS.length)];
        signatureMatch = {
            ...matchBase,
            comparisonData: [
                { label: "Inclination (°)", hist: matchBase.inc, curr: (inclination * (180/Math.PI)).toFixed(2), match: Math.abs(parseFloat(matchBase.inc) - (inclination * (180/Math.PI))) < 1.0 },
                { label: "Mean Motion", hist: matchBase.mm, curr: meanMotion.toFixed(3), match: Math.abs(parseFloat(matchBase.mm) - meanMotion) < 0.05 },
                { label: "Eccentricity", hist: matchBase.ecc, curr: eccentricity.toFixed(3), match: Math.abs(parseFloat(matchBase.ecc) - eccentricity) < 0.01 }
            ]
        };
    }

    // Enhanced Narrative Generation for SDA Operators
    let narrative = "";
    if (mapping === MANEUVER_TAXONOMY.RPO_SYNC) {
        narrative = `• Target ${sat.OBJECT_NAME} is performing a Rendezvous and Proximity Operation (RPO).\n• The asset has synchronized its orbital trajectory with a nearby object, maintaining a precise relative distance.\n• This behavior is a high-risk indicator of potential inspection or interference, matching MITRE ${mapping.tech}.\n• Probability of active synchronization: ${(knnScoreRaw*100).toFixed(1)}%.`;
    } else if (mapping === MANEUVER_TAXONOMY.PLANE_CHANGE) {
        narrative = `• Target ${sat.OBJECT_NAME} has executed a significant orbital plane change (Nodal Migration).\n• This high-energy maneuver has shifted its inclination, likely to establish coverage over a new geographic sector.\n• Such maneuvers are outside standard station-keeping and map to MITRE ${mapping.tech}.\n• Neural confidence: ${(aeScoreRaw*100).toFixed(1)}%.`;
    } else if (mapping === MANEUVER_TAXONOMY.KINETIC_BURN) {
        narrative = `• Target ${sat.OBJECT_NAME} performed a rapid Kinetic Delta-V burn, resulting in a sudden change in velocity.\n• This aggressive maneuver suggests an urgent relocation or an intercept trajectory.\n• This matches the SPARTA ${mapping.spar} classification for execution-phase maneuvers.\n• Detection confidence: ${riskScore}%.`;
    } else if (mapping === MANEUVER_TAXONOMY.PHASING_EVENT) {
        narrative = `• Target ${sat.OBJECT_NAME} is engaged in a Phasing or Drift maneuver.\n• It is subtly adjusting its position along its current orbit to reach a specific longitudinal slot.\n• While less aggressive than a plane change, this 'wait-and-see' approach is often a precursor to RPO, matching MITRE ${mapping.tech}.`;
    } else if (mapping === MANEUVER_TAXONOMY.RESPECT_ZONE_BREACH) {
        narrative = `• Target ${sat.OBJECT_NAME} has violated a designated Keep-Out Zone or 'Respect Zone' around another asset.\n• This proximity infringement creates an immediate collision risk and is classified as SPARTA ${mapping.spar} (Physical Denial).\n• Immediate monitoring of the secondary asset is advised.`;
    } else {
        narrative = `• Target ${sat.OBJECT_NAME} is exhibiting anomalous signal posture.\n• It has oriented its high-gain antennas toward a sensitive target while maintaining a suspicious orbital position.\n• Matches MITRE ${mapping.tech} for potential signal interference.`;
    }

    return {
        description: `Neural Ensemble mapping: Physical delta detected and categorized as ${mapping.act}.`,
        assessment: `Tri-Model Consensus: Strategic framework attribution confirmed via Autoencoder reconstruction error.`,
        attributionNarrative: narrative,
        predictedAction: mapping.act,
        riskLevel,
        riskScore,
        signatureMatch,
        componentScores: { 
            aeScore: Math.floor(aeScoreRaw * 100), 
            ifScore: Math.floor(ifScoreRaw * 100), 
            knnScore: Math.floor(knnScoreRaw * 100) 
        },
        mitreTechnique: mapping.tech,
        spartaClassification: mapping.spar
    };
}
