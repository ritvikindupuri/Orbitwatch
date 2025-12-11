import React from 'react';

export const DashboardPanel = ({ alerts, selectedSatelliteId, onSelectSatellite, onArchiveAlert, onOpenArchive, onSaveNotes, filterOptions, isSystemReady }) => (
    <div className="w-80 bg-gray-900 h-full p-4 overflow-y-auto text-white">
        <h2 className="text-lg font-bold mb-4">Dashboard</h2>
        <button onClick={onOpenArchive} className="bg-blue-600 px-3 py-1 rounded mb-4 w-full">View Archives</button>
        <ul>
            {alerts.map(alert => (
                <li key={alert.satellite.NORAD_CAT_ID} className="mb-2 p-2 bg-gray-800 rounded cursor-pointer" onClick={() => onSelectSatellite(alert.satellite.NORAD_CAT_ID)}>
                    <div className="flex justify-between">
                        <span>{alert.satellite.OBJECT_NAME}</span>
                        <span className="text-red-400">{alert.details?.riskScore}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onArchiveAlert(alert.satellite.NORAD_CAT_ID); }} className="text-xs text-blue-400 mt-2">Archive</button>
                </li>
            ))}
        </ul>
    </div>
);
