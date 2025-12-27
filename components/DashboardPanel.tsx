import React, { useState, useMemo } from 'react';
import { AnomalyAlert } from '../types';
import { getRiskColor, getRiskHoverColor, getRiskHexColor } from '../constants';
import { RiskDistributionChart } from './RiskDistributionChart';

interface DashboardPanelProps {
    alerts: AnomalyAlert[];
    selectedSatelliteId: number | null;
    onSelectSatellite: (satelliteId: number | null) => void;
    onArchiveAlert: (satelliteId: number) => void;
    onOpenArchive: () => void;
    onSaveNotes: (noradId: number, notes: string) => void;
    filterOptions: {
        countries: string[];
        types: string[];
    };
    isSystemReady: boolean;
}

const AnomalyItem: React.FC<{
    alert: AnomalyAlert;
    isSelected: boolean;
    onSelect: () => void;
}> = ({ alert, isSelected, onSelect }) => {
    const riskColor = getRiskColor(alert.details?.riskLevel);
    const hoverColor = getRiskHoverColor(alert.details?.riskLevel);
    const riskHex = getRiskHexColor(alert.details?.riskLevel);
    
    return (
        <div 
            onClick={onSelect}
            className={`p-4 rounded-sm border-l-4 transition-all cursor-pointer mb-2 ${riskColor}
                ${isSelected 
                    ? `bg-white/10 ring-1 ring-white shadow-xl`
                    : `bg-white/5 ${hoverColor}`}`}
        >
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-white uppercase tracking-wider truncate" title={alert.satellite.OBJECT_NAME}>
                        {alert.satellite.OBJECT_NAME}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase truncate">
                       {alert.analysisState === 'pending' ? 'Analyzing...' : (alert.details?.description || 'No details available.')}
                    </p>
                </div>
                {alert.details && (
                    <div className="ml-3 text-[10px] font-black uppercase tracking-widest shrink-0" style={{ color: riskHex }}>{alert.details.riskLevel}</div>
                )}
            </div>
        </div>
    )
}

const FilterControl: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    disabled: boolean;
}> = ({ label, value, onChange, options, disabled }) => (
    <div className="flex-1">
        <label className="block text-[9px] font-black text-gray-600 uppercase mb-1 tracking-widest">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full p-2 text-[11px] bg-black border border-white/10 text-white rounded-sm focus:outline-none focus:border-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed uppercase font-display font-bold"
        >
            <option value="all">ALL REGIONS</option>
            {options.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
        </select>
    </div>
);

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ 
    alerts,
    selectedSatelliteId,
    onSelectSatellite,
    onOpenArchive,
    filterOptions,
    isSystemReady,
}) => {
    
    const [searchQuery, setSearchQuery] = useState('');
    const [countryFilter, setCountryFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const filteredAlerts = useMemo(() => {
        if (!isSystemReady) return [];
        const query = searchQuery.toLowerCase().trim();
        
        return alerts.filter(alert => {
            let matchesSearch = true;
            if (query) {
                matchesSearch = 
                    alert.satellite.OBJECT_NAME.toLowerCase().includes(query) ||
                    alert.satellite.NORAD_CAT_ID.toString().includes(query);
            }
            const matchesCountry = countryFilter === 'all' || alert.satellite.OWNER === countryFilter;
            const matchesType = typeFilter === 'all' || alert.satellite.OBJECT_TYPE === typeFilter;
            return matchesSearch && matchesCountry && matchesType;
        });
    }, [alerts, searchQuery, countryFilter, typeFilter, isSystemReady]);

    return (
        <div className="flex-1 bg-black flex flex-col h-full overflow-hidden">
            <div className="p-6 bg-black border-b border-white/10 shrink-0">
                <div className="flex justify-between items-center">
                     <h2 className="text-xl font-black tracking-[0.2em] text-white uppercase font-display">ANOMALY FEED</h2>
                     <button 
                        onClick={onOpenArchive}
                        className="p-2 text-gray-600 hover:text-white transition-colors"
                        title="View Archives"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                     </button>
                </div>
            </div>

            <div className="p-6 border-b border-white/10 space-y-6 shrink-0 bg-white/[0.02]">
                 <RiskDistributionChart alerts={alerts} />
                 
                 <div className="flex space-x-3">
                     <FilterControl label="Registry Force" value={countryFilter} onChange={setCountryFilter} options={filterOptions.countries} disabled={!isSystemReady} />
                     <FilterControl label="Object Class" value={typeFilter} onChange={setTypeFilter} options={filterOptions.types} disabled={!isSystemReady} />
                 </div>
                 <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isSystemReady ? "FILTER BY TARGET ID..." : "INITIALIZING SENSORS..."}
                    disabled={!isSystemReady}
                    className="w-full p-3 bg-black border border-white/10 text-white rounded-sm focus:outline-none focus:border-white transition-colors placeholder:text-gray-800 font-mono text-[10px] tracking-widest uppercase"
                />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-1">
                {!isSystemReady && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-800 text-center uppercase tracking-widest font-black text-xs">
                        <p>AWAITING SIGNAL LOCK...</p>
                    </div>
                )}
                {isSystemReady && alerts.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-800 text-center uppercase tracking-widest font-black text-xs">
                        <p>SCANNING GEO ORBITAL SECTORS...</p>
                    </div>
                )}
                {filteredAlerts.map((alert) => (
                    <AnomalyItem 
                        key={`${alert.satellite.NORAD_CAT_ID}-${alert.timestamp}`}
                        alert={alert}
                        isSelected={alert.satellite.NORAD_CAT_ID === selectedSatelliteId}
                        onSelect={() => onSelectSatellite(alert.satellite.NORAD_CAT_ID)}
                    />
                ))}
            </div>
             <div className="p-4 text-center text-[8px] text-gray-800 font-mono border-t border-white/5 shrink-0 uppercase tracking-widest">
                Mission Feed Layer // Real-Time
            </div>
        </div>
    );
};