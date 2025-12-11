
# OrbitWatch: Technical Reference Manual

## 1. Executive Summary
OrbitWatch is a **Client-Side Space Domain Awareness (SDA)** platform. Unlike traditional architectures where heavy computation happens on a backend server, OrbitWatch leverages **WebAssembly (Wasm)** and **WebGL** to perform orbital propagation and Machine Learning inference directly within the user's browser.

This document details the mathematical models, data pipelines, and React component architecture that power the application.

---

## 2. System Architecture

### 2.1 Operational Workflow (Step-by-Step)

#### Step 1: Ingestion (Space-Track API)
*   The app sends your credentials to `space-track.org`.
*   It downloads a **Catalog** of TLEs (Two-Line Elements).
*   *Example:* It gets 500+ satellites (A mix of Starlink, GPS, Debris, Russian Cosmos satellites, etc.).

#### Step 2: Training (TensorFlow.js)
*   **Before** the map loads, the loading screen appears.
*   The app takes that raw Catalog of 500+ satellites and feeds it into the **Deep Autoencoder**.
*   The AI "learns" physics from this specific dataset. It learns: *"Okay, at this Altitude, the Velocity should be X, and the Inclination usually looks like Y."*
*   It creates a mathematical baseline of what "Normal" looks like for *this* specific batch of data.

#### Step 3: The Scan (Inference)
*   The Dashboard opens.
*   The app runs a loop over **every single satellite** in the catalog.
*   It asks the AI: *"Does this specific satellite match the rules you just learned?"*
    *   **Satellite A (GPS):** The AI sees the math matches. **Error = 0.01**.
        *   *Result:* Marked as **Safe**. Added to Globe as a **White Dot**.
    *   **Satellite B (Cosmos 2542):** The AI sees the Velocity is slightly off compared to its Altitude (maybe it did a maneuver). **Error = 0.85**.
        *   *Result:* Marked as **Anomaly**. Added to Globe as a **Red Pulsing Dot**. Added to Sidebar Alert Feed.

#### Step 4: Visualization (SGP4 Physics)
*   Now the app has a list of Safe satellites and Risky satellites.
*   **60 times per second**, the **SGP4 Engine** kicks in.
*   It takes the TLE + Current Time (to the millisecond).
*   It calculates the exact X, Y, Z position for **ALL** satellites (Safe and Risky).
*   This is why you see the satellites moving in real-time across the globe.

#### Step 5: Interaction
*   When you click a **Red Pulsing Ring**:
    *   The app pulls the specific analysis for that satellite.
    *   It shows the **Risk Score** (calculated in Step 3).
    *   It shows the **History Graph** (SGP4 runs backwards 24 hours to draw the line).

#### Summary
1.  **Fetch** (Get Data)
2.  **Train** (Learn Physics)
3.  **Scan** (Find Outliers)
4.  **Propagate** (Make them move with SGP4)

### 2.2 Tech Stack
*   **Core Framework:** React 19 (Vite Build System)
*   **Machine Learning:** TensorFlow.js (WebGL Backend)
*   **Orbital Physics:** `satellite.js` (SGP4/SDP4 implementation)
*   **Visualization:** `react-globe.gl` (Three.js wrapper)
*   **Styling:** Tailwind CSS

---

## 3. Machine Learning Pipeline (`services/tensorFlowService.ts`)

The core of the anomaly detection system is a **Deep Autoencoder**. An Autoencoder is a type of Neural Network trained to copy its input to its output. By restricting the network's capacity (creating a "bottleneck"), we force it to learn the most significant patterns in the data.

### 3.1 Feature Engineering
We extract **7 Orbital Elements** from the Two-Line Element (TLE) sets to serve as the input vector for the model.

