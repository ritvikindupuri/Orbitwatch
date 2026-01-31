# OrbitWatch Tactical SDA Platform: Master Technical Specification

**by:** Ritvik Indupuri  

**Date:** 1/27/2026

---

## 1. Operational Overview
OrbitWatch is a Tier-1 Space Domain Awareness (SDA) intelligence platform engineered for the autonomous detection, forensic analysis, and tactical attribution of anomalous Resident Space Objects (RSOs) in the Geostationary (GEO) belt. 

The platform utilizes a decentralized "Stealth-Local" paradigm. By executing high-fidelity SGP4 physics, SIGINT spectral synthesis, and a Tri-Model Machine Learning (ML) ensemble entirely within the operator's local browser environment (via TensorFlow.js WebGL), OrbitWatch ensures absolute data sovereignty and zero-latency decision support. This architecture eliminates the vulnerabilities of centralized cloud processing by performing sensitive attribution logic on-site, ensuring that orbital maneuvers are detected and classified at the speed of the local CPU/GPU.

---

## 2. Integrated System Architecture

The architecture follows a strictly decoupled "Sense-Think-Act" pipeline to maintain a 60FPS UI while performing multi-threaded mathematical inference.

### 2.1 Full System Architecture Diagram & Walkthrough
```mermaid
graph TD
    subgraph "External Intelligence Ingress"
        ST[Space-Track.org API]
    end

    subgraph "Local Intelligence Core (Browser Sandbox)"
        direction TB
        DB[(IndexedDB Data Lake)]
        PE[SGP4/SDP4 Physics Engine]
        ML{Tri-Model ML Ensemble}
        RF[SIGINT Synthesis Kernel]
    end

    subgraph "Intelligence Relay (Bridge)"
        MID[server.js Node Middleware]
        ES[(Elasticsearch Cloud Ledger)]
    end

    subgraph "Tactical Interface (React 19)"
        UI[WebGL Globe HUD]
        FEED[Anomaly Feed & Triage]
        FOR[Forensic Ledger Module]
    end

    ST -->|3LE TLE Stream| DB
    DB -->|Historical Training Buffer| ML
    DB -->|Current Epoch| PE
    PE -->|State Vectors| UI
    PE -->|Velocity Deltas| RF
    ML -->|Consensus Risk Score| FEED
    RF -->|PSD Spectrograph| UI
    FEED -->|Target Selection| UI
    FEED -->|Forensic Commitment| FOR
    
    %% Intelligence Relay Integration
    DB -.->|Automated Sync| MID
    FOR -.->|Forensic Push| MID
    MID -->|Secured API Call| ES
```

#### Detailed Architectural Flow & Elastic Integration
The OrbitWatch pipeline is designed for "Local Execution, Global Intelligence." The following sequence details how data traverses from deep space registries to a multi-operator cloud ledger:

1.  **Ingress Phase (ST → DB):** Raw 3-Line Element (3LE) data is ingested from Space-Track.org via an authenticated SSL tunnel and committed directly to **IndexedDB (Hot Storage)**. This ensures that even if the internet is lost, the mission continues using the local data lake.
2.  **The Local Core (DB → PE/ML):**
    *   **Physics Loop:** The **SGP4 Engine (PE)** pulls the current epoch from the DB every second, propagating state vectors to the **WebGL HUD (UI)** for real-time tracking and calculating velocity deltas for the **SIGINT Kernel (RF)**.
    *   **Inference Loop:** The **ML Ensemble (ML)** monitors the DB's historical buffer, building longitudinal manifolds to identify behavioral deviations.
3.  **The Tactical Feedback Loop (ML/RF → FEED/UI):**
    *   The ML ensemble pushes Consensus Risk Scores to the **Anomaly Feed (FEED)**.
    *   The SIGINT kernel renders Power Spectral Density (PSD) graphs to the HUD.
    *   Operators interact with the **Triage Feed** to select targets, which updates the 3D POV on the Globe.
4.  **Forensic Commitment (FEED → FOR):** When a threat is verified, the operator commits the evidence to the **Forensic Ledger Module (FOR)**. This encapsulates SGP4 dynamics, ML scores, and RF snapshots into a single immutable forensic package.
5.  **The Intelligence Relay (DB/FOR → MID → ES):**
    *   **Automated Sync:** The local database lake continuously mirrors new telemetry to the **Node.js Middleware (MID)** via a non-blocking background task.
    *   **Forensic Push:** When a forensic package is created, it is immediately pushed to the Middleware.
    *   **Cloud Ledgering:** The Middleware appends a high-resolution Mission ID and UTC timestamp to the payload. It then executes a **Secured API Call** to the **Elasticsearch Cloud (ES)**.
    *   **Operational Value:** This bridge transforms local browser activity into a searchable global index (`sda-intelligence-ledger`). Disparate operators can now perform fleet-wide historical pattern matching using Kibana, identifying "hostile maneuvers" that occurred across different mission windows and geographies.

