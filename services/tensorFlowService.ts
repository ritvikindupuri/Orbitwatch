
import * as tf from '@tensorflow/tfjs';
import * as satellite from 'satellite.js';
import { RealSatellite, AnomalyDetails } from '../types';

// --- GLOBAL MODEL STATE ---
let autoencoderModel: tf.Sequential | null = null;
let isolationForestModel: IsolationForest | null = null;
let knnModel: KNNAnomalyDetector | null = null;

// Normalization constants
let normalizationData = {
    mean: tf.tensor1d([0, 0, 0, 0, 0, 0, 0]),
    std: tf.tensor1d([1, 1, 1, 1, 1, 1, 1])
};

const FEATURE_COUNT = 7;
const FEATURE_NAMES = [
    "Inclination",
    "Eccentricity",
    "Mean Motion",
    "RAAN",
    "Arg Perigee",
    "Mean Anomaly",
    "Orbital Age"
];

// --- MODEL 2: ISOLATION FOREST IMPLEMENTATION (Custom TS) ---
class IsolationTree {
    height: number;
    splitFeature: number = 0;
    splitValue: number = 0;
    size: number;
    left: IsolationTree | null = null;
    right: IsolationTree | null = null;
    isExternal: boolean = false;

    constructor(height: number, limit: number) {
        this.height = height;
        this.size = 0; // Will be set during fit
    }
}

class IsolationForest {
    trees: IsolationTree[] = [];
    sampleSize: number = 256;
    numberOfTrees: number = 100;
    heightLimit: number = 0;

    constructor(numberOfTrees: number = 100, sampleSize: number = 256) {
        this.numberOfTrees = numberOfTrees;
        this.sampleSize = sampleSize;
        this.heightLimit = Math.ceil(Math.log2(sampleSize));
    }

    fit(data: number[][]) {
        this.trees = [];
        for (let i = 0; i < this.numberOfTrees; i++) {
            const sample = this.getRandomSubsample(data, this.sampleSize);
            const tree = this.buildTree(sample, 0, this.heightLimit);
            this.trees.push(tree);
        }
    }

    score(instance: number[]): number {
        let totalPathLength = 0;
        for (const tree of this.trees) {
            totalPathLength += this.pathLength(instance, tree, 0);
        }
        const avgPathLength = totalPathLength / this.numberOfTrees;
        const c = this.cFactor(this.sampleSize);
        return Math.pow(2, -(avgPathLength / c));
    }

    private buildTree(data: number[][], height: number, limit: number): IsolationTree {
        const node = new IsolationTree(height, limit);
        node.size = data.length;

        if (height >= limit || data.length <= 1) {
            node.isExternal = true;
            return node;
        }

        node.splitFeature = Math.floor(Math.random() * FEATURE_COUNT);
        let min = data[0][node.splitFeature];
        let max = data[0][node.splitFeature];
        for (const row of data) {
            const val = row[node.splitFeature];
            if (val < min) min = val;
            if (val > max) max = val;
        }

        if (min === max) {
            node.isExternal = true;
            return node;
        }

        node.splitValue = min + Math.random() * (max - min);
        const leftData = data.filter(row => row[node.splitFeature] < node.splitValue);
        const rightData = data.filter(row => row[node.splitFeature] >= node.splitValue);
        node.left = this.buildTree(leftData, height + 1, limit);
        node.right = this.buildTree(rightData, height + 1, limit);
        node.isExternal = false;
        return node;
    }

    private pathLength(instance: number[], node: IsolationTree, currentPathLength: number): number {
        if (node.isExternal) {
            return currentPathLength + this.cFactor(node.size);
        }
        if (instance[node.splitFeature] < node.splitValue) {
            return this.pathLength(instance, node.left!, currentPathLength + 1);
        } else {
            return this.pathLength(instance, node.right!, currentPathLength + 1);
        }
    }

    private cFactor(n: number): number {
        if (n <= 1) return 0;
        return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
    }

    private getRandomSubsample(data: number[][], size: number): number[][] {
        const shuffled = data.slice();
        let i = data.length;
        let temp: number[];
        let index: number;
        while (i--) {
            index = Math.floor(Math.random() * (i + 1));
            temp = shuffled[index];
            shuffled[index] = shuffled[i];
            shuffled[i] = temp;
        }
        return shuffled.slice(0, Math.min(size, data.length));
    }
}

// --- MODEL 3: k-NEAREST NEIGHBOR (Geometric Distance) ---
// Replaces Mahalanobis to avoid unstable Matrix Inversion on some WebGL backends.
class KNNAnomalyDetector {
    private referenceData: tf.Tensor2D | null = null;
    private threshold: number = 0;
    private k: number = 5; // Look at 5 nearest neighbors

    constructor() {}

    dispose() {
        if (this.referenceData) this.referenceData.dispose();
    }

