import React from 'react';
import { AnomalyAlert, RealSatellite } from '../types.ts';
import { getRiskColor, getRiskHoverColor, getRiskHexColor } from '../constants.tsx';
import { RiskDistributionChart } from './RiskDistributionChart.tsx';

interface DashboardPanelProps {
    alerts: AnomalyAlert[];
    filteredAlerts: AnomalyAlert[];
    catalog: RealSatellite[];
    filteredCatalog: RealSatellite[];
    selectedSatelliteId: number | null;
    onSelectSatellite: (satelliteId: number | null) => void;
    onArchiveAlert: (satelliteId: number) => void;
    onOpenArchive: () => void;
    onSaveNotes: (noradId: number, notes: string) => void;
    filterOptions: {
        countries: string[];
        types: string[];
    };
    filterState: {
        searchQuery: string;
        countryFilter: string;
        typeFilter: string;
        riskFilter: string;
        viewMode: 'anomalies' | 'catalog';
    };
    onFilterChange: {
        setSearchQuery: (v: string) => void;
        setCountryFilter: (v: string) => void;
        setTypeFilter: (v: string) => void;
        setRiskFilter: (v: string) => void;
        setViewMode: (v: 'anomalies' | 'catalog') => void;
    };
    isSystemReady: boolean;
    onClose?: () => void;
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
                    <p className="text-[10px] text-gray-400 font-mono mt-2 uppercase leading-tight">
                       {alert.analysisState === 'pending' ? 'Analyzing Signal...' : (alert.details?.attributionNarrative || 'No details available.')}
                    </p>
                </div>
                {alert.details && (
                    <div className="ml-3 text-[10px] font-black uppercase tracking-widest shrink-0" style={{ color: riskHex }}>{alert.details.riskLevel}</div>
                )}
            </div>
        </div>
    )
}

const CatalogItem: React.FC<{
    sat: RealSatellite;
    isSelected: boolean;
    onSelect: () => void;
}> = ({ sat, isSelected, onSelect }) => (
    <div 
        onClick={onSelect}
        className={`p-4 rounded-sm border-l-4 border-gray-800 transition-all cursor-pointer mb-2
            ${isSelected 
                ? `bg-white/10 ring-1 ring-white shadow-xl`
                : `bg-white/5 hover:bg-white/10`}`}
    >
        <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
                <p className="font-black text-sm text-white uppercase tracking-wider truncate">
                    {sat.OBJECT_NAME}
                </p>
                <div className="flex gap-3 mt-2">
                    <p className="text-[9px] text-gray-500 font-mono uppercase">ID: {sat.NORAD_CAT_ID}</p>
                    <p className="text-[9px] text-cyan-500 font-mono uppercase">{sat.OWNER}</p>
                </div>
            </div>
        </div>
    </div>
)