---

## 3. The 7-Step Intelligence Pipeline

OrbitWatch operates a sequential, high-fidelity pipeline to transform raw telemetry into forensic-grade intelligence.

### Step 1: User Login and Space-Track Authentication
The system initiates an authenticated HTTPS session with the Space-Track.org registry. 
*   **Process:** Users provide identity/password credentials which are transmitted via `application/x-www-form-urlencoded` to the `/ajaxauth/login` endpoint.
*   **Access:** Upon successful handshake, OrbitWatch gains authorization to stream live 3LE TLE data, focusing exclusively on the Geostationary Earth Orbit (GEO) belt.

### Step 2: Data Ingestion and IndexedDB Storage
Raw data is filtered and committed to a local persistent store.
*   **Filtering:** The platform executes a specific GEO-belt filter: `MEAN_MOTION/0.95--1.05` and `ECCENTRICITY/<0.02`. 
*   **Local Lake:** Telemetry is stored in **IndexedDB**. OrbitWatch maintains the last five updates for every satellite, creating a rolling historical buffer used for longitudinal trend analysis.

### Step 3: Historical Data Validation (SGP4 Back-Propagation)
To ensure the integrity of current observations, the platform validates new telemetry against historical paths.
*   **Back-Propagation:** Using the SGP4 model, the system calculates the historical path of each satellite based on its current epoch.
*   **Verification:** OrbitWatch compares current coordinates with the calculated trajectory from the previous 100 time steps. If the deviation exceeds a defined threshold, the data is flagged for investigation.

### Step 4: Feature Engineering (The 7D Vector)
Raw TLE data is transformed into a standardized 7-dimensional "Orbital Fingerprint."
*   **Features:**
    1.  **Inclination** (Plane alignment)
    2.  **Eccentricity** (Orbit shape)
    3.  **Mean Motion** (Velocity/Period)
    4.  **RAAN** (Nodal crossing)
    5.  **Argument of Perigee** (Orientation)
    6.  **Mean Anomaly** (Position in orbit)
    7.  **Orbital Age** (Launch-to-date decay factor)

### Step 5: Real-Time Data Processing (Vectorized Matrix Operations)
Inference is performed at scale using vectorized computations rather than iterative loops.
*   **Vectorization:** OrbitWatch utilizes matrix operations to process all satellite data simultaneously (e.g., using matrix subtraction to calculate fleet-wide distance deltas).
*   **GPU Acceleration:** TensorFlow.js maps these multi-dimensional tensors to the browser’s GPU via WebGL, enabling near-instantaneous processing of large satellite catalogs.

### Step 6: Web Workers (Background Processing)
To maintain a 60FPS UI, all heavy computational loads are offloaded to concurrent threads.
*   **Concurrency:** Parallel Web Workers handle matrix calculations and anomaly detection logic independently of the main UI thread.
*   **Stability:** This prevents the user interface from freezing during intensive ML training or high-volume physics propagation cycles.

### Step 7: Anomaly Detection and Consensus Scoring
The final intelligence product is a weighted consensus score ($T$).
*   **Ensemble Integration:** OrbitWatch combines outputs from the Deep Autoencoder (structural), Isolation Forest (statistical), and k-Nearest Neighbors (geometric) models.
*   **Final Threat Score:** A composite risk score determines the priority for the operator, mapping detections to risk levels (Low to Critical).

---

## 4. Data Metrics & Ingestion Specifications

### 4.1 Exact Data Volume Metrics
OrbitWatch implements a high-efficiency ingestion protocol for the Space-Track basicspacedata service.
*   **Registry Objects:** Each ingestion cycle queries exactly **300 RSOs** (Resident Space Objects).
*   **Payload Volume:** In 3LE format, each object record is ~160 bytes, resulting in a raw text payload of **~48KB per synchronization event**.
*   **Network Throughput:** At the standard 60-second operational sync interval, the platform generates **~2.88MB of inbound telemetry traffic per hour**.
*   **Ingestion Cycle:** Automatic syncs occur every 60 seconds. A mission-ready environment typically processes **3,000–5,000 unique telemetry points per hour** into the local IndexedDB Data Lake.

---

## 5. Intelligence Ensemble Logic (Tri-Model)

OrbitWatch employs a consensus-based approach to threat detection, combining three mathematical paradigms to produce a high-fidelity risk score.

### 5.1 Model A: Deep Neural Autoencoder (Structural Manifold Learning)
The Autoencoder identifies structural deviations by attempting to reconstruct the 7D orbital vector from a compressed state.

**Formula:** $S_{AE} = \frac{1}{n} \sum_{i=1}^{n} (z_i - \hat{z}_i)^2$