    fit(data: number[][]) {
        tf.tidy(() => {
            // 1. Store a subset of data as reference points (to keep inference fast)
            // Limit to 500 points max for performance
            const maxPoints = 500;
            const rows = data.length > maxPoints ? data.slice(0, maxPoints) : data;
            
            // Normalize locally for calculation
            const tensorX = tf.tensor2d(rows);
            
            // We store the normalized data for distance calc
            const { mean, variance } = tf.moments(tensorX, 0);
            const std = tf.sqrt(variance).add(tf.scalar(1e-5));
            const normalizedX = tensorX.sub(mean).div(std);
            
            // Keep the normalized reference data in memory
            this.referenceData = tf.keep(normalizedX);
        });
        // Threshold is set heuristically for this implementation
        this.threshold = 3.0; 
    }

    score(instance: number[]): number {
        if (!this.referenceData) return 0;

        // Use tf.tidy to clean up intermediate tensors automatically
        return tf.tidy(() => {
            const x = tf.tensor2d([instance]); // [1, 7]
            const xNorm = x.sub(normalizationData.mean).div(normalizationData.std);

            // 2. Compute Euclidean Distance to ALL reference points
            // dist = sqrt( sum( (Ref - x)^2 ) )
            const diff = this.referenceData!.sub(xNorm);
            const squaredDiff = diff.square();
            const sumSquaredDiff = squaredDiff.sum(1); // Sum across columns -> [N]
            const distances = sumSquaredDiff.sqrt();

            // 3. Find k Nearest Neighbors (Smallest distances)
            // tf.topk finds largest, so negate first
            const negDistances = distances.neg();
            const { values } = negDistances.topk(this.k);
            
            const kNearestDistances = values.neg();
            const meanDistance = kNearestDistances.mean().dataSync()[0];

            // 4. Normalize Score (0 to 1)
            // If meanDistance > 2.0 (approx 2 sigma), it starts getting anomalous
            // We use a divisor of 5.0 to map the distance to a 0-1 probability
            return Math.min(1, Math.max(0, (meanDistance / 5.0))); 
        });
    }
}

// --- FEATURE EXTRACTION ---
function extractFeatures(sat: RealSatellite): number[] | null {
    const satrec = satellite.twoline2satrec(sat.TLE_LINE1, sat.TLE_LINE2);
    if (!satrec || satrec.error) return null;

    const launchYear = parseInt(sat.LAUNCH_DATE.split('-')[0]);
    const currentYear = new Date().getFullYear();
    const ageYears = Math.max(0, currentYear - launchYear);

    return [
        satrec.inclo || 0,
        satrec.ecco || 0,
        satrec.no || 0,
        satrec.nodeo || 0,
        satrec.argpo || 0,
        satrec.mo || 0,
        ageYears
    ];
}

/**
 * Trains the HYBRID ENSEMBLE (Autoencoder + Isolation Forest + kNN)
 * Uses Shadow Training to prevent race conditions during updates.
 */
export async function trainModelOnCatalog(catalog: RealSatellite[], onProgress?: (log: string) => void): Promise<void> {
    if (onProgress) onProgress(`Vectorizing ${catalog.length} orbital records...`);

    const data: number[][] = [];
    catalog.forEach(sat => {
        const features = extractFeatures(sat);
        if (features) {
            data.push(features);
        }
    });

    if (data.length === 0) throw new Error("No valid orbital data found.");

    // --- SHADOW TRAINING PHASE (Train on local variables first) ---

    // 1. Train Autoencoder (TF.js)
    const tensorData = tf.tensor2d(data);
    
    if (onProgress) onProgress("Model A: Computing orbital manifolds...");
    const { mean, variance } = tf.moments(tensorData, 0);
    const std = tf.sqrt(variance);
    
    const localNormMean = mean as tf.Tensor1D;
    const localNormStd = std.add(tf.scalar(1e-5)) as tf.Tensor1D;
    
    const normalizedData = tensorData.sub(localNormMean).div(localNormStd);

    if (onProgress) onProgress("Model A: Training Deep Autoencoder...");
    const localAe = tf.sequential();
    localAe.add(tf.layers.dense({ units: 14, activation: 'tanh', inputShape: [FEATURE_COUNT] }));
    localAe.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    localAe.add(tf.layers.dense({ units: 3, activation: 'relu' })); 
    localAe.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    localAe.add(tf.layers.dense({ units: 14, activation: 'tanh' }));
    localAe.add(tf.layers.dense({ units: FEATURE_COUNT, activation: 'linear' })); 
    localAe.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });

    await localAe.fit(normalizedData, normalizedData, {
        epochs: 30,
        batchSize: 32,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if (onProgress && (epoch + 1) % 10 === 0) {
                    onProgress(`Model A: Epoch ${epoch + 1}/30 | Loss: ${(logs?.loss as number).toFixed(5)}`);
                }
            }
        }
    });

    // 2. Train Isolation Forest
    if (onProgress) onProgress("Model B: Building Isolation Forest...");
    const localIf = new IsolationForest(100, Math.min(256, data.length));
    await new Promise(resolve => setTimeout(resolve, 10)); 
    localIf.fit(data);

    // 3. Train kNN Detector
    if (onProgress) onProgress("Model C: Indexing k-Nearest Neighbors...");
    const localKnn = new KNNAnomalyDetector();
    localKnn.fit(data);

    tensorData.dispose();
    normalizedData.dispose();
    
    // --- HOT SWAP PHASE (Atomic Update) ---

    if (autoencoderModel) autoencoderModel.dispose();
    if (knnModel) knnModel.dispose(); 
    if (normalizationData.mean) normalizationData.mean.dispose();
    if (normalizationData.std) normalizationData.std.dispose();

    autoencoderModel = localAe;
    isolationForestModel = localIf;
    knnModel = localKnn; // Swap new model
    
    normalizationData = {
        mean: tf.keep(localNormMean),
        std: tf.keep(localNormStd)
    };

    if (onProgress) onProgress("Tri-Model Ensemble Training Complete. Hot-Swap Executed.");
}

