
import { Investigation } from '../types';

const STORAGE_KEY = 'orbitwatch_investigations';

class InvestigationService {
    async init(): Promise<void> {
        // Placeholder for any async init if needed later
        return Promise.resolve();
    }

    getAll(): Investigation[] {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error("Failed to parse investigations DB", e);
            return [];
        }
    }

    getById(id: string): Investigation | undefined {
        return this.getAll().find(i => i.id === id);
    }

    create(title: string, description: string, satelliteId: number): Investigation {
        const investigations = this.getAll();
        const newInv: Investigation = {
            id: crypto.randomUUID(),
            satelliteId,
            title,
            description,
            status: 'Open',
            dateOpened: Date.now(),
            notes: []
        };
        // Add to top of list
        investigations.unshift(newInv);
        this.save(investigations);
        return newInv;
    }

    addNote(id: string, content: string, author: string): void {
        const investigations = this.getAll();
        const inv = investigations.find(i => i.id === id);
        if (inv) {
            inv.notes.push({
                timestamp: Date.now(),
                author,
                content
            });
            this.save(investigations);
        }
    }

    updateStatus(id: string, status: 'Open' | 'Closed'): void {
        const investigations = this.getAll();
        const inv = investigations.find(i => i.id === id);
        if (inv) {
            inv.status = status;
            if (status === 'Closed') inv.dateClosed = Date.now();
            this.save(investigations);
        }
    }

    private save(data: Investigation[]) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
}

export const investigationService = new InvestigationService();