**Mathematical Breakdown & Logic:**
*   **Input Vector ($z$):** A 7-dimensional normalized state representing the asset's current orbital behavior.
*   **Reconstruction ($\hat{z}$):** The prediction produced after passing $z$ through the 3D bottleneck (latent space).
*   **Sum of Squared Errors (SSE):** The numerator $\sum (z - \hat{z})^2$ calculates the cumulative variance.
*   **Structural Auditing:** The model is trained on a "normal" population. If an asset performs a maneuver (Delta-V burn), the correlations between features (like Mean Motion and Eccentricity) break. The network, optimized for standard physics, fails to reconstruct this "non-standard" manifold accurately.
*   **Normalization:** The resulting MSE ($S_{AE}$) is normalized against the fleet's average variance to produce $P_{AE} \in [0, 1]$.

### 5.2 Model B: Isolation Forest (Statistical Entropy)
The Isolation Forest measures the statistical isolation of a satellite by randomly partitioning the 7D feature space.

**Formula:** $s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$

**Mathematical Breakdown & Logic:**
*   **Path Length ($h(x)$):** The number of splits (edges) required to isolate the instance $x$ in an Isolation Tree.
*   **Normalization Constant ($c(n)$):** The average path length of a binary search tree with $n$ nodes, calculated as $c(n) = 2H(n-1) - \frac{2(n-1)}{n}$, where $H(i)$ is the harmonic number.
*   **Entropy Scoring:** Anomalies are far easier to "isolate" than normal data points. Therefore, an anomalous satellite will have a much shorter path length $E(h(x))$ than a clustered "normal" asset.
*   **Probability:** As the expected path length decreases, the exponent approaches 0, and $s(x, n)$ approaches 1.0 (Critical Statistical Anomaly).

### 5.3 Model C: Geometric kNN (Density-Based Proximity)
This model performs physical proximity audits by calculating the average distance to the nearest $k$ behavioral neighbors.

**Formula:** $D_{kNN} = \frac{1}{k} \sum_{j=1}^{k} \sqrt{\sum_{i=1}^7 (z_i - q_{j,i})^2}$

**Mathematical Breakdown & Logic:**
*   **Euclidean Distance:** $\sqrt{\sum (z_i - q_{j,i})^2}$ computes the direct 7D distance between the target $z$ and its $j$-th neighbor $q$.
*   **Vectorization:** OrbitWatch uses matrix subtraction on the GPU to compute distances to all 300 neighbors simultaneously.
*   **RPO Detection:** In GEO, assets generally cluster by nation-state or mission. If an asset's average distance to its 5 closest neighbors ($k=5$) spikes, it indicates it has moved into a "void" or an unauthorized geometric sector.
*   **Threat Mapping:** $P_{kNN} = \text{Sigmoid}(D_{kNN})$ maps the geometric isolation to a standardized risk probability.

### 5.4 The Weighted Consensus Score (Final Attribution)
The system aggregates the three individual probabilities into a single **Aggregate Threat Consensus** ($T$).

**Ensemble Formula:** $T = (w_1 \cdot P_{AE}) + (w_2 \cdot P_{IF}) + (w_3 \cdot P_{kNN})$

**Weight Distribution Logic:**
*   **$w_1 = 0.40$ (Structural):** Prioritized because structural manifold deviation is the strongest indicator of a persistent physical maneuver.
*   **$w_2 = 0.30$ (Statistical):** Provides context on population rarity.
*   **$w_3 = 0.30$ (Geometric):** Critical for flagging Rendezvous and Proximity Operations (RPO).
*   **Confidence Thresholds:** $T > 0.90$ triggers a **Critical Attribution Alert**, requiring immediate human triage.

---

## 6. Algorithmic Implementation Deep-Dive

This section provides a detailed walkthrough of the internal ML models, their code structure, and the ensemble consensus logic.

### 6.1 Model A: Deep Neural Autoencoder (Structural Manifold Learning)
The Autoencoder is a neural network designed to learn a compressed representation of "normal" orbital behavior. If the model cannot accurately reconstruct an input vector, it indicates a structural anomaly.

**Code Snippet:**
```typescript
const localAe = tf.sequential();
localAe.add(tf.layers.dense({ units: 14, activation: 'tanh', inputShape: [7] }));
localAe.add(tf.layers.dense({ units: 8, activation: 'relu' }));
localAe.add(tf.layers.dense({ units: 3, activation: 'relu' })); // Bottleneck Layer
localAe.add(tf.layers.dense({ units: 8, activation: 'relu' }));
localAe.add(tf.layers.dense({ units: 14, activation: 'tanh' }));
localAe.add(tf.layers.dense({ units: 7, activation: 'linear' }));
```