const FilterControl: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    disabled: boolean;
    allLabel?: string;
}> = ({ label, value, onChange, options, disabled, allLabel = "ALL" }) => (
    <div className="flex-1">
        <label className="block text-[9px] font-black text-gray-600 uppercase mb-1 tracking-widest">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full p-2 text-[11px] bg-black border border-white/10 text-white rounded-sm focus:outline-none focus:border-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed uppercase font-display font-bold"
        >
            <option value="all">{allLabel}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
        </select>
    </div>
);

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ 
    alerts,
    filteredAlerts,
    catalog,
    filteredCatalog,
    selectedSatelliteId,
    onSelectSatellite,
    onOpenArchive,
    filterOptions,
    filterState,
    onFilterChange,
    isSystemReady,
    onClose
}) => {
    const { searchQuery, countryFilter, typeFilter, riskFilter, viewMode } = filterState;
    const { setSearchQuery, setCountryFilter, setTypeFilter, setRiskFilter, setViewMode } = onFilterChange;

    return (
        <div className="flex-1 bg-black flex flex-col h-full overflow-hidden">
            <div className="p-6 bg-black border-b border-white/10 shrink-0">
                <div className="flex justify-between items-center">
                     <div className="flex gap-6">
                        <button 
                            onClick={() => setViewMode('anomalies')}
                            className={`text-xl font-black tracking-[0.2em] uppercase font-display transition-all ${viewMode === 'anomalies' ? 'text-white' : 'text-gray-700 hover:text-gray-400'}`}
                        >
                            ANOMALIES
                        </button>
                        <button 
                            onClick={() => setViewMode('catalog')}
                            className={`text-xl font-black tracking-[0.2em] uppercase font-display transition-all ${viewMode === 'catalog' ? 'text-white' : 'text-gray-700 hover:text-gray-400'}`}
                        >
                            CATALOG
                        </button>
                     </div>
                     <div className="flex items-center gap-2">
                        <button 
                            onClick={onOpenArchive}
                            className="p-2 text-gray-600 hover:text-white transition-colors"
                            title="View Archives"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                        </button>
                        {onClose && (
                             <button 
                                onClick={onClose}
                                className="p-2 text-gray-600 hover:text-white transition-colors"
                                title="Collapse Sidebar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                     </div>
                </div>
            </div>

            <div className="p-6 border-b border-white/10 space-y-6 shrink-0 bg-white/[0.02]">
                 {viewMode === 'anomalies' && <RiskDistributionChart alerts={alerts} />}
                 
                 <div className="flex space-x-3">
                     <FilterControl label="Registry Force" value={countryFilter} onChange={setCountryFilter} options={filterOptions.countries} disabled={!isSystemReady} allLabel="ALL REGIONS" />
                     <FilterControl label="Object Class" value={typeFilter} onChange={setTypeFilter} options={filterOptions.types} disabled={!isSystemReady} allLabel="ALL CLASSES" />
                     {viewMode === 'anomalies' && (
                         <FilterControl label="Threat Level" value={riskFilter} onChange={setRiskFilter} options={['Low', 'Moderate', 'High', 'Critical']} disabled={!isSystemReady} allLabel="ALL LEVELS" />
                     )}
                 </div>
                 <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isSystemReady ? "FILTER BY TARGET ID OR NAME..." : "INITIALIZING SENSORS..."}
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
                {isSystemReady && viewMode === 'anomalies' && filteredAlerts.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-800 text-center uppercase tracking-widest font-black text-xs">
                        <p>NO ANOMALIES MATCHING CRITERIA</p>
                    </div>
                )}
                {isSystemReady && viewMode === 'catalog' && filteredCatalog.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-800 text-center uppercase tracking-widest font-black text-xs">
                        <p>NO ASSETS MATCHING CRITERIA</p>
                    </div>
                )}
                
                {isSystemReady && viewMode === 'anomalies' && filteredAlerts.map((alert) => (
                    <AnomalyItem 
                        key={`${alert.satellite.NORAD_CAT_ID}-${alert.timestamp}`}
                        alert={alert}
                        isSelected={alert.satellite.NORAD_CAT_ID === selectedSatelliteId}
                        onSelect={() => onSelectSatellite(alert.satellite.NORAD_CAT_ID)}
                    />
                ))}
                
                {isSystemReady && viewMode === 'catalog' && filteredCatalog.map((sat) => (
                    <CatalogItem 
                        key={sat.NORAD_CAT_ID}
                        sat={sat}
                        isSelected={sat.NORAD_CAT_ID === selectedSatelliteId}
                        onSelect={() => onSelectSatellite(sat.NORAD_CAT_ID)}
                    />
                ))}
            </div>
             <div className="p-4 text-center text-[8px] text-gray-800 font-mono border-t border-white/5 shrink-0 uppercase tracking-widest">
                {viewMode === 'anomalies' ? 'Anomaly Feed Layer // Real-Time Ensemble Attribution' : 'Global Catalog Layer // Space Domain Awareness Database'}
            </div>
        </div>
    );
};