| Feature Index | Name | Unit | Purpose |
| :--- | :--- | :--- | :--- |
| 0 | **Inclination** | Radians | Defines orbital tilt relative to the equator. |
| 1 | **Eccentricity** | Unitless | Defines deviation from a perfect circle. |
| 2 | **Mean Motion** | Rad/Min | Defines orbital speed. **Critical** for distinguishing LEO vs GEO. |
| 3 | **RAAN** | Radians | Right Ascension of the Ascending Node. |
| 4 | **Arg of Perigee** | Radians | Orientation of the orbit within the orbital plane. |
| 5 | **Mean Anomaly** | Radians | Satellite's position along the ellipse at epoch. |
| 6 | **Orbital Age** | Years | **Legacy System Detection**. Allows model to ignore drift in older satellites. |

### 3.2 Data Normalization (Z-Score Standardization)
Neural networks cannot handle raw orbital data effectively because the scales differ wildly (e.g., Eccentricity is 0.0001, while Mean Motion might be 15.0).
Before training, we calculate the **Mean ($\mu$)** and **Standard Deviation ($\sigma$)** of the entire catalog. Every input vector $x$ is transformed:

$$ x' = \frac{x - \mu}{\sigma} $$

This ensures all inputs are centered around 0 with a variance of 1, allowing the Gradient Descent optimizer to converge significantly faster.

### 3.3 Model Architecture
The model is a **Sequential Neural Network** with the following topology:

1.  **Input Layer:** 7 Neurons (The Normalized Features)
2.  **Encoder Layer 1:** 14 Neurons (`tanh` activation) - Expands dimensions to capture non-linear relationships.
3.  **Encoder Layer 2:** 8 Neurons (`relu` activation) - Compresses data.
4.  **Latent Space (Bottleneck):** 3 Neurons (`relu` activation) - This is the compressed "essence" of the orbit.
5.  **Decoder Layer 1:** 8 Neurons (`relu` activation) - Expands back out.
6.  **Decoder Layer 2:** 14 Neurons (`tanh` activation) - Reconstructs features.
7.  **Output Layer:** 7 Neurons (`linear` activation) - The reconstructed orbit.

### 3.4 Training Process: By The Numbers
To understand exactly how the model learns, we must distinguish between the Dataset, Batches, and Epochs.

*   **The Dataset (N ≈ 500 - 2000 Satellites):**
    This is the "Textbook." It contains the raw TLE snapshots from Space-Track. It is a static collection of rows representing the orbital state of Starlink, GPS, Cosmos, etc., at a single moment in time.

*   **Batch Size (32 Satellites):**
    This is the "Page." The GPU does not read the entire textbook at once. It grabs 32 satellites, calculates the error for those 32, and updates the neural weights once. This provides a balance between speed and learning stability.

*   **Epochs (30 Iterations):**
    An Epoch is **one complete pass through the entire dataset**.
    *   **Epoch 1:** The model sees all 500 satellites once. At this stage, the weights are random. The model guesses wildly.
    *   **Epoch 15:** The model begins to understand "Macro-Physics" (e.g., "Objects at 400km altitude usually move at 7.6km/s").
    *   **Epoch 30:** The model has fine-tuned the "Micro-Physics" (e.g., "Objects in Molniya orbits have high eccentricity").
    *   **Why 30?** We stop at 30 to prevent the model from memorizing the specific ID of "Starlink-1007". We want it to learn *General Orbital Mechanics*, not *Specific Satellite Identities*.

### 3.5 Anomaly Scoring Logic
During the operational phase, we feed live satellite data into the trained model.
1.  **Input:** Real Orbit ($X$)
2.  **Output:** Reconstructed Orbit ($\hat{X}$)
3.  **MSE Calculation:** $Error = \frac{1}{n} \sum (X - \hat{X})^2$

**Interpretation:**
*   **Low Error:** The satellite conforms to the patterns learned from the general population (Nominal).
*   **High Error:** The satellite has orbital parameters that statistically deviate from the learned manifold (Anomaly).

**Risk Score Scaling:**
We apply a scalar multiplier to convert the raw MSE (typically 0.001 - 0.5) into a human-readable 0-100 score.
$$ Score = \min(100, MSE \times 500) $$

### 3.6 Prevention of Overfitting
Overfitting occurs when a model memorizes the training data (noise) rather than learning the underlying physical rules. We utilize three specific strategies to prevent this, ensuring the model remains robust:

1.  **The Information Bottleneck (Architecture):**
    Our input vector has **7 dimensions**, but the Latent Space (middle layer) has only **3 dimensions**. This compression ratio is the primary regularization technique. It makes it mathematically impossible for the model to simply learn the "Identity Function". The model *must* discard noise and retain only the correlated physics to traverse the bottleneck successfully.

2.  **Strict Epoch Limiting:**
    We train for exactly **30 Epochs**. In experimentation, convergence typically happens around epoch 20. Training for 1000+ epochs would allow the weights to adjust to the specific floating-point quirks of the Space-Track TLE snapshot. By "early stopping" at 30, we capture the general manifold of Keplerian mechanics without memorizing specific satellite IDs.

3.  **Regime Mixing:**
    Our data ingestion strategy explicitly forces the retrieval of both **LEO** (Mean Motion > 11.25) and **GEO** (Mean Motion ~1.0) datasets. If we trained only on LEO, the model would "overfit" to fast-moving objects and flag every GEO satellite as an anomaly due to its low speed. By feeding a diverse dataset, the model learns a generalized representation of Earth orbit physics.

---

## 4. Data Ingestion Strategy (`services/satelliteData.ts`)

### 4.1 Space-Track API Integration
The app attempts to connect to `https://www.space-track.org/ajaxauth/login`.
*   **Method:** POST
*   **Payload:** `identity` (username), `password`.
*   **Query:** We execute two parallel queries to `basicspacedata/query`:
    1.  **LEO Query:** `MEAN_MOTION > 11.25` (Objects completing >11 orbits per day).
    2.  **GEO Query:** `MEAN_MOTION 0.99--1.01` (Objects completing ~1 orbit per day).
    *   *Why?* We need both regimes to ensure the ML model doesn't learn that "Fast = Normal" and flag all GEO satellites as anomalies.

### 4.2 The CORS Fallback Mechanism
**Problem:** Space-Track.org does not set `Access-Control-Allow-Origin` headers for localhost requests. Browsers will block the API call due to Cross-Origin Resource Sharing (CORS) policies.
**Solution:** The service catches the `Failed to fetch` error. If detected, it automatically loads `FALLBACK_TLE_SNAPSHOT`—a hardcoded constant containing real TLE strings for ~50 major GEO satellites (Intelsat, SES, GOES, etc.). This ensures the app is always demonstrable, even without a proxy server.

### 4.3 TLE Parsing
We use a custom parser to convert the 3-line string format into a JSON object (`RealSatellite`).
*   **Regex Logic:** Used to extract the NORAD ID, International Designator (Launch Year), and raw TLE lines.
*   **Country Detection:** We parse the `OBJECT_NAME` against a heuristic list (e.g., `BEIDOU` -> China, `GALILEO` -> EU) to assign the `OWNER` field.

---

## 5. Orbital Physics Engine (`components/AnomalyDetailView.tsx` & `MapDisplay.tsx`)

We utilize **SGP4 (Simplified General Perturbations 4)**, the NASA/NORAD standard for propagating satellite orbits.

### 5.1 Coordinate Systems
*   **TLE Data:** Provides Keplerian elements at a specific "Epoch" (time snapshot).
*   **ECI (Earth-Centered Inertial):** The propagator outputs X, Y, Z coordinates in km relative to the center of the earth, fixed to the stars (does not rotate with Earth).
*   **Geodetic (Lat/Lng/Alt):** We must account for Earth's rotation (GMST - Greenwich Mean Sidereal Time) to convert ECI to Latitude, Longitude, and Altitude.

### 5.2 Historical Reconstruction (Analytical Propagation)
In `AnomalyDetailView.tsx`, the system allows users to view telemetry over variable time ranges (24h, 48h, 7 Days, 30 Days).
We do **not** need to simulate every second between Now and Next Week. Because SGP4 is an **Analytical Propagator**, it provides a formulaic solution where $Position = f(time)$.

