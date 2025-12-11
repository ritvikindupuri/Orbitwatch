import React from 'react';

export const GlobalStatsBar = ({ alerts, satelliteCount }) => (
    <div className="bg-gray-900 text-white p-2 flex space-x-4">
        <span>Satellites: {satelliteCount}</span>
        <span>Alerts: {alerts.length}</span>
    </div>
);
