import { AnomalyAlert } from '../types';

const API_URL = 'http://localhost:5000/api'; // Make this configurable via env var in real app

export const getArchivedAlerts = async (): Promise<AnomalyAlert[]> => {
  const response = await fetch(`${API_URL}/alerts`);
  if (!response.ok) {
    throw new Error('Failed to fetch archived alerts');
  }
  const data = await response.json();
  // Map _id to id if necessary, or just treat as AnomalyAlert
  // The backend adds _id, but frontend might not expect it unless we extend the type.
  // For now we just return the data as AnomalyAlert[] (ignoring _id for strict typing unless we update types)
  return data.map((item: any) => ({
      ...item,
      // If we need the ID for updates, we might need to store it.
      // The current frontend uses NORAD_CAT_ID for identification, which works for 1-to-1 alert mapping?
      // Actually, an alert is specific to a timestamp too.
      // Let's attach the mongo ID as a temporary property if we can, or rely on NORAD_CAT_ID + timestamp for lookup?
      // Better to update types to include optional _id.
      _id: item._id
  }));
};

export const archiveAlert = async (alert: AnomalyAlert): Promise<AnomalyAlert> => {
  const response = await fetch(`${API_URL}/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(alert),
  });
  if (!response.ok) {
    throw new Error('Failed to archive alert');
  }
  return response.json();
};

export const updateAlertNotes = async (id: string, notes: string): Promise<AnomalyAlert> => {
    const response = await fetch(`${API_URL}/alerts/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ details: { operatorNotes: notes } }),
    });
    if (!response.ok) {
        throw new Error('Failed to update alert notes');
    }
    return response.json();
};
