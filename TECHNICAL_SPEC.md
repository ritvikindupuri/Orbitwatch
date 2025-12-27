# OrbitWatch Tactical SDA Platform: Technical Specification
**By: Ritvik Indupuri**  
**Date: 12/24/2025**

## Table of Contents
1.  [Executive Summary](#executive-summary)
2.  [System Architecture & Operational Flow](#2-system-architecture--operational-flow)
3.  [Data Lake Architecture & Ingestion](#3-data-lake-architecture--ingestion)
4.  [RF Signal Analysis & SIGINT Synthesis](#4-rf-signal-analysis--sigint-synthesis)
5.  [SGP4/SDP4 Orbital Propagation Engine](#5-sgp4sdp4-orbital-propagation-engine)
6.  [Machine Learning Ensemble Training](#6-machine-learning-ensemble-training)
    *   6.1 [Universal Feature Vector Specification](#61-universal-feature-vector-specification)
    *   6.2 [Model A: Deep Neural Autoencoder (Manifold Reconstruction)](#62-model-a-deep-neural-autoencoder-manifold-reconstruction)
    *   6.3 [Model B: Isolation Forest (Statistical Density)](#63-model-b-isolation-forest-statistical-density)
    *   6.4 [Model C: k-Nearest Neighbors (Geometric Proximity)](#64-model-c-k-nearest-neighbors-geometric-proximity)
    *   6.5 [The Ensemble Consensus Model](#65-the-ensemble-consensus-model)
7.  [Conclusion](#conclusion)

---

## Executive Summary
OrbitWatch is an advanced Space Domain Awareness (SDA) platform designed to identify and attribute anomalous behavior in the Geostationary (GEO) belt. The platform leverages a decentralized architecture, moving heavy computation to the tactical edge. By integrating high-fidelity physics with a tri-model ML ensemble, OrbitWatch provides a 1:1 digital twin of the orbital environment capable of detecting cyber-kinetic threats in real-time.

---

## 2. System Architecture & Operational Flow

The OrbitWatch architecture is designed to minimize latency by localizing the "Intelligence Core." All processing—from physics propagation to neural network inference—happens within the operator's browser session.

<p align="center">
  <b>FIGURE 1: SYSTEM ARCHITECTURE & DATA SYNERGY</b><br/>
</p>

```mermaid
graph TD
    subgraph External_Sources
        A[Space-Track API]
    end

    subgraph Data_Persistence
        B[Local Data Lake - IndexedDB]
    end

    subgraph Computational_Engines
        C[SGP4 Physics Engine]
        D[Tri-Model ML Ensemble]
        E[RF Signal Synthesis Engine]
    end

    subgraph Tactical_UI
        F[3D Globe / MapDisplay]
        G[Anomaly Detail View]
        H[SIGINT Spectrograph]
    end

    A -->|1. Live TLE Stream| B
    B -->|2. Historical Buffer| D
    B -->|3. Active State Vector| C
    C -->|4. Orbital Positions| F
    C -->|5. Doppler/Range Data| E
    D -->|6. Ensemble Risk Score| G
    E -->|7. Synthesized PSD| H
    
    style B fill:#0a0a0a,stroke:#22d3ee,color:#fff
    style D fill:#0a0a0a,stroke:#facc15,color:#fff
    style F fill:#0a0a0a,stroke:#ffffff,color:#fff
```

**Transition**: *With the high-level architecture defined, we move to the foundational layer that powers these flows: the Local Data Lake.*

---

## 3. Data Lake Architecture & Ingestion

The Local Data Lake acts as the platform's "Single Source of Truth," replacing cloud-based databases with a localized **IndexedDB** instance.

### 3.1 Ingestion & Longitudinal Snapshots
The system performs automated background synchronization every **60 seconds**. Each "snapshot" captures the state of ~300 GEO assets. 
*   **Persistent Indexing**: Every ingested TLE is indexed by `NORAD_CAT_ID` and `TIMESTAMP`.
*   **Buffer Management**: The system maintains the last **5 historical snapshots** (approx. 3,000 records) to provide a longitudinal training set for the ML models, ensuring they account for natural gravitational perturbations.

**Transition**: *Once the data is securely localized, the platform begins simulating the electromagnetic environment of these assets through SIGINT synthesis.*

---

## 4. RF Signal Analysis & SIGINT Synthesis

The RF Signal Analysis engine models how a satellite's physical motion manifests as an electromagnetic signature. It provides a real-time Power Spectral Density (PSD) spectrograph that allows operators to "hear" the orbital environment.

### 4.1 Variable Provenance & Attribution
To maintain 1:1 physical fidelity, every variable in the RF model is derived from the **SGP4 State Vector** and **Mission Metadata**.

| Variable | Definition | Mathematical Provenance |
| :--- | :--- | :--- |
| **$f_c$** | Center Frequency | S-Band (2.2 GHz) for standard telemetry; Ku-Band (12.0 GHz) for high-bandwidth Starlink/Comms. |
| **$v_{radial}$** | Radial Velocity | Calculated as the 3D magnitude ($\|\vec{v}\|$) of the velocity vector produced by the SGP4 engine. |
| **$d$** | Slant Range | The scalar Euclidean distance from the ground observer coordinates to the satellite's ECI position ($\vec{r}$). |
| **$c$** | Speed of Light | Constant: $299,792,458$ m/s. |

### 4.2 The Mathematical Synthesis Pipeline
The engine executes three sequential calculations every 1000ms:

1.  **Doppler Shift Calculation**: Radial velocity causes a frequency compression or expansion.
    $$f_{obs} = f_c \left(1 + \frac{v_{radial}}{c}\right)$$
2.  **Free-Space Path Loss (FSPL)**: The signal power attenuates over distance $d$ and frequency $f$.
    $$FSPL (dB) = 20 \log_{10}(d) + 20 \log_{10}(f) + 92.45$$
3.  **Received Signal Strength (RSSI)**: Assuming a standard transmitter power ($P_{tx}$) of 60 dBm for GEO assets:
    $$RSSI = 60 - FSPL$$

### 4.3 Spectrograph Visualization Logic
The PSD plot is generated by sampling 150 frequency bins around the calculated $f_{obs}$.
*   **The Signal Peak**: Modeled as a Gaussian distribution centered at $f_{obs}$ with a narrow standard deviation to simulate a stable carrier lock.
*   **The Noise Floor**: A baseline thermal noise ($N_o$) is modeled at -115.0 dBm with a random $\pm 2.5$ dB variance to simulate atmospheric scintillation.

<p align="center">
  <b>FIGURE 2: SIGINT SPECTRAL SYNTHESIS PIPELINE</b><br/>
</p>

```mermaid
graph LR
    SGP4[SGP4 State Vector] -->|Radial Velocity| DOP[Doppler Shift Logic]
    SGP4 -->|Slant Range| PL[Path Loss Model]
    DOP -->|Center Freq| PSD[PSD Spectrograph]
    PL -->|Magnitude| PSD
    PSD -->|Visual Output| UI[UI Spectrograph]
    
    style SGP4 fill:#0a0a0a,stroke:#22d3ee,color:#fff
    style PSD fill:#0a0a0a,stroke:#facc15,color:#fff
```

### 4.4 Electronic Warfare (EW) Anomaly Detection
The RF engine identifies anomalies by monitoring the relationship between the **Calculated Noise Floor** and the **Observed Signal Peak**.

*   **Broadband Jamming Detection**: Triggered when the noise floor across all 150 frequency bins rises by $>25$ dB. In the UI, this manifests as a "Broadband Overlay" warning with a red spectral fill.
*   **Spot Jamming Detection**: Identified when a second, high-power Gaussian peak appears that is NOT synchronized with the SGP4-predicted Doppler shift.
*   **Logic Link**: If the ML Ensemble (Section 6) reports a high risk score *simultaneously* with an RF noise floor elevation, the system upgrades the anomaly to **CRITICAL: HOSTILE INTERFERENCE**.

**Transition**: *The accuracy of these spectral signatures depends entirely on the precision of the underlying orbital propagator, which provides the range and velocity vectors.*

---

## 5. SGP4/SDP4 Orbital Propagation Engine

The SGP4 engine is the "Physics Core" of OrbitWatch, responsible for translating TLE mean elements into 3D Cartesian space.

### 5.1 Historical Back-Propagation ($t < 0$)
To detect past maneuvers, the engine runs in a "Negative Temporal Mode."
*   **Logic**: The system calculates the state vector for $T-24H$. If the resulting ballistic position deviates significantly from the *actual* historical record in the Data Lake, a maneuver is flagged.

### 5.2 Forecasting & RPO Prediction ($t > 0$)
The engine also projects forward to identify future threats.
*   **Logic**: Propagating to $T+1H$ allows the system to calculate the "Relative Distance" between two converging assets.

**Transition**: *While the Physics Engine defines ballistic norms, identifying deliberate hostile behavior requires the nuanced pattern recognition of the ML Ensemble.*

---

## 6. Machine Learning Ensemble Training

OrbitWatch utilizes a Tri-Model Ensemble architecture. This "Consensus Intelligence" approach ensures that no single algorithmic bias results in a false positive. All models are trained client-side using **TensorFlow.js** and custom TypeScript implementations.

### 6.1 Universal Feature Vector Specification
All three models consume a normalized 7-dimensional feature vector ($V_{feat}$) derived from the SGP4 mean elements:
1.  **Inclination ($i$):** Orbital plane tilt relative to the equator.
2.  **Eccentricity ($e$):** Deviation from a circular orbit.
3.  **Mean Motion ($n$):** Angular velocity/orbital period indicator.
4.  **RAAN ($\Omega$):** Right Ascension of the Ascending Node (plane orientation).
5.  **Argument of Perigee ($\omega$):** Orientation of the elliptical major axis.
6.  **Mean Anomaly ($M$):** Position of the satellite within the orbit.
7.  **Orbital Age ($T_{age}$):** Years elapsed since launch (dampening factor for debris).

**Training Dataset Size:** The ensemble trains on the **Last 5 Snapshots** stored in IndexedDB, typically representing a manifold of **1,500 to 3,000 GEO state records**.

### 6.2 Model A: Deep Neural Autoencoder (Manifold Reconstruction)
**Application Role:** Detects "Physics Violations." This model learns the standard orbital manifold of station-keeping GEO assets.

**Training:** A 6-layer Sequential Neural Network. It learns to compress the 7-D input into a 3-D bottleneck ($z$) and reconstruct the original 7-D vector. It is trained over 30 epochs using the Adam optimizer ($lr=0.01$) on normalized data.

**Scoring & Severity:** 
*   The score is the **Reconstruction Loss** (Mean Squared Error).
*   $S_{AE} = \min(1, MSE \times 2)$. 
*   High scores indicate the satellite has entered a state that is physically "impossible" or "unseen" according to learned nominal physics.

<p align="center">
  <b>FIGURE 3: AUTOENCODER NEURAL ARCHITECTURE</b><br/>
</p>

```mermaid
graph LR
    Input[7-D Feature Input] --> Encoder[Dense 14 Tanh] --> Bottleneck[Dense 3 ReLU]
    Bottleneck --> Decoder[Dense 14 Tanh] --> Output[7-D Reconstruction]
    Output -.->|Compare MSE| Input
    
    style Bottleneck fill:#facc15,stroke:#fff,color:#000
    style Input fill:#0a0a0a,stroke:#22d3ee,color:#fff
```

### 6.3 Model B: Isolation Forest (Statistical Density)
**Application Role:** Detects "Statistical Outliers." This model identifies assets that migrate into sparse regions of the orbital parameter space.

**Training:** An ensemble of 100 Isolation Trees. Each tree partitions the dataset by randomly selecting a feature and a split value. It treats anomalies as points that require fewer partitions (shorter path lengths) to isolate.

**Scoring & Severity:**
*   $S_{IF} = 2^{-\frac{E[h(x)]}{c(n)}}$, where $E[h(x)]$ is the average path length across all 100 trees.
*   A score near 1.0 indicates a highly isolated point; a score < 0.5 indicates a deep-cluster nominal point.

<p align="center">
  <b>FIGURE 4: ISOLATION FOREST PARTITIONING LOGIC</b><br/>
</p>

```mermaid
graph TD
    Root[Root Node: Random Split] --> L[Left Partition]
    Root --> R[Right Partition]
    L --> L1[Isolated: Path Length 2]
    R --> R1[Node]
    R1 --> R2[Clustered: Path Length 8]
    
    style L1 fill:#ef4444,color:#fff
    style R2 fill:#22c55e,color:#fff
```

### 6.4 Model C: k-Nearest Neighbors (Geometric Proximity)
**Application Role:** Detects "Rendezvous and Proximity Operations (RPO)." Identifies when an asset deviates from its specific neighbors in the feature space.

**Training:** The model indexes a reference set of 500 normalized nominal points. No "weights" are learned; rather, the geometric topology of the GEO belt is stored.

**Scoring & Severity:**
*   Calculates the **Euclidean Distance** to the $k=5$ nearest neighbors.
*   $S_{kNN} = \min(1, \text{avgDist} / 5.0)$.
*   Severity is determined by the "Separation Distance." If an asset moves significantly away from the cluster of similar objects (e.g., a maneuver away from a designated slot), the score spikes.

<p align="center">
  <b>FIGURE 5: KNN GEOMETRIC CLUSTERING</b><br/>
</p>

```mermaid
graph TD
    subgraph Nominal_Cluster
        A((Sat 1))
        B((Sat 2))
        C((Sat 3))
    end
    Target{Anomalous Sat} -.->|d1| A
    Target -.->|d2| B
    Target -.->|d3| C
    
    style Target fill:#f97316,stroke:#fff,color:#fff
```

### 6.5 The Ensemble Consensus Model
The final Risk Score ($S_{total}$) is a weighted aggregate of the three independent models.

**The Probability Formula:**
$$S_{total} = (0.4 \cdot S_{AE}) + (0.3 \cdot S_{IF}) + (0.3 \cdot S_{kNN})$$

**Severity Mapping:**
*   **Critical (> 90%):** Immediate hostile attribution (e.g., rapid maneuver + signal jamming).
*   **High (70-90%):** Confirmed unannounced maneuver.
*   **Moderate (45-69%):** Orbital drift or age-related decay.
*   **Low (25-44%):** Minor station-keeping deviation.
*   **Informational (< 25%):** Nominal noise.

<p align="center">
  <b>FIGURE 6: ENSEMBLE WEIGHTING & DECISION FLOW</b><br/>
</p>

```mermaid
graph TD
    AE[Model A: 40% Weight] --> AGG[Aggregator]
    IF[Model B: 30% Weight] --> AGG
    KNN[Model C: 30% Weight] --> AGG
    AGG --> RES{Final Risk Score}
    RES -->| >90 | CRIT[CRITICAL ALERT]
    RES -->| <25 | NOM[NOMINAL]
    
    style AGG fill:#facc15,color:#000
    style CRIT fill:#ef4444,color:#fff
```

---

## Conclusion
The logical integration of localized data, high-fidelity physics, and a tri-model ensemble allows OrbitWatch to attribute space threats with unprecedented speed. By following this technical pipeline—from ingestion to spectral analysis and finally into the "Intelligence Core"—the platform ensures the operator is always ahead of the threat cycle.

## Conclusion
The logical integration of localized data, high-fidelity physics, and a tri-model ensemble allows OrbitWatch to attribute space threats with unprecedented speed. By following this technical pipeline—from ingestion to spectral analysis and finally into the "Intelligence Core"—the platform ensures the operator is always ahead of the threat cycle.
