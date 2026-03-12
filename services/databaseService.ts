import { RealSatellite } from '../types.ts';

/**
 * LocalDatabase Service (DEPRECATED)
 * The local data lake has been replaced by a centralized Elasticsearch backend.
 * This service remains as a no-op to maintain compatibility with existing components.
 */
class LocalDatabase {
    async init(): Promise<void> {
        return Promise.resolve();
    }

    async saveSnapshot(catalog: RealSatellite[]): Promise<void> {
        return Promise.resolve();
    }

    async getTrainingDataset(limit: number = 5): Promise<RealSatellite[]> {
        return Promise.resolve([]);
    }

    async clearDatabase(): Promise<void> {
        return Promise.resolve();
    }
}

export const dbService = new LocalDatabase();
