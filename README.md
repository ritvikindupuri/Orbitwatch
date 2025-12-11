
# OrbitWatch: Advanced Space Domain Awareness (SDA) Platform

![Status](https://img.shields.io/badge/Status-Operational-green)
![Classification](https://img.shields.io/badge/Class-UNCLASSIFIED-green)
![Tech](https://img.shields.io/badge/Stack-React_19_%7C_TensorFlow.js-cyan)
![Physics](https://img.shields.io/badge/Physics-SGP4%2FSDP4-orange)

**OrbitWatch** is a rapidly deployable, client-side Common Operating Picture (COP) for Space Domain Awareness. It serves as a next-generation technology demonstrator for **Space Operations Command (SpOC)** and **Orbital Warfare** directorates, proving that complex anomaly detection and orbit propagation can be decentralized to the tactical edge using browser-based Machine Learning.

---

## 🛡 Defense Applications

This platform addresses critical capability gaps in the current JADC2 (Joint All-Domain Command and Control) architecture:

### 1. Decentralized Compute (Edge Processing)
By utilizing **TensorFlow.js** and **WebAssembly**, OrbitWatch performs all orbital propagation (SGP4) and anomaly detection (Autoencoder inference) on the local client. This allows the system to operate in **DIL (Disconnected, Intermittent, Limited)** bandwidth environments where heavy server-side processing is unavailable.

### 2. Anomaly Detection (SPARTA Framework)
The system automatically maps statistical outliers to the **Aerospace Corp SPARTA** and **MITRE ATT&CK for Space** frameworks.
*   **IMP-0003 (Orbit Modification):** Automatic detection of unannounced plane changes via Inclination error analysis.
*   **EX-0001 (Maneuver):** Detection of station-keeping maneuvers via Mean Motion residuals.

### 3. Rapid Integration (Space-Track)
The system ingests standardized TLE (Two-Line Element) formats directly from Space-Track.org, ensuring interoperability with existing USSF data lakes and commercial providers.

---

## 🏗 Key Capabilities

*   **Real-Time Physics:** Uses the SGP4 propagator to calculate satellite positions 60 times per second for high-fidelity visualization.
*   **Zero Simulation:** All tracked assets are real Resident Space Objects (RSOs) derived from the catalog.
*   **3D Visualization:** Cinema-grade globe rendering with topology, specular mapping, and atmospheric lighting for intuitive battlespace awareness.
*   **Targeting Feed:** Automated High-Value Interest (HVI) lists generated from ML inference.

---

## 📚 Technical Documentation

For a deep dive into the Machine Learning architecture, Overfitting Prevention strategies, and Mathematical models used in this project, please refer to the **Technical Reference Manual**:

👉 **[Read TECHNICAL_DOCS.md](./TECHNICAL_DOCS.md)**

---

## 🛠 Setup & Deployment

### Prerequisites
*   **Node.js** (v18 or higher recommended)
*   **npm** or **yarn**

### Step-by-Step
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-org/orbit-watch.git
    cd orbit-watch
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

4.  **Access the Dashboard**
    Open `http://localhost:5173` in your secure browser.

5.  **Authenticate**
    *   **Space-Track Login:** Enter valid credentials to ingest live TLE data.
    *   **Offline Mode:** If API connection is unavailable (CORS/Air-Gap), the system automatically loads the cached `FALLBACK_TLE_SNAPSHOT` containing 60+ verified GEO assets.

---

**Developed for Demonstration Purposes**
*OrbitWatch Engineering Team*
