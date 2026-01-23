# OrbitWatch: Technical Documentation & System Architecture

## 1. System Architecture Overview
OrbitWatch is a decentralized, client-side Space Domain Awareness (SDA) platform. It executes all telemetry ingestion, physics propagation, and data storage locally in the operator's browser.

### 1.1 System Data Flow (PlantUML)
```plantuml
@startuml
skinparam backgroundColor #020617
skinparam ArrowColor #22d3ee
skinparam actor {
    BackgroundColor #22d3ee
}

actor "Operator" as User
participant "Space-Track API" as ST
database "IndexedDB Data Lake" as DB
node "SGP4 Physics Engine" as PE
node "ML Ensemble" as ML
participant "3D Globe UI" as UI

User -> ST : Authenticate
ST -> User : TLE Stream
User -> DB : Ingest Snapshots
DB -> ML : Training Buffer
loop Every 1 second
    PE -> PE : Propagate State Vector
    PE -> UI : Update Sat Positions
end
loop Every 60 seconds
    ML -> ML : Continuous Inference
    ML -> UI : Push Anomaly Alerts
end
@enduml
```

---

## 2. Orbital Dynamics Engine (SGP4/SDP4)

### 2.1 Propagation Logic
The system uses the **Simplified General Perturbations (SGP4)** model for Low Earth Orbit (LEO) and **Deep-Space (SDP4)** for Geostationary (GEO) assets.
*   **State Vector Generation:** Calculates Cartesian ECI position ($X, Y, Z$) and velocity ($vX, vY, vZ$).
*   **Geodetic Conversion:** Converts ECI to WGS84 Geodetic (Lat, Lng, Alt) using GMST (Greenwich Mean Sidereal Time).

---

## 3. Data Lake Architecture (IndexedDB)
OrbitWatch utilizes **IndexedDB** as a persistent local NoSQL store. 
*   **Longitudinal Snapshots:** Allows the ML ensemble to learn behavior over time by comparing the current state to the last 5 ingested historical snapshots (~2,000 records).

---

## 4. Component Reference

### 4.1 MapDisplay (3D Globe)
*   **Technology:** `react-globe.gl` (Three.js).
*   **Features:** Hardware-accelerated rendering. Pulsing rings denote active ML anomalies.

### 4.2 AnomalyDetailView (Tactical Analysis)
*   **Dynamics Tab:** Real-time sampling of the SGP4 engine.
*   **Intel Tab:** Displays the weighted consensus (40/30/30) from the Tri-Model ML Ensemble.
*   **Forecasting:** Propagates vectors to $T+1H$ for maneuver prediction.