export async function generateAnomalyAnalysis(sat: RealSatellite): Promise<Omit<AnomalyDetails, 'operatorNotes'>> {
    if (!autoencoderModel || !isolationForestModel || !knnModel) {
        throw new Error("Models not trained.");
    }

    const features = extractFeatures(sat);
    if (!features) throw new Error("Invalid TLE");
    const age = features[6];

    // --- SCORE 1: AUTOENCODER ---
    const { aeScore, inputs, outputs } = tf.tidy(() => {
        const inputRaw = tf.tensor2d([features]);
        const input = inputRaw.sub(normalizationData.mean).div(normalizationData.std);
        const output = autoencoderModel!.predict(input) as tf.Tensor;
        const mse = tf.losses.meanSquaredError(input, output) as tf.Tensor;
        return { 
            aeScore: mse.dataSync()[0], 
            inputs: input.dataSync(), 
            outputs: output.dataSync() 
        };
    });

    // --- SCORE 2: ISOLATION FOREST ---
    const ifScore = isolationForestModel.score(features);

    // --- SCORE 3: k-NEAREST NEIGHBOR ---
    const knnScore = knnModel.score(features);

    // --- HYBRID ENSEMBLE LOGIC ---
    const aeNorm = Math.min(1, aeScore * 2);
    
    // Weighting: 40% Neural Network, 30% Isolation Forest, 30% kNN
    const ensembleProbability = (aeNorm * 0.4) + (ifScore * 0.3) + (knnScore * 0.3);

    let riskScore = Math.floor(ensembleProbability * 100);

    // Dampen score for old debris (age > 15 years)
    if (age > 15) riskScore *= 0.8;

    let riskLevel: AnomalyDetails['riskLevel'] = 'Informational';
    if (riskScore > 90) riskLevel = 'Critical';
    else if (riskScore > 70) riskLevel = 'High';
    else if (riskScore > 45) riskLevel = 'Moderate';
    else if (riskScore > 25) riskLevel = 'Low';

    let maxDiff = 0;
    let maxFeatureIndex = 0;
    for (let i = 0; i < FEATURE_COUNT; i++) {
        if (i === 6) continue;
        const diff = Math.abs(inputs[i] - outputs[i]);
        if (diff > maxDiff) { maxDiff = diff; maxFeatureIndex = i; }
    }
    const deviatingFeature = FEATURE_NAMES[maxFeatureIndex];

    let technique = "T1584 - Compromise Infrastructure"; 
    let sparta = "REC-0001: Monitor Satellite Telemetry";
    let description = `Ensemble detection: ${deviatingFeature} deviation.`;

    switch (maxFeatureIndex) {
        case 0: technique = "T1584.006 - Spacecraft Maneuver"; sparta = "IMP-0003: Orbit Modification"; description = "UNANNOUNCED PLANE CHANGE (Inclination)."; break;
        case 1: technique = "T1584.005 - Re-positioning"; sparta = "IMP-0001: Loss of Positive Control"; description = "ORBITAL DECAY/INSTABILITY (Eccentricity)."; break;
        case 2: technique = "T1584.006 - Spacecraft Maneuver"; sparta = "EX-0001: Maneuver"; description = "UNSCHEDULED DELTA-V BURN (Mean Motion)."; break;
        case 3: technique = "T1559 - Link Manipulation"; sparta = "REC-0002: RPO"; description = "NODAL DRIFT (RAAN)."; break;
    }

    return {
        description,
        assessment: `Tri-Model Consensus: AE(${(aeNorm*100).toFixed(0)}%) / IF(${(ifScore*100).toFixed(0)}%) / kNN(${(knnScore*100).toFixed(0)}%). Primary Factor: ${deviatingFeature}.`,
        riskLevel,
        riskScore,
        componentScores: {
            aeScore: Math.floor(aeNorm * 100),
            ifScore: Math.floor(ifScore * 100),
            knnScore: Math.floor(knnScore * 100)
        },
        mitreTechnique: technique,
        spartaClassification: sparta
    };
}