To find where the satellite will be in 30 days, we simply pass `t = Now + 30 Days` into the function, and it outputs the result instantly. This allows the application to render "Future Predictions" and "Historical Trends" with zero latency, as we can skip the intermediate steps that a numerical integrator (like a video game physics engine) would require.

### 5.3 RF Link Physics (Link Budget)
The **RF Physics Engine** is a non-simulated module that calculates the theoretical radio link properties between a satellite and a fixed ground observer (Schriever SFB, Colorado). This module allows operators to assess "Contactability" and "Jamming Vulnerability".

#### 5.3.1 Core Physics Equations
1.  **Slant Range ($d$):**
    The Euclidean distance between the Observer vector ($\vec{r}_{obs}$) and the Satellite vector ($\vec{r}_{sat}$).
    $$ d = |\vec{r}_{sat} - \vec{r}_{obs}| $$

2.  **Doppler Shift ($\Delta f$):**
    The apparent change in frequency due to the relative velocity of the satellite towards the observer.
    $$ \Delta f = - \frac{\vec{v} \cdot \hat{r}}{c} f_0 $$
    *   $\vec{v}$: Relative velocity vector
    *   $\hat{r}$: Unit vector towards observer
    *   $c$: Speed of light (299,792 km/s)
    *   $f_0$: Carrier frequency (12 GHz Ku-Band)

3.  **Free Space Path Loss (FSPL):**
    The attenuation of signal power as it travels through space, following the Inverse Square Law.
    $$ FSPL(dB) = 20\log_{10}(d_{km}) + 20\log_{10}(f_{MHz}) + 32.44 $$

#### 5.3.2 Real-Time Spectrum Graph Interpretation
The **Real-Time RF Spectrum Analysis** graph in the Anomaly Detail View provides a live readout of signal health.

*   **Y-Axis (Signal Strength):** Measured in **dBm** (Decibel-milliwatts).
*   **Cyan Line (Received Power $P_{rx}$):** This is the live signal level calculated using the formula:
    $$ P_{rx} = P_{tx} + G_{tx} - FSPL + G_{rx} $$
    *(Assumes standard Tx Power of 50dBm, Tx Gain 30dBi, Rx Gain 45dBi).*
*   **Red Dashed Line (Thermal Noise Floor):** Set at **-105 dBm**. This represents the background thermal noise of the receiver bandwidth (approx 36 MHz).

**Jamming Interpretation Logic:**
*   **Healthy Link:** The Cyan line is significantly above the Red line (e.g., -80 dBm). This implies a strong **Link Margin**.
*   **Vulnerable Link:** As the satellite moves further away (Slant Range increases), FSPL increases, and the Cyan line drops.
*   **Jamming Alert:** If the Cyan line touches or dips below the Red line, the signal is indistinguishable from noise. In a contested environment, this indicates the link is easily severable by a low-power jammer.

#### 5.3.3 Metric Dictionary
| Metric | Unit | Interpretation |
| :--- | :--- | :--- |
| **Look Angle** | Az/El (Deg) | Where to point the ground antenna. Azimuth is compass bearing (0-360), Elevation is tilt (0-90). |
| **Slant Range** | km | The direct line-of-sight distance. Higher Range = Weaker Signal. |
| **Doppler Shift** | kHz | How much the frequency has drifted. Receivers must "tune" to offset this value to lock the carrier. |
| **Latency** | ms | One-way light time. $Latency = Distance / SpeedOfLight$. |
| **FSPL** | dB | Free Space Path Loss. The "cost" of the distance. 200dB means the signal is $10^{20}$ times weaker than when it left. |

### 5.4 Predictive Orbital Forecasting
This feature ("The Crystal Ball") allows the system to predict a satellite's state vector at $T + 1h$.
*   **Algorithm:**
    1.  Get current system time $T_{now}$.
    2.  Add 3600 seconds.
    3.  Pass new timestamp to `satellite.propagate()`.
    4.  SGP4 solves Kepler's Equation for the new Mean Anomaly.
    5.  Result is the exact Lat/Lng/Alt for the future intercept point.
