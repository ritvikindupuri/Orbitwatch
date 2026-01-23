
import { RealSatellite } from '../types';

const DB_NAME = 'OrbitWatch_DataLake';
const DB_VERSION = 1;
const STORE_NAME = 'tle_snapshots';

export interface CatalogSnapshot {
    timestamp: number;
    count: number;
    satellites: RealSatellite[];
}

/**
 * Local Database Service
 * Implements a decentralized "Data Lake" in the browser using IndexedDB.
 * This service is responsible for storing historical TLE snapshots to enable 
 * longitudinal machine learning analysis and trend detection.
 */
class LocalDatabase {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject("Database failed to open");
            
            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                console.log("Local Data Lake (IndexedDB) Initialized.");
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
                    objectStore.createIndex('count', 'count', { unique: false });
                }
            };
        });
    }

    /**
     * Commits a full catalog snapshot to the persistent store.
     * This enables the system to compare current telemetry against historical manifolds.
     */
    async saveSnapshot(catalog: RealSatellite[]): Promise<void> {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const snapshot: CatalogSnapshot = {
                timestamp: Date.now(),
                count: catalog.length,
                satellites: catalog
            };

            const request = store.add(snapshot);
            
            request.onsuccess = () => {
                console.log(`[Database] Committed temporal snapshot of ${catalog.length} objects.`);
                resolve();
            };
            request.onerror = () => reject("Failed to save snapshot");
        });
    }

    /**
     * Retrieves the "Longitudinal Dataset" for ML Training.
     * Combines the most recent snapshots to build a statistical baseline of "Nominal" orbital behavior.
     * @param limit The number of historical snapshots to aggregate.
     */
    async getTrainingDataset(limit: number = 5): Promise<RealSatellite[]> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor(null, 'prev'); // Retrieve latest snapshots first

            const massiveDataset: RealSatellite[] = [];
            let snapshotsCount = 0;

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor && snapshotsCount < limit) {
                    const snapshot = cursor.value as CatalogSnapshot;
                    massiveDataset.push(...snapshot.satellites);
                    snapshotsCount++;
                    cursor.continue();
                } else {
                    console.log(`[Database] Compiled training buffer: ${massiveDataset.length} records from ${snapshotsCount} historical snapshots.`);
                    resolve(massiveDataset);
                }
            };
            request.onerror = () => reject("Failed to query database");
        });
    }

    async clearDatabase(): Promise<void> {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            transaction.objectStore(STORE_NAME).clear();
            resolve();
        });
    }
}

export const dbService = new LocalDatabase();