**How it Works:**
1.  **Normalization:** Input 7D vectors are normalized using the mean and standard deviation of the current 300-object fleet.
2.  **Compression (Encoder):** The network compresses the 7 features into a 3D "bottleneck" layer. This forces the model to ignore noise and find the underlying physics of GEO station-keeping.
3.  **Expansion (Decoder):** The model attempts to reconstruct the original 7D vector from the 3D bottleneck.
4.  **Inference:** During real-time scanning, the **Mean Squared Error (MSE)** between the original satellite data and the reconstructed data is calculated.
5.  **Intelligence Value:** A high MSE signifies that the satellite is in a state vector that defies the learned "normal" physics of its neighbors—proving a physical maneuver is in progress.

---

### 6.2 Model B: Isolation Forest (Statistical Entropy)
Isolation Forest is a non-parametric model that isolates anomalies by randomly partitioning the feature space.

**Code Snippet:**
```typescript
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
```

**How it Works:**
1.  **Random Partitioning:** The forest builds 100 trees. Each tree picks a random feature (e.g., RAAN) and a random split point.
2.  **Anomaly Isolation:** Normal points (clusters) require many splits to isolate. Anomalies (outliers) are isolated near the root of the tree.
3.  **Scoring Logic:** The code measures the "Path Length" to isolate a specific satellite. Shorter paths result in higher anomaly scores.
4.  **Intelligence Value:** This detects satellites that are statistically "alone" in the GEO belt—assets that have moved into orbital slots or configurations that no other nation-state satellite occupies.

---

### 6.3 Model C: Geometric kNN (Geometric Proximity Analysis)
k-Nearest Neighbors (kNN) uses Euclidean distance in 7D space to find the closest neighbors for every asset.

**Code Snippet:**
```typescript
const diff = this.referenceData!.sub(xNorm); // Matrix Subtraction
const squaredDiff = diff.square();
const sumSquaredDiff = squaredDiff.sum(1); 
const distances = sumSquaredDiff.sqrt();
const { values } = negDistances.topk(this.k); // Top-k Closest
```

**How it Works:**
1.  **GPU Acceleration:** OrbitWatch uses TensorFlow.js matrix subtraction to calculate the distance between a target satellite and ALL 300 neighbors in a single clock cycle.
2.  **Neighbor Density:** The model identifies the 5 closest behavioral neighbors.
3.  **Euclidean Distance:** The average distance to these neighbors is calculated. If the distance is high, the asset is spatially isolated.
4.  **Intelligence Value:** This is critical for detecting **Rendezvous and Proximity Operations (RPO)**. It flags when a satellite is physically moving into a geometric relationship with another asset that is outside of the standard station-keeping baseline.

---

### 6.4 The Consensus Engine (Weighted Ensemble Logic)
To reduce false positives and ensure high-fidelity attribution, OrbitWatch combines the results of all three models.

**Code Snippet:**
```typescript
const ensembleProbability = (aeNorm * 0.4) + (ifScore * 0.3) + (knnScore * 0.3);
```

**How it Works:**
1.  **Normalization:** Raw scores from Model A (Neural), Model B (Statistical), and Model C (Geometric) are normalized to a 0.0 - 1.0 probability range.
2.  **Weighted Voting:**
    *   **Autoencoder (40%):** Given highest weight as it detects structural "flight style" changes.
    *   **Isolation Forest (30%):** Provides statistical population context.
    *   **kNN (30%):** Provides physical proximity context.
3.  **Result:** An alert is only escalated to "Critical" if multiple mathematical paradigms agree that the behavior is anomalous. This produces forensic-grade intelligence with a significantly higher confidence level than any single model could provide.

---

## 7. Security Architecture & Credential Masking

### 7.1 The Relay Pattern (server.js Integration)
The system "air-gaps" Elasticsearch credentials from the client-side browser:
*   **Secret Encapsulation:** All sensitive variables (`ELASTIC_URL`, `ELASTIC_PASSWORD`) reside exclusively in the private memory of the Node.js `server.js` process.
*   **Proxy Logic:** 
    1.  The Frontend `relayService.ts` makes a request to the relay with the intelligence payload but **NO** credentials.
    2.  `server.js` intercepts the request and appends the `Basic Auth` header internally using its local secrets.
    3.  `server.js` executes the final outbound request to Elastic Cloud via an encrypted server-to-server TLS tunnel.

---

## 8. Conclusion: Strategic Asset Readiness
OrbitWatch represents the convergence of high-fidelity astrodynamics and decentralized artificial intelligence. By utilizing 1,500-record longitudinal behavioral manifolds and a tri-layered ensemble architecture—secured by a robust, credential-masked relay to Elasticsearch Cloud—the platform transforms raw telemetry into forensic-grade intelligence with absolute mathematical and operational confidence.

---
