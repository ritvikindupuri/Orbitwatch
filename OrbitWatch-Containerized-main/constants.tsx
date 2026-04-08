import React from 'react';

export const APP_NAME = "OrbitWatch";

export type RiskLevel = 'Informational' | 'Low' | 'Moderate' | 'High' | 'Critical';

export const getRiskColor = (riskLevel: RiskLevel | undefined): string => {
    switch (riskLevel) {
        case 'Critical': return 'border-red-500';
        case 'High': return 'border-orange-500';
        case 'Moderate': return 'border-yellow-400';
        case 'Low': return 'border-blue-400';
        case 'Informational': return 'border-white';
        default: return 'border-gray-500';
    }
};

export const getRiskHoverColor = (riskLevel: RiskLevel | undefined): string => {
     switch (riskLevel) {
        case 'Critical': return 'hover:bg-red-900/20';
        case 'High': return 'hover:bg-orange-900/20';
        case 'Moderate': return 'hover:bg-yellow-900/20';
        case 'Low': return 'hover:bg-blue-900/20';
        case 'Informational': return 'hover:bg-white/5';
        default: return 'hover:bg-white/5';
    }
};

export const getRiskHexColor = (riskLevel: RiskLevel | undefined): string => {
    switch (riskLevel) {
        case 'Critical': return '#ef4444'; // red-500
        case 'High': return '#f97316'; // orange-500
        case 'Moderate': return '#facc15'; // yellow-400
        case 'Low': return '#3b82f6'; // blue-400
        case 'Informational': return '#ffffff'; // white
        default: return '#cccccc'; // gray
    }
};