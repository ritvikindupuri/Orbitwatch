import React from 'react';

export const ArchiveModal = ({ isOpen, onClose, archivedAlerts, onLoadArchives, onClearArchives }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded w-3/4 max-h-[80vh] overflow-y-auto text-white">
                <h2 className="text-xl mb-4">Archived Alerts</h2>
                <button onClick={onClose} className="float-right text-gray-400">X</button>
                <ul>
                    {archivedAlerts.map((alert, idx) => (
                        <li key={idx} className="mb-2 border-b border-gray-700 pb-2">
                            <div>{alert.satellite.OBJECT_NAME} - Risk: {alert.details?.riskScore}</div>
                            <div className="text-sm text-gray-400">{new Date(alert.timestamp).toLocaleString()}</div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