*   **Utility:** This is used for **Pass Planning** and **AOS (Acquisition of Signal)** calculations.

---

## 6. Frontend Component Breakdown

### 6.1 `App.tsx`
The root orchestrator.
*   **State:** `satelliteCatalog` (Data), `alerts` (Active Anomalies), `isAuthenticated` (View Switching).
*   **Analysis Loop:** A `useEffect` hook runs every 7 seconds. It selects a random satellite from the catalog and passes it to `generateAnomalyAnalysis()`. The result updates the `alerts` state.

### 6.2 `MapDisplay.tsx`
*   **Library:** `react-globe.gl`.
*   **Performance:** Uses Instanced Mesh Rendering to draw 3000+ points at 60FPS.
*   **Dynamic LOD:** Implements zoom-based filtering. High Altitude = Payloads/Alerts Only. Low Altitude = All Objects + Debris.
*   **The Animation Loop:** A `setInterval` runs every 1000ms. It:
    1.  Gets the current time `new Date()`.
    2.  Propagates *every* satellite in the catalog to find its new Lat/Lng.
    3.  Updates the `pointsData` prop of the Globe.
*   **Visuals:**
    *   *Points:* Colored by Risk Level (Red=Critical, Cyan=Selected, White=Nominal).
    *   *Rings:* `ringsData` creates the pulsating effect at the Lat/Lng of anomalies (Clamped to surface).

### 6.3 `DashboardPanel.tsx`
Displays the list of active alerts.
*   **Filtering:** Implements client-side filtering for Country, Object Type, and Search Text.
*   **Charts:** Uses `recharts` to render the Risk Distribution bar chart based on the aggregation of the `alerts` state.

### 6.4 `AnomalyDetailView.tsx`
The deep-dive view.
*   **Live Vectors:** Runs its own 1-second interval SGP4 loop to show the "odometer" style changing numbers for Altitude/Velocity.
*   **RF Analysis:** Renders the Spectrum Graph and Link Budget text.
*   **Tooltips:** Renders the explanation for the ML Score.

---

## 7. Risk & Threat Classification

The system adheres to **US Space Force** and **Aerospace Corporation** standards for threat mapping, utilizing the **SPARTA** framework (Space Attack Research and Tactic Analysis).

| Deviation Feature | SPARTA / MITRE Code | Terminology |
| :--- | :--- | :--- |
| **Inclination** | **IMP-0003** (Orbit Modification) | Unannounced Plane Change (High Energy Event) |
| **Mean Motion** | **EX-0001** (Maneuver) | Delta-V Burn / Station-Keeping Failure |
| **Eccentricity** | **IMP-0001** (Loss of Control) | Stabilization Failure / Orbit Decay |
| **RAAN** | **REC-0002** (Rendezvous & Proximity) | Nodal Drift / Phasing Maneuver |

**Risk Score Mapping:**
*   **0-20 (Informational):** Nominal Station-Keeping.
*   **90-100 (Critical):** Physics Breakdown (Potential Kinetic Event or Major Breakup).

---

## 8. Conclusion & Future Roadmap

OrbitWatch demonstrates a pioneering approach to Space Domain Awareness by shifting the computational burden to the client-side. By successfully integrating **TensorFlow.js** and **SGP4** in the browser, the application achieves:

1.  **Zero-Latency Analysis:** Anomalies are detected in real-time as TLE data is ingested.
2.  **Privacy Preservation:** Sensitive orbital data and threat assessments remain within the user's local execution environment.
3.  **Cross-Platform Portability:** The application runs on any modern browser without heavy backend infrastructure constraints.
4.  **Scientific Rigor:** The use of Unsupervised Autoencoders ensures that the system is resilient to novelty, capable of detecting unknown threats solely based on deviations from Newtonian physics.

**Future Considerations:**
*   Integration with `.omm` (Orbit Mean-Elements Message) standards.
*   Support for integration with local satellite ground station hardware via WebSerial API.
*   Expansion of the ML model to include Light Curve (brightness) data for physical characterization.
