import { RealSatellite } from '../types';
import { relayService } from './relayService';

const DB_NAME = 'OrbitWatch_DataLake';
const DB_VERSION = 1;
const STORE_NAME = 'tle_snapshots';

export interface CatalogSnapshot {
    timestamp: number;
    count: number;
    satellites: RealSatellite[];
}

class LocalDatabase {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject("Database failed to open");
            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
                }
            };
        });
    }

    async saveSnapshot(catalog: RealSatellite[]): Promise<void> {
        if (!this.db) await this.init();
        
        // 1. Mandatory Local Commit (Local Data Lake)
        const localCommit = new Promise<void>((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const snapshot: CatalogSnapshot = {
                timestamp: Date.now(),
                count: catalog.length,
                satellites: catalog
            };
            const request = store.add(snapshot);
            request.onsuccess = () => resolve();
            request.onerror = () => reject("Failed to save local snapshot");
        });

        // 2. Intelligence Relay Dispatch (Background)
        relayService.dispatchTelemetry(catalog).catch(() => {
            console.debug("[Database] Relay dispatch deferred.");
        });

        return localCommit;
    }

    async getTrainingDataset(limit: number = 5): Promise<RealSatellite[]> {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor(null, 'prev');
            const massiveDataset: RealSatellite[] = [];
            let snapshotsCount = 0;
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor && snapshotsCount < limit) {
                    massiveDataset.push(...(cursor.value as CatalogSnapshot).satellites);
                    snapshotsCount++;
                    cursor.continue();
                } else {
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