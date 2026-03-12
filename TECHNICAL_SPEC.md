# OrbitWatch Tactical SDA Platform: Master Technical Specification
**Version:** 3.9.6 // DATA LIFECYCLE & INGRESS UPDATE
**Operational Date:** 1/27/2026

---

## 1. Operational Overview
OrbitWatch is a Tier-1 Space Domain Awareness (SDA) intelligence platform engineered for the autonomous detection, forensic analysis, and tactical attribution of anomalous Resident Space Objects (RSOs). 

The platform utilizes a **Recursive Physics-to-Framework Mapping** engine to translate raw orbital shifts into actionable intelligence frameworks.

---

## 2. Calculation Methodology & Quantitative Logic

The core of OrbitWatch is the **Tri-Model Attribution Ensemble**, which synthesizes three distinct machine learning methodologies to reach a consensus on threat severity.

### 2.1 Physics Manifold Audit (Detection Heuristics)
Before the ensemble is weighted, the system performs a high-fidelity audit of the asset's state-vector deltas (derived via SGP4/SDP4).

*   **Inclination Delta ($\Delta i$):** A deviation $> 0.08$ radians (approx. 4.58°) triggers the **Nodal Migration** logic.
*   **Mean Motion Delta ($\Delta n$):** A deviation from the GEO-synchronous baseline ($1.0027$) of $> \pm 0.004$ triggers the **Kinetic Velocity** logic.
*   **Eccentricity Delta ($\Delta e$):** An eccentricity value $> 0.005$ triggers the **Phasing/Drift** logic.

### 2.2 Ensemble Weighting Formula
The **Final Threat Score ($S_{Total}$)** is calculated as a weighted composite of three independent model scores ($0-100$):

$$S_{Total} = (S_{AE} \times 0.4) + (S_{IF} \times 0.3) + (S_{kNN} \times 0.3)$$

Where:
*   **$S_{AE}$ (Structural Neural Autoencoder):** Measures the Normalized Mean Squared Error (MSE) of current physics deltas against the asset's 12-month historical Pattern of Life (PoL).
*   **$S_{IF}$ (Statistical Entropy / Isolation Forest):** Measures the "isolation depth" of the maneuver relative to the fleet.
*   **$S_{kNN}$ (Geometric Proximity / RPO Sync):** Calculates Euclidean distance in a 7D behavioral space to detect synchronization with secondary assets.

---

## 3. Data Lifecycle & Intelligence Ingress

OrbitWatch utilizes a **Hybrid-Stealth Intelligence Pipeline** to balance local data sovereignty with centralized forensic persistence.

### 3.1 Step 1: Ingress & Data Lake Persistence
1.  **Authentication:** System establishes a TLS 1.3 handshake with `space-track.org`.
2.  **Telemetry Stream:** 300+ RSO records (3LE format) are ingested into the client sandbox.
3.  **Data Lake Write:** `dbService` commits the full snapshot to the **OrbitWatch_DataLake (IndexedDB)**.
    *   *Storage Schema:* `tle_snapshots` store, keyed by `timestamp`.
    *   *Retention:* 5 snapshot cycles (Rolling Buffer) to enable 3-Sigma historical baseline generation.

### 3.2 Step 2: The Tactical Relay
1.  **Mission Sync:** Concurrent with the local DB write, `relayService.dispatchTelemetry()` POSTs asset metadata to the Mission Relay (`server.js`).
2.  **Global Indexing:** Data is indexed in Elastic Cloud, providing high-level fleet metrics without exposing sensitive local physics state-vectors.

### 3.3 Step 3: Forensic Commitment (Final Attribution)
1.  **Operator Intent:** Upon anomaly verification, the operator triggers a **Forensic Commitment**.
2.  **Package Construction:** High-fidelity evidence (SIGINT PSD, 7D kNN state, and Strategic Assessment) is encapsulated in a JSON doc.
3.  **Ledger Ingestion:** Package is relayed to the `sda-intelligence-ledger` in Elasticsearch for permanent, multi-operator searchable attribution.

---

## 4. Tactical Maneuver Taxonomy (Mapping Logic)

The system maps Quantitative Deltas to Qualitative Frameworks based on dominant model scores:

### 4.1 Framework Attribution Mapping
| Threshold Trigger | Attribution Result | MITRE Technique | SPARTA Class |
| :--- | :--- | :--- | :--- |
| $S_{kNN} > 80$ | **RPO Synchronization** | T1584.001 | REC-0002 |
| $\Delta i > 0.08$ AND $\Delta n > 0.004$ | **Plane Change / Nodal** | T1584.006 | IMP-0003 |
| $\Delta n > 0.01$ (Instantaneous) | **Kinetic Delta-V Burn** | T1584.005 | EX-0001 |
| $\Delta e > 0.005$ | **Phasing / Drift** | T1584.004 | REC-0001 |
| $S_{Total} > 85$ (Proximity < 50km) | **KOZ Violation** | T1584.002 | IMP-0001 |

---

## 5. Strategic 3-Sigma ($\sigma 3$) Analysis

For forensic commitment, the system performs a Gaussian audit of the asset's historical behavior.

### 5.1 Gaussian Probability Density
The system calculates the Standard Deviation ($\sigma$) of the asset's last 1,440 TLE records (12-month history). 
*   **Sigma Level:** Calculated as $\frac{|Current\_Value - Mean|}{Standard\_Deviation}$.
*   **Alert Threshold:** Any value $> 3.0\sigma$ is classified as a "Strategic Departure," confirming that the maneuver is not part of standard station-keeping cycles.

---
*Operational ID: OW-STEALTH-PROTCOL-V39.6 // DATA LIFECYCLE // PHYSICS-FIRST LOGIC